
'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Team = {
  id: string
  name: string
  owner_id: string
  ea_club_id: string | null
  ea_club_name: string | null
  ea_platform: string | null
}

type NVPLPlayer = {
  id: string
  gamertag: string
  position: string | null
  ea_player_id: string | null
  ea_player_name: string | null
}

type EAPlayer = {
  eaPlayerId: string
  name: string
  position: string
  matchesSeen: number
}

function EAPlayersContent() {
  const params = useParams()
  const teamId = String(params.id)

  const [team, setTeam] = useState<Team | null>(null)
  const [roster, setRoster] = useState<NVPLPlayer[]>([])
  const [eaPlayers, setEAPlayers] = useState<EAPlayer[]>([])

  const [selectedEAPlayer, setSelectedEAPlayer] = useState('')
  const [selectedNVPLPlayer, setSelectedNVPLPlayer] = useState('')

  const [canManage, setCanManage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)

  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be signed in.')
      setLoading(false)
      return
    }

    const { data: teamData, error: teamError } = await supabase
      .from('teams')
      .select(
        'id, name, owner_id, ea_club_id, ea_club_name, ea_platform'
      )
      .eq('id', teamId)
      .single()

    if (teamError || !teamData) {
      setError(teamError?.message || 'Team not found.')
      setLoading(false)
      return
    }

    const loadedTeam = teamData as Team
    setTeam(loadedTeam)

    const [staffResult, adminResult, membershipResult] =
      await Promise.all([
        supabase
          .from('club_staff')
          .select('user_id')
          .eq('team_id', teamId)
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase.rpc('nvpl_can_manage_competitions'),
        supabase
          .from('club_memberships')
          .select('player_id')
          .eq('team_id', teamId)
          .is('left_at', null),
      ])

    const canManageTeam =
      loadedTeam.owner_id === user.id ||
      !!staffResult.data ||
      adminResult.data === true

    setCanManage(canManageTeam)

    if (membershipResult.error) {
      setError(membershipResult.error.message)
      setLoading(false)
      return
    }

    const playerIds = (membershipResult.data || []).map(
      membership => membership.player_id
    )

    if (playerIds.length === 0) {
      setRoster([])
      setLoading(false)
      return
    }

    const { data: profiles, error: profileError } = await supabase
      .from('player_profiles')
      .select(
        'id, gamertag, position, ea_player_id, ea_player_name'
      )
      .in('id', playerIds)
      .order('gamertag')

    if (profileError) {
      setError(profileError.message)
    } else {
      setRoster((profiles || []) as NVPLPlayer[])
    }

    setLoading(false)
  }, [teamId])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function discoverPlayers() {
    if (!team?.ea_club_id || !team.ea_platform) {
      setError('Connect your EA club in Team Settings first.')
      return
    }

    setSearching(true)
    setError('')
    setNotice('')
    setEAPlayers([])

    try {
      const query = new URLSearchParams({
        mode: 'clubPlayers',
        clubId: team.ea_club_id,
        platform: team.ea_platform,
      })

      const response = await fetch(`/api/eafc?${query}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Could not discover EA players.')
      }

      setEAPlayers(data.players || [])

      setNotice(
        `Checked ${data.matchesChecked || 0} recent matches and found ${
          data.players?.length || 0
        } EA player records.`
      )
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'EA player search failed.'
      )
    } finally {
      setSearching(false)
    }
  }

  async function linkPlayer() {
    if (!canManage) {
      setError('You do not have permission to manage this roster.')
      return
    }

    const eaPlayer = eaPlayers.find(
      player => player.eaPlayerId === selectedEAPlayer
    )

    const nvplPlayer = roster.find(
      player => player.id === selectedNVPLPlayer
    )

    if (!eaPlayer || !nvplPlayer || !team?.ea_platform) {
      setError('Select an EA player and an NVPL player.')
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    const { error: saveError } = await supabase.rpc(
      'nvpl_link_ea_player',
      {
        p_player_profile_id: nvplPlayer.id,
        p_ea_player_id: eaPlayer.eaPlayerId,
        p_ea_player_name: eaPlayer.name,
        p_ea_platform: team.ea_platform,
      }
    )

    if (saveError) {
      setError(saveError.message)
      setSaving(false)
      return
    }

    setNotice(
      `${eaPlayer.name} has been linked to ${nvplPlayer.gamertag}.`
    )

    setSelectedEAPlayer('')
    setSelectedNVPLPlayer('')

    await loadData()
    setSaving(false)
  }

  async function unlinkPlayer(player: NVPLPlayer) {
    if (!canManage || !team?.ea_platform) return

    const confirmed = window.confirm(
      `Unlink the EA identity from ${player.gamertag}?`
    )

    if (!confirmed) return

    setSaving(true)
    setError('')
    setNotice('')

    const { error: saveError } = await supabase.rpc(
      'nvpl_link_ea_player',
      {
        p_player_profile_id: player.id,
        p_ea_player_id: null,
        p_ea_player_name: null,
        p_ea_platform: team.ea_platform,
      }
    )

    if (saveError) {
      setError(saveError.message)
    } else {
      setNotice(`EA player link removed from ${player.gamertag}.`)
      await loadData()
    }

    setSaving(false)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#080b12] p-8 text-white">
        Loading player links...
      </main>
    )
  }

  if (!team) {
    return (
      <main className="min-h-screen bg-[#080b12] p-8 text-white">
        {error || 'Team not found.'}
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#080b12] px-4 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <Link
          href={`/teams/${teamId}/settings`}
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          ← Back to Team Settings
        </Link>

        <div className="mb-8 mt-7">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">
            EA FC integration
          </p>
          <h1 className="mt-2 text-3xl font-bold">
            EA Player Connections
          </h1>
          <p className="mt-2 text-gray-400">
            Connect EA player identities to your NVPL roster for individual match statistics.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {notice && (
          <div className="mb-5 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-300">
            {notice}
          </div>
        )}

        <section className="mb-6 rounded-2xl border border-white/10 bg-[#101722] p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">{team.name}</h2>
              <p className="mt-1 text-sm text-gray-400">
                {team.ea_club_name || 'No EA club connected'}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {team.ea_club_id
                  ? `EA Club ID: ${team.ea_club_id} · ${team.ea_platform}`
                  : 'Connect an EA club before discovering players.'}
              </p>
            </div>

            <button
              type="button"
              onClick={discoverPlayers}
              disabled={!canManage || searching || !team.ea_club_id}
              className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50"
            >
              {searching ? 'Checking EA matches...' : 'Discover EA Players'}
            </button>
          </div>

          {!canManage && (
            <p className="mt-4 text-sm text-yellow-300">
              Only team owners, authorised staff or admins can manage player links.
            </p>
          )}
        </section>

        <section className="mb-6 rounded-2xl border border-blue-500/20 bg-blue-500/[0.05] p-6">
          <h2 className="text-xl font-bold">Link an EA player</h2>
          <p className="mb-5 mt-1 text-sm text-gray-400">
            Discover players first, then match an EA identity to an NVPL roster profile.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm text-gray-300">
              EA player
              <select
                value={selectedEAPlayer}
                onChange={event => setSelectedEAPlayer(event.target.value)}
                disabled={!canManage}
                className="mt-2 w-full rounded-lg border border-white/10 bg-[#080b12] p-3 text-white"
              >
                <option value="">Select discovered EA player</option>
                {eaPlayers.map(player => (
                  <option key={player.eaPlayerId} value={player.eaPlayerId}>
                    {player.name} · {player.eaPlayerId}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm text-gray-300">
              NVPL player
              <select
                value={selectedNVPLPlayer}
                onChange={event => setSelectedNVPLPlayer(event.target.value)}
                disabled={!canManage}
                className="mt-2 w-full rounded-lg border border-white/10 bg-[#080b12] p-3 text-white"
              >
                <option value="">Select roster player</option>
                {roster.map(player => (
                  <option key={player.id} value={player.id}>
                    {player.gamertag}
                    {player.ea_player_id ? ' · Already linked' : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            type="button"
            onClick={linkPlayer}
            disabled={
              !canManage ||
              saving ||
              !selectedEAPlayer ||
              !selectedNVPLPlayer
            }
            className="mt-5 w-full rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50"
          >
            {saving ? 'Saving link...' : 'Link EA Player to NVPL Profile'}
          </button>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#101722] p-6">
          <h2 className="mb-4 text-xl font-bold">
            Current NVPL Roster Links
          </h2>

          {roster.length === 0 ? (
            <p className="text-sm text-gray-400">
              No active roster players were found.
            </p>
          ) : (
            <div className="space-y-3">
              {roster.map(player => (
                <div
                  key={player.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/20 p-4"
                >
                  <div>
                    <p className="font-semibold">{player.gamertag}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {player.position || 'Position not set'}
                    </p>
                    {player.ea_player_id ? (
                      <p className="mt-2 text-xs text-green-400">
                        Linked: {player.ea_player_name || 'EA player'} · ID {player.ea_player_id}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-yellow-400">
                        No EA player linked
                      </p>
                    )}
                  </div>

                  {player.ea_player_id && canManage && (
                    <button
                      type="button"
                      onClick={() => unlinkPlayer(player)}
                      disabled={saving}
                      className="rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      Unlink
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

export default function EAPlayersPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#080b12] p-8 text-white">
          Loading EA player connections...
        </main>
      }
    >
      <EAPlayersContent />
    </Suspense>
  )
}
