
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const positions = [
  'GK', 'CB', 'LB', 'RB', 'CDM', 'CM',
  'CAM', 'LM', 'RM', 'LW', 'RW', 'ST'
]

type Team = {
  id: string
  name: string
  abbreviation: string
  region: string
}

type PlayerProfile = {
  id: string
  username: string | null
  gamertag: string
  avatar_url: string | null
  country: string | null
}

type Membership = {
  id: string
  team_id: string
  player_id: string
  primary_position: string | null
  secondary_position: string | null
  squad_number: number | null
}

type RosterPlayer = Membership & {
  profile: PlayerProfile | null
}

export default function RosterPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeam, setSelectedTeam] = useState('')
  const [players, setPlayers] = useState<RosterPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [message, setMessage] = useState('')

  async function loadRoster() {
    setLoading(true)
    setMessage('')

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setMessage('Please log in first.')
      setLoading(false)
      return
    }

    const { data: teamData, error: teamError } = await supabase
      .from('teams')
      .select('id, name, abbreviation, region')
      .eq('owner_id', user.id)
      .order('name')

    if (teamError) {
      setMessage(teamError.message)
      setLoading(false)
      return
    }

    const ownedTeams = (teamData || []) as Team[]
    setTeams(ownedTeams)

    if (ownedTeams.length === 0) {
      setPlayers([])
      setSelectedTeam('')
      setMessage('You do not own a club yet.')
      setLoading(false)
      return
    }

    const activeTeam = ownedTeams.some(team => team.id === selectedTeam)
      ? selectedTeam
      : ownedTeams[0].id

    setSelectedTeam(activeTeam)
    await loadTeamPlayers(activeTeam)
    setLoading(false)
  }

  async function loadTeamPlayers(teamId: string) {
    const { data: membershipData, error: membershipError } = await supabase
      .from('club_memberships')
      .select('id, team_id, player_id, primary_position, secondary_position, squad_number')
      .eq('team_id', teamId)
      .eq('status', 'active')

    if (membershipError) {
      setMessage(membershipError.message)
      setPlayers([])
      return
    }

    const memberships = (membershipData || []) as Membership[]

    if (memberships.length === 0) {
      setPlayers([])
      return
    }

    const playerIds = memberships.map(member => member.player_id)

    const { data: profileData, error: profileError } = await supabase
      .from('player_profiles')
      .select('id, username, gamertag, avatar_url, country')
      .in('id', playerIds)

    if (profileError) {
      setMessage(profileError.message)
      setPlayers([])
      return
    }

    const profiles = (profileData || []) as PlayerProfile[]

    const combined = memberships.map(member => ({
      ...member,
      profile: profiles.find(profile => profile.id === member.player_id) || null
    }))

    combined.sort((a, b) => {
      return (a.squad_number ?? 100) - (b.squad_number ?? 100)
    })

    setPlayers(combined)
  }

  async function changeTeam(teamId: string) {
    setSelectedTeam(teamId)
    setPlayers([])
    setLoading(true)
    setMessage('')
    await loadTeamPlayers(teamId)
    setLoading(false)
  }

  async function updatePlayer(
    player: RosterPlayer,
    field: 'primary_position' | 'secondary_position' | 'squad_number',
    value: string
  ) {
    const updated = players.map(item => {
      if (item.id !== player.id) return item

      return {
        ...item,
        [field]: field === 'squad_number'
          ? (value === '' ? null : Number(value))
          : (value === '' ? null : value)
      }
    })

    setPlayers(updated)
  }

  async function savePlayer(player: RosterPlayer) {
    setSaving(player.id)
    setMessage('')

    if (!player.primary_position) {
      setMessage('Please select a primary position.')
      setSaving('')
      return
    }

    const { error } = await supabase.rpc('manage_club_member', {
      p_membership_id: player.id,
      p_primary_position: player.primary_position,
      p_secondary_position: player.secondary_position,
      p_squad_number: player.squad_number
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage(`${player.profile?.username || player.profile?.gamertag || 'Player'} updated successfully.`)
      await loadTeamPlayers(selectedTeam)
    }

    setSaving('')
  }

  async function releasePlayer(player: RosterPlayer) {
    const name = player.profile?.username || player.profile?.gamertag || 'this player'

    if (!window.confirm(`Are you sure you want to release ${name} from your club?`)) {
      return
    }

    setSaving(player.id)
    setMessage('')

    const { error } = await supabase.rpc('release_club_member', {
      p_membership_id: player.id
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage(`${name} has been released.`)
      await loadTeamPlayers(selectedTeam)
    }

    setSaving('')
  }

  useEffect(() => {
    loadRoster()
  }, [])

  const currentTeam = teams.find(team => team.id === selectedTeam)

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-6xl mx-auto">

        <div className="mb-8">
          <p className="text-sm text-blue-400 font-semibold">NVPL MANAGEMENT</p>
          <h1 className="text-4xl font-bold mt-2">Club Roster</h1>
          <p className="text-gray-400 mt-2">
            Manage your players, positions and squad numbers.
          </p>
        </div>

        {teams.length > 0 && (
          <div className="mb-6">
            <label className="block text-sm text-gray-400 mb-2">
              Select your club
            </label>

            <select
              value={selectedTeam}
              onChange={event => changeTeam(event.target.value)}
              className="w-full md:w-80 bg-gray-900 border border-gray-700 rounded-lg p-3"
            >
              {teams.map(team => (
                <option key={team.id} value={team.id}>
                  {team.name} ({team.region})
                </option>
              ))}
            </select>
          </div>
        )}

        {currentTeam && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
            <h2 className="text-2xl font-bold">{currentTeam.name}</h2>
            <p className="text-gray-400">
              {currentTeam.abbreviation} · {currentTeam.region}
            </p>
            <p className="text-sm text-gray-400 mt-3">
              {players.length} active squad members
            </p>
          </div>
        )}

        {message && (
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-5 text-sm">
            {message}
          </div>
        )}

        {loading ? (
          <p className="text-gray-400">Loading roster...</p>
        ) : players.length === 0 ? (
          <div className="bg-gray-900 rounded-xl p-8 text-center">
            <h2 className="text-xl font-semibold">No players yet</h2>
            <p className="text-gray-400 mt-2">
              Players will appear here after accepting your club invitations.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {players.map(player => (
              <div
                key={player.id}
                className="bg-gray-900 border border-gray-800 rounded-xl p-5"
              >
                <div className="flex items-center gap-4 mb-5">
                  {player.profile?.avatar_url ? (
                    <img
                      src={player.profile.avatar_url}
                      alt=""
                      className="w-14 h-14 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gray-700 flex items-center justify-center text-xl font-bold">
                      {(player.profile?.username || player.profile?.gamertag || '?')[0].toUpperCase()}
                    </div>
                  )}

                  <div>
                    <h3 className="font-bold text-lg">
                      {player.profile?.username
                        ? `@${player.profile.username}`
                        : player.profile?.gamertag || 'Unknown player'}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {player.profile?.gamertag || ''}
                      {player.profile?.country
                        ? ` · ${player.profile.country}`
                        : ''}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-2">
                      Primary position
                    </label>
                    <select
                      value={player.primary_position || ''}
                      onChange={event =>
                        updatePlayer(player, 'primary_position', event.target.value)
                      }
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3"
                    >
                      <option value="">Select position</option>
                      {positions.map(position => (
                        <option key={position} value={position}>
                          {position}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-2">
                      Secondary position
                    </label>
                    <select
                      value={player.secondary_position || ''}
                      onChange={event =>
                        updatePlayer(player, 'secondary_position', event.target.value)
                      }
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3"
                    >
                      <option value="">None</option>
                      {positions.map(position => (
                        <option key={position} value={position}>
                          {position}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-2">
                      Squad number
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={player.squad_number ?? ''}
                      onChange={event =>
                        updatePlayer(player, 'squad_number', event.target.value)
                      }
                      placeholder="1–99"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 mt-5">
                  <button
                    onClick={() => savePlayer(player)}
                    disabled={saving === player.id}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-5 py-2 rounded-lg font-semibold"
                  >
                    {saving === player.id ? 'Saving...' : 'Save changes'}
                  </button>

                  <button
                    onClick={() => releasePlayer(player)}
                    disabled={saving === player.id}
                    className="bg-red-700 hover:bg-red-800 disabled:opacity-50 px-5 py-2 rounded-lg font-semibold"
                  >
                    Release player
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

