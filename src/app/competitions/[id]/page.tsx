
'use client'

import { Suspense, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Competition = {
  id: string
  name: string
  region: string
  season: string
  division: string
  description: string | null
  status: string
  start_date: string | null
  end_date: string | null
  registrations_open: boolean
}

type Team = {
  id: string
  name: string
  abbreviation: string | null
  badge_url: string | null
}

type Player = {
  id: string
  username: string | null
  gamertag: string
  position: string | null
  avatar_url: string | null
}

type Registration = {
  id: string
  team_id: string
  player_id: string
  status: string
}

function CompetitionPageContent() {
  const params = useParams()
  const id = params.id as string

  const [competition, setCompetition] = useState<Competition | null>(null)
  const [registeredTeams, setRegisteredTeams] = useState<Team[]>([])
  const [myTeams, setMyTeams] = useState<Team[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [profiles, setProfiles] = useState<Player[]>([])

  const [userId, setUserId] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (id) loadPage()
  }, [id])

  async function loadPage() {
    setLoading(true)
    setMessage('')

    const { data: authData } = await supabase.auth.getUser()
    const user = authData.user

    setUserId(user?.id || '')

    const { data: competitionData, error: competitionError } = await supabase
      .from('competitions')
      .select('id, name, region, season, division, description, status, start_date, end_date, registrations_open')
      .eq('id', id)
      .maybeSingle()

    if (competitionError || !competitionData) {
      setCompetition(null)
      setLoading(false)
      return
    }

    setCompetition(competitionData as Competition)

    if (user) {
      const { data: adminData } = await supabase.rpc('nvpl_can_manage_competitions')
      setIsAdmin(adminData === true)

      const { data: staffData } = await supabase
        .from('club_staff')
        .select('team_id, role')
        .eq('user_id', user.id)

      const managedIds = (staffData || [])
        .filter((staff: { team_id: string; role: string }) =>
          ['manager', 'owner', 'admin', 'club_manager'].includes(
            (staff.role || '').toLowerCase()
          )
        )
        .map((staff: { team_id: string }) => staff.team_id)

      if (managedIds.length) {
        const { data: myTeamData } = await supabase
          .from('teams')
          .select('id, name, abbreviation, badge_url')
          .in('id', managedIds)

        setMyTeams((myTeamData || []) as Team[])
      } else {
        setMyTeams([])
      }
    } else {
      setIsAdmin(false)
      setMyTeams([])
    }

    const { data: teamRegistrations } = await supabase
      .from('competition_team_registrations')
      .select('team_id')
      .eq('competition_id', id)
      .eq('status', 'registered')

    const teamIds = (teamRegistrations || []).map(
      (registration: { team_id: string }) => registration.team_id
    )

    if (teamIds.length) {
      const { data: teamData } = await supabase
        .from('teams')
        .select('id, name, abbreviation, badge_url')
        .in('id', teamIds)
        .order('name')

      setRegisteredTeams((teamData || []) as Team[])
    } else {
      setRegisteredTeams([])
    }

    if (user) {
      const { data: registrationData } = await supabase
        .from('competition_registrations')
        .select('id, team_id, player_id, status')
        .eq('competition_id', id)
        .eq('status', 'registered')

      const rows = (registrationData || []) as Registration[]
      setRegistrations(rows)

      const playerIds = [...new Set(rows.map(row => row.player_id))]

      if (playerIds.length) {
        const { data: profileData } = await supabase
          .from('player_profiles')
          .select('id, username, gamertag, position, avatar_url')
          .in('id', playerIds)

        setProfiles((profileData || []) as Player[])
      } else {
        setProfiles([])
      }
    } else {
      setRegistrations([])
      setProfiles([])
    }

    setLoading(false)
  }

  async function toggleRegistrations() {
    if (!competition) return

    setSaving(true)
    setMessage('')

    const { error } = await supabase.rpc(
      'nvpl_set_competition_registrations',
      {
        p_competition_id: competition.id,
        p_open: !competition.registrations_open
      }
    )

    if (error) {
      setMessage(error.message)
    } else {
      setMessage(
        competition.registrations_open
          ? 'Registrations closed.'
          : 'Registrations opened.'
      )
      await loadPage()
    }

    setSaving(false)
  }

  async function registerTeam() {
    if (!selectedTeam || !competition) {
      setMessage('Select a club first.')
      return
    }

    setSaving(true)
    setMessage('')

    const { error } = await supabase.rpc(
      'nvpl_register_competition_team',
      {
        p_competition_id: competition.id,
        p_team_id: selectedTeam
      }
    )

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Your club has been registered.')
      await loadPage()
    }

    setSaving(false)
  }

  async function loadPlayers(teamId: string) {
    setSelectedTeam(teamId)
    setSelectedPlayer('')
    setPlayers([])

    if (!teamId) return

    const { data: membershipData, error } = await supabase
      .from('club_memberships')
      .select('player_id')
      .eq('team_id', teamId)
      .is('left_at', null)
      .in('status', ['active', 'accepted', 'approved'])

    if (error) {
      setMessage(error.message)
      return
    }

    const playerIds = (membershipData || []).map(
      (membership: { player_id: string }) => membership.player_id
    )

    if (!playerIds.length) return

    const { data: playerData, error: playerError } = await supabase
      .from('player_profiles')
      .select('id, username, gamertag, position, avatar_url')
      .in('id', playerIds)
      .order('username')

    if (playerError) {
      setMessage(playerError.message)
      return
    }

    setPlayers((playerData || []) as Player[])
  }

  async function registerPlayer() {
    if (!competition || !selectedTeam || !selectedPlayer) {
      setMessage('Select a club and player.')
      return
    }

    setSaving(true)
    setMessage('')

    const { error } = await supabase.rpc(
      'nvpl_register_competition_player',
      {
        p_competition_id: competition.id,
        p_team_id: selectedTeam,
        p_player_id: selectedPlayer
      }
    )

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Player added to the competition roster.')
      await loadPage()
      await loadPlayers(selectedTeam)
    }

    setSaving(false)
  }

  async function removePlayer(registrationId: string) {
    if (!confirm('Remove this player from the competition roster?')) return

    setSaving(true)
    setMessage('')

    const { error } = await supabase.rpc(
      'nvpl_admin_remove_competition_player',
      { p_registration_id: registrationId }
    )

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Player removed from the competition roster.')
      await loadPage()
    }

    setSaving(false)
  }

  function teamName(teamId: string) {
    return registeredTeams.find(team => team.id === teamId)?.name || 'Club'
  }

  function playerName(playerId: string) {
    const player = profiles.find(profile => profile.id === playerId)
    return player?.username || player?.gamertag || 'Player'
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 text-white p-8">
        Loading competition...
      </main>
    )
  }

  if (!competition) {
    return (
      <main className="min-h-screen bg-gray-950 text-white p-8">
        Competition not found.
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <a href="/competitions" className="text-blue-400 hover:underline">
          ← All competitions
        </a>

        <section className="bg-gray-900 border border-gray-800 rounded-2xl p-8 mt-6">
          <div className="flex flex-wrap justify-between gap-4">
            <span className="text-blue-400 font-bold">
              {competition.region}
            </span>
            <span className="text-sm text-gray-400 capitalize">
              {competition.status}
            </span>
          </div>

          <h1 className="text-4xl font-bold mt-4">
            {competition.name}
          </h1>

          <p className="text-gray-400 mt-3">
            {competition.season} · {competition.division}
          </p>

          {competition.description && (
            <p className="text-gray-300 mt-6 whitespace-pre-wrap">
              {competition.description}
            </p>
          )}

          <div className="grid grid-cols-2 gap-4 mt-8">
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-400 text-sm">Start date</p>
              <p className="font-semibold mt-1">
                {competition.start_date || 'TBA'}
              </p>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-400 text-sm">End date</p>
              <p className="font-semibold mt-1">
                {competition.end_date || 'TBA'}
              </p>
            </div>
          </div>
        </section>

        {message && (
          <div className="mt-6 bg-gray-900 border border-gray-700 rounded-lg p-4 text-sm">
            {message}
          </div>
        )}

        {isAdmin && (
          <section className="mt-8 bg-gray-900 border border-blue-800 rounded-xl p-6">
            <h2 className="text-xl font-bold">Registration controls</h2>
            <p className="text-gray-400 text-sm mt-2">
              {competition.registrations_open
                ? 'Registrations are currently open.'
                : 'Registrations are currently closed.'}
            </p>

            <button
              onClick={toggleRegistrations}
              disabled={saving}
              className={`mt-4 px-6 py-3 rounded-lg font-semibold disabled:opacity-50 ${
                competition.registrations_open
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {saving
                ? 'Saving...'
                : competition.registrations_open
                  ? 'Close registrations'
                  : 'Open registrations'}
            </button>
          </section>
        )}

        {competition.registrations_open && myTeams.length > 0 && (
          <section className="mt-8 bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-2xl font-bold">Club registration</h2>
            <p className="text-gray-400 mt-2">
              Register your club for this competition.
            </p>

            <div className="flex flex-col md:flex-row gap-3 mt-5">
              <select
                value={selectedTeam}
                onChange={event => loadPlayers(event.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg p-3"
              >
                <option value="">Select your club</option>
                {myTeams.map(team => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>

              <button
                onClick={registerTeam}
                disabled={saving || !selectedTeam}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-6 py-3 rounded-lg font-semibold"
              >
                Register club
              </button>
            </div>
          </section>
        )}

        {competition.registrations_open && myTeams.length > 0 && (
          <section className="mt-8 bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-2xl font-bold">Register players</h2>
            <p className="text-gray-400 mt-2">
              Select players from your club's active membership.
            </p>

            <div className="flex flex-col md:flex-row gap-3 mt-5">
              <select
                value={selectedTeam}
                onChange={event => loadPlayers(event.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg p-3"
              >
                <option value="">Select your club</option>
                {myTeams
                  .filter(team =>
                    registeredTeams.some(registered => registered.id === team.id)
                  )
                  .map(team => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
              </select>

              <select
                value={selectedPlayer}
                onChange={event => setSelectedPlayer(event.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg p-3"
              >
                <option value="">Select a player</option>
                {players.map(player => (
                  <option key={player.id} value={player.id}>
                    {player.username || player.gamertag}
                    {player.position ? ` · ${player.position}` : ''}
                  </option>
                ))}
              </select>

              <button
                onClick={registerPlayer}
                disabled={saving || !selectedTeam || !selectedPlayer}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-6 py-3 rounded-lg font-semibold"
              >
                Add player
              </button>
            </div>
          </section>
        )}

        <section className="mt-8 bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-2xl font-bold">Registered clubs</h2>

          {registeredTeams.length === 0 ? (
            <p className="text-gray-400 mt-4">
              No clubs have registered yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
              {registeredTeams.map(team => (
                <div
                  key={team.id}
                  className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex items-center gap-4"
                >
                  {team.badge_url ? (
                    <img
                      src={team.badge_url}
                      alt=""
                      className="w-12 h-12 object-contain"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center font-bold">
                      {team.abbreviation || team.name.slice(0, 2)}
                    </div>
                  )}

                  <div>
                    <h3 className="font-bold">{team.name}</h3>
                    <p className="text-sm text-green-400">Registered</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {userId && (
          <section className="mt-8 bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-2xl font-bold">Competition rosters</h2>

            {registrations.length === 0 ? (
              <p className="text-gray-400 mt-4">
                No player registrations are visible yet.
              </p>
            ) : (
              <div className="space-y-3 mt-5">
                {registrations.map(registration => (
                  <div
                    key={registration.id}
                    className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex flex-wrap justify-between items-center gap-3"
                  >
                    <div>
                      <p className="font-semibold">
                        {playerName(registration.player_id)}
                      </p>
                      <p className="text-sm text-gray-400">
                        {teamName(registration.team_id)}
                      </p>
                    </div>

                    {isAdmin && (
                      <button
                        onClick={() => removePlayer(registration.id)}
                        disabled={saving}
                        className="bg-red-600 hover:bg-red-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-semibold"
                      >
                        Remove player
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  )
}

export default function CompetitionPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-950 text-white p-8">
          Loading competition...
        </main>
      }
    >
      <CompetitionPageContent />
    </Suspense>
  )
}
