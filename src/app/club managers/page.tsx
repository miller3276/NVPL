
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Team = {
  id: string
  name: string
  abbreviation: string
  region: string
}

type Staff = {
  id: string
  team_id: string
  user_id: string
  role: string
  username: string | null
  gamertag: string
  avatar_url: string | null
}

export default function ClubManagersPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [teamId, setTeamId] = useState('')
  const [staff, setStaff] = useState<Staff[]>([])
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadTeams()
  }, [])

  async function loadTeams() {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setMessage('Please log in first.')
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('teams')
      .select('id, name, abbreviation, region')
      .eq('owner_id', user.id)
      .order('name')

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    const ownedTeams = (data || []) as Team[]
    setTeams(ownedTeams)

    if (ownedTeams.length > 0) {
      setTeamId(ownedTeams[0].id)
      await loadStaff(ownedTeams[0].id)
    }

    setLoading(false)
  }

  async function loadStaff(id: string) {
    setMessage('')

    const { data, error } = await supabase
      .from('club_staff')
      .select('id, team_id, user_id, role')
      .eq('team_id', id)

    if (error) {
      setMessage(error.message)
      setStaff([])
      return
    }

    const staffRows = data || []

    if (staffRows.length === 0) {
      setStaff([])
      return
    }

    const userIds = staffRows.map(member => member.user_id)

    const { data: profiles, error: profileError } = await supabase
      .from('player_profiles')
      .select('user_id, username, gamertag, avatar_url')
      .in('user_id', userIds)

    if (profileError) {
      setMessage(profileError.message)
      return
    }

    setStaff(staffRows.map(member => {
      const profile = (profiles || []).find(
        item => item.user_id === member.user_id
      )

      return {
        ...member,
        username: profile?.username || null,
        gamertag: profile?.gamertag || 'Player',
        avatar_url: profile?.avatar_url || null
      }
    }))
  }

  async function changeTeam(id: string) {
    setTeamId(id)
    setStaff([])
    await loadStaff(id)
  }

  async function addManager() {
    if (!username.trim() || !teamId) {
      setMessage('Enter an NVPL username.')
      return
    }

    setSaving(true)
    setMessage('')

    const { error } = await supabase.rpc('add_club_manager', {
      p_team_id: teamId,
      p_username: username.trim().replace(/^@/, '')
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Assistant manager appointed successfully.')
      setUsername('')
      await loadStaff(teamId)
    }

    setSaving(false)
  }

  async function removeManager(userId: string, name: string) {
    if (!window.confirm(`Remove ${name} as an assistant manager?`)) {
      return
    }

    setSaving(true)
    setMessage('')

    const { error } = await supabase.rpc('remove_club_manager', {
      p_team_id: teamId,
      p_user_id: userId
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Assistant manager removed.')
      await loadStaff(teamId)
    }

    setSaving(false)
  }

  const selectedTeam = teams.find(team => team.id === teamId)

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 text-white p-8">
        Loading club managers...
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-4xl mx-auto">

        <p className="text-blue-400 text-sm font-semibold">
          NVPL CLUB MANAGEMENT
        </p>

        <h1 className="text-4xl font-bold mt-2">
          Manager Management
        </h1>

        <p className="text-gray-400 mt-2 mb-8">
          Appoint and manage your club's assistant managers.
        </p>

        {teams.length === 0 ? (
          <div className="bg-gray-900 rounded-xl p-6">
            You do not own a club yet.
          </div>
        ) : (
          <>
            <label className="block text-sm text-gray-400 mb-2">
              Select club
            </label>

            <select
              value={teamId}
              onChange={event => changeTeam(event.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 mb-6"
            >
              {teams.map(team => (
                <option key={team.id} value={team.id}>
                  {team.name} ({team.region})
                </option>
              ))}
            </select>

            {selectedTeam && (
              <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
                <h2 className="text-xl font-bold mb-2">
                  Appoint assistant manager
                </h2>

                <p className="text-sm text-gray-400 mb-4">
                  Search using their NVPL username.
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    value={username}
                    onChange={event => setUsername(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === 'Enter') addManager()
                    }}
                    placeholder="Enter NVPL username"
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg p-3"
                  />

                  <button
                    onClick={addManager}
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-6 py-3 rounded-lg font-semibold"
                  >
                    Appoint manager
                  </button>
                </div>
              </section>
            )}

            {message && (
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-6 text-sm">
                {message}
              </div>
            )}

            <section>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Current managers</h2>
                <span className="text-sm text-gray-400">
                  {staff.length} assistant managers
                </span>
              </div>

              {staff.length === 0 ? (
                <div className="bg-gray-900 rounded-xl p-8 text-center text-gray-400">
                  No assistant managers appointed yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {staff.map(member => (
                    <div
                      key={member.id}
                      className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-wrap items-center gap-4"
                    >
                      {member.avatar_url ? (
                        <img
                          src={member.avatar_url}
                          alt=""
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center font-bold">
                          {(member.username || member.gamertag)[0].toUpperCase()}
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="font-bold truncate">
                          {member.username
                            ? `@${member.username}`
                            : member.gamertag}
                        </p>
                        <p className="text-sm text-gray-400">
                          {member.gamertag}
                        </p>
                        <p className="text-xs text-blue-400 mt-1">
                          Assistant Manager
                        </p>
                      </div>

                      <button
                        onClick={() =>
                          removeManager(
                            member.user_id,
                            member.username || member.gamertag
                          )
                        }
                        disabled={saving}
                        className="bg-red-700 hover:bg-red-800 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-semibold"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 mt-8">
              <h2 className="text-xl font-bold mb-4">Role permissions</h2>

              <div className="space-y-4 text-sm">
                <div>
                  <p className="font-semibold text-blue-400">Club Owner</p>
                  <p className="text-gray-400">
                    Full club control, appointing and removing managers,
                    roster management and club settings.
                  </p>
                </div>

                <div>
                  <p className="font-semibold text-blue-400">Assistant Manager</p>
                  <p className="text-gray-400">
                    View the roster, assign positions and squad numbers,
                    and release players. Cannot appoint managers or edit
                    club ownership and settings.
                  </p>
                </div>
              </div>
            </section>
          </>
        )}

      </div>
    </main>
  )
}
