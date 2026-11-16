
'use client'

import { Suspense, useEffect, useState } from 'react'
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
  ea_linked_at: string | null
}

type EAClub = {
  clubId: string | number
  name?: string
  details?: {
    name?: string
  }
}

function TeamSettingsContent() {
  const params = useParams()
  const teamId = String(params.id)

  const [team, setTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)
  const [canManage, setCanManage] = useState(false)

  const [clubName, setClubName] = useState('')
  const [platform, setPlatform] = useState('common-gen5')
  const [clubs, setClubs] = useState<EAClub[]>([])
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadTeam() {
      setLoading(true)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError('You must be signed in to view team settings.')
        setLoading(false)
        return
      }

      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select(
          'id, name, owner_id, ea_club_id, ea_club_name, ea_platform, ea_linked_at'
        )
        .eq('id', teamId)
        .single()

      if (teamError || !teamData) {
        setError('Could not load this team.')
        setLoading(false)
        return
      }

      setTeam(teamData)

      const [staffResult, adminResult] = await Promise.all([
        supabase
          .from('club_staff')
          .select('user_id')
          .eq('team_id', teamId)
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase.rpc('nvpl_can_manage_competitions'),
      ])

      const isOwner = teamData.owner_id === user.id
      const isStaff = !!staffResult.data
      const isAdmin = adminResult.data === true

      setCanManage(isOwner || isStaff || isAdmin)

      if (teamData.ea_platform) {
        setPlatform(teamData.ea_platform)
      }

      setLoading(false)
    }

    loadTeam()
  }, [teamId])

  async function searchClubs() {
    setError('')
    setMessage('')
    setClubs([])

    if (!clubName.trim()) {
      setError('Enter your EA club name first.')
      return
    }

    setSearching(true)

    try {
      const response = await fetch(
        `/api/eafc?name=${encodeURIComponent(clubName.trim())}&platform=${encodeURIComponent(platform)}&search=1`
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Could not search EA clubs.')
      }

      setClubs(data.clubs || [])

      if (!data.clubs?.length) {
        setMessage('No matching clubs were found.')
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Something went wrong.'
      )
    } finally {
      setSearching(false)
    }
  }

  async function linkClub(club: EAClub) {
    if (!canManage) return

    const selectedName =
      club.name || club.details?.name || 'EA Club'

    setSaving(true)
    setError('')
    setMessage('')

    const { error: saveError } = await supabase.rpc(
      'nvpl_link_ea_club',
      {
        p_team_id: teamId,
        p_ea_club_id: String(club.clubId),
        p_ea_club_name: selectedName,
        p_ea_platform: platform,
      }
    )

    if (saveError) {
      setError(saveError.message)
      setSaving(false)
      return
    }

    setTeam((current) =>
      current
        ? {
            ...current,
            ea_club_id: String(club.clubId),
            ea_club_name: selectedName,
            ea_platform: platform,
            ea_linked_at: new Date().toISOString(),
          }
        : current
    )

    setClubs([])
    setMessage('EA club successfully linked to your team.')
    setSaving(false)
  }

  async function unlinkClub() {
    if (!canManage) return

    const confirmed = window.confirm(
      'Are you sure you want to unlink this EA club?'
    )

    if (!confirmed) return

    setSaving(true)
    setError('')
    setMessage('')

    const { error: saveError } = await supabase.rpc(
      'nvpl_link_ea_club',
      {
        p_team_id: teamId,
        p_ea_club_id: null,
        p_ea_club_name: null,
        p_ea_platform: null,
      }
    )

    if (saveError) {
      setError(saveError.message)
      setSaving(false)
      return
    }

    setTeam((current) =>
      current
        ? {
            ...current,
            ea_club_id: null,
            ea_club_name: null,
            ea_platform: null,
            ea_linked_at: null,
          }
        : current
    )

    setMessage('EA club unlinked.')
    setSaving(false)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#080b12] p-8 text-white">
        Loading team settings...
      </main>
    )
  }

  if (!team) {
    return (
      <main className="min-h-screen bg-[#080b12] p-8 text-white">
        <p>{error || 'Team not found.'}</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#080b12] px-4 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <Link
          href={`/teams/${teamId}`}
          className="mb-6 inline-block text-sm text-blue-400 hover:text-blue-300"
        >
          ← Back to {team.name}
        </Link>

        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">
            Team management
          </p>

          <h1 className="mt-2 text-3xl font-bold">
            Team Settings
          </h1>

          <p className="mt-2 text-gray-400">
            Manage your team and connect its EA FC Pro Clubs account.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-5 rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-300">
            {message}
          </div>
        )}

        <section className="rounded-2xl border border-white/10 bg-[#101722] p-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">EA FC Club Connection</h2>
              <p className="mt-1 text-sm text-gray-400">
                Link your EA club once to connect it with NVPL fixtures.
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                team.ea_club_id
                  ? 'bg-green-500/15 text-green-400'
                  : 'bg-yellow-500/15 text-yellow-400'
              }`}
            >
              {team.ea_club_id ? 'CONNECTED' : 'NOT CONNECTED'}
            </span>
          </div>

          {team.ea_club_id ? (
            <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-5">
              <p className="text-sm text-gray-400">Connected EA club</p>

              <h3 className="mt-2 text-2xl font-bold">
                {team.ea_club_name}
              </h3>

              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-gray-500">EA Club ID</p>
                  <p className="mt-1 font-mono">{team.ea_club_id}</p>
                </div>

                <div>
                  <p className="text-gray-500">Platform</p>
                  <p className="mt-1">{team.ea_platform}</p>
                </div>
              </div>

              {team.ea_linked_at && (
                <p className="mt-4 text-xs text-gray-500">
                  Linked {new Date(team.ea_linked_at).toLocaleString()}
                </p>
              )}

              {canManage && (
                <button
                  onClick={unlinkClub}
                  disabled={saving}
                  className="mt-6 rounded-lg border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
                >
                  {saving ? 'Please wait...' : 'Unlink EA Club'}
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-black/20 p-5">
              <h3 className="font-semibold">No EA club connected</h3>
              <p className="mt-2 text-sm text-gray-400">
                Search for your club below and select the correct result.
              </p>
            </div>
          )}

          {canManage ? (
            <div className="mt-7 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  EA FC platform
                </label>

                <select
                  value={platform}
                  onChange={(event) => {
                    setPlatform(event.target.value)
                    setClubs([])
                  }}
                  className="w-full rounded-lg border border-white/10 bg-[#080b12] px-4 py-3 text-white outline-none focus:border-blue-500"
                >
                  <option value="common-gen5">common-gen5</option>
                  <option value="nx">nx</option>
                </select>

                <p className="mt-2 text-xs text-gray-500">
                  Select the platform your EA club plays on.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  EA club name
                </label>

                <input
                  value={clubName}
                  onChange={(event) => setClubName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') searchClubs()
                  }}
                  placeholder="Enter your exact EA club name"
                  maxLength={60}
                  className="w-full rounded-lg border border-white/10 bg-[#080b12] px-4 py-3 text-white outline-none placeholder:text-gray-600 focus:border-blue-500"
                />
              </div>

              <button
                onClick={searchClubs}
                disabled={searching || !clubName.trim()}
                className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {searching ? 'Searching EA...' : 'Search EA Clubs'}
              </button>

              {clubs.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold">
                    Select your club
                  </h3>

                  {clubs.map((club, index) => {
                    const name =
                      club.name || club.details?.name || 'EA Club'

                    return (
                      <div
                        key={`${club.clubId}-${index}`}
                        className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#080b12] p-4"
                      >
                        <div>
                          <p className="font-semibold">{name}</p>
                          <p className="mt-1 text-xs text-gray-500">
                            Club ID: {club.clubId}
                          </p>
                        </div>

                        <button
                          onClick={() => linkClub(club)}
                          disabled={saving}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50"
                        >
                          {saving ? 'Saving...' : 'Link This Club'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            <p className="mt-6 text-sm text-gray-500">
              You can view this connection, but only the team owner,
              registered club staff or an NVPL admin can change it.
            </p>
          )}
        </section>
      </div>
    </main>
  )
}

export default function TeamSettingsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#080b12] p-8 text-white">
          Loading team settings...
        </main>
      }
    >
      <TeamSettingsContent />
    </Suspense>
  )
}
