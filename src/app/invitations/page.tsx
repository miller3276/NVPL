
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Invitation = {
  id: string
  status: string
  created_at: string
  teams: {
    name: string
    abbreviation: string
  }[] | null
}

export default function InvitationsPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [busyId, setBusyId] = useState('')

  async function loadInvitations() {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      window.location.href = '/login'
      return
    }

    const { data: player, error: playerError } = await supabase
      .from('player_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (playerError || !player) {
      setMessage('Create your player profile first.')
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('club_invitations')
      .select(`
        id,
        status,
        created_at,
        teams (
          name,
          abbreviation
        )
      `)
      .eq('player_id', player.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(error.message)
    } else {
      setInvitations((data || []) as unknown as Invitation[])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadInvitations()
  }, [])

  async function respond(
    id: string,
    action: 'accept' | 'decline'
  ) {
    setBusyId(id)
    setMessage('')

    const { error } = await supabase.rpc(
      action === 'accept'
        ? 'accept_club_invitation'
        : 'decline_club_invitation',
      { p_invitation_id: id }
    )

    if (error) {
      setMessage(error.message)
    } else {
      setMessage(
        action === 'accept'
          ? 'Transfer accepted! You have joined your new club.'
          : 'Invitation declined.'
      )

      await loadInvitations()
    }

    setBusyId('')
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#080d18] text-white p-8">
        Loading invitations...
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#080d18] text-white p-8">
      <div className="max-w-3xl mx-auto">

        <Link href="/dashboard" className="text-blue-400">
          ← Back to Dashboard
        </Link>

        <h1 className="text-3xl font-bold mt-8">
          Club Invitations
        </h1>

        <p className="text-gray-400 mt-2 mb-8">
          View offers from clubs and decide whether to join.
        </p>

        {message && (
          <div className="bg-[#17243a] p-4 rounded-lg mb-6">
            {message}
          </div>
        )}

        {invitations.length === 0 ? (
          <div className="bg-[#151e30] p-8 rounded-xl">
            <h2 className="text-xl font-bold">
              No pending invitations
            </h2>

            <p className="text-gray-400 mt-2">
              Any club invitations you receive will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="bg-[#151e30] p-6 rounded-xl"
              >
                <h2 className="text-xl font-bold">
                  {invitation.teams?.[0]?.name || 'Unknown club'}
                </h2>

                <p className="text-gray-400 mt-1">
                  Club abbreviation: {invitation.teams?.[0]?.abbreviation || 'N/A'}
                </p>

                <p className="text-gray-500 text-sm mt-2">
                  Received: {new Date(invitation.created_at).toLocaleString()}
                </p>

                <div className="flex gap-3 mt-5">
                  <button
                    onClick={() => respond(invitation.id, 'accept')}
                    disabled={!!busyId}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 p-3 rounded-lg font-bold"
                  >
                    {busyId === invitation.id ? 'Processing...' : 'Accept transfer'}
                  </button>

                  <button
                    onClick={() => respond(invitation.id, 'decline')}
                    disabled={!!busyId}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 p-3 rounded-lg font-bold"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </main>
  )
}
