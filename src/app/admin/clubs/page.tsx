
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Team = {
  id: string
  [key: string]: unknown
}

type Player = {
  id: string
  user_id: string
  gamertag: string
  position: string | null
  region: string
}

type Membership = {
  id: string
  team_id: string
  player_id: string
  primary_position: string | null
  secondary_position: string | null
  squad_number: number | null
  status: string
}

type Staff = {
  id: string
  team_id: string
  user_id: string
  role: string
}

const inputClass =
  'w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white'

function getTeamName(team?: Team) {
  if (!team) return 'Unknown club'

  for (const key of ['name', 'team_name', 'club_name', 'display_name']) {
    const value = team[key]
    if (typeof value === 'string' && value.trim()) return value
  }

  return `Club ${team.id.slice(0, 8)}`
}

export default function ClubAdminPage() {
  const router = useRouter()

  const [teams, setTeams] = useState<Team[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [staff, setStaff] = useState<Staff[]>([])

  const [selectedTeam, setSelectedTeam] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [primaryPosition, setPrimaryPosition] = useState('')
  const [secondaryPosition, setSecondaryPosition] = useState('')
  const [squadNumber, setSquadNumber] = useState('')

  const [staffUserId, setStaffUserId] = useState('')
  const [staffRole, setStaffRole] = useState('manager')

  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'squad' | 'staff'>('squad')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [allowed, setAllowed] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)

  const notify = (text: string, error = false) => {
    setMessage(text)
    setIsError(error)
  }

  const loadData = useCallback(async () => {
    const [
      teamResult,
      playerResult,
      membershipResult,
      staffResult,
    ] = await Promise.all([
      supabase.from('teams').select('*'),
      supabase
        .from('player_profiles')
        .select('id, user_id, gamertag, position, region')
        .order('gamertag'),
      supabase.from('club_memberships').select('*'),
      supabase.from('club_staff').select('*'),
    ])

    const failed =
      teamResult.error ||
      playerResult.error ||
      membershipResult.error ||
      staffResult.error

    if (failed) {
      notify(failed.message, true)
      setLoading(false)
      return
    }

    const teamData = (teamResult.data || []) as Team[]
    setTeams(teamData)
    setPlayers((playerResult.data || []) as Player[])
    setMemberships((membershipResult.data || []) as Membership[])
    setStaff((staffResult.data || []) as Staff[])

    if (!selectedTeam && teamData.length > 0) {
      setSelectedTeam(teamData[0].id)
    }

    setLoading(false)
  }, [selectedTeam])

  useEffect(() => {
    async function initialise() {
      const { data: authData, error: authError } =
        await supabase.auth.getUser()

      if (authError || !authData.user) {
        router.replace('/login')
        return
      }

      const { data, error } = await supabase.rpc(
        'nvpl_can_manage_clubs'
      )

      if (error || data !== true) {
        setAllowed(false)
        setLoading(false)
        return
      }

      setAllowed(true)
      await loadData()
    }

    initialise()
  }, [router, loadData])

  async function addPlayer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedTeam || !selectedPlayer) {
      notify('Select a club and player.', true)
      return
    }

    const alreadyMember = memberships.some(
      item =>
        item.team_id === selectedTeam &&
        item.player_id === selectedPlayer &&
        item.status === 'active'
    )

    if (alreadyMember) {
      notify('This player is already an active member of this club.', true)
      return
    }

    const number = squadNumber.trim() === ''
      ? null
      : Number(squadNumber)

    if (
      number !== null &&
      (!Number.isInteger(number) || number < 0 || number > 99)
    ) {
      notify('Squad number must be between 0 and 99.', true)
      return
    }

    setSaving(true)

    const { error } = await supabase
      .from('club_memberships')
      .insert({
        team_id: selectedTeam,
        player_id: selectedPlayer,
        primary_position: primaryPosition || null,
        secondary_position: secondaryPosition || null,
        squad_number: number,
        status: 'active',
      })

    if (error) {
      notify(error.message, true)
    } else {
      notify('Player added to club successfully.')
      setSelectedPlayer('')
      setPrimaryPosition('')
      setSecondaryPosition('')
      setSquadNumber('')
      await loadData()
    }

    setSaving(false)
  }

  async function updateMembershipStatus(
    membershipId: string,
    status: string
  ) {
    setSaving(true)

    const { error } = await supabase
      .from('club_memberships')
      .update({
        status,
        ...(status === 'left'
          ? { left_at: new Date().toISOString() }
          : {}),
      })
      .eq('id', membershipId)

    if (error) {
      notify(error.message, true)
    } else {
      notify('Membership updated.')
      await loadData()
    }

    setSaving(false)
  }

  async function addStaff(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedTeam || !staffUserId.trim() || !staffRole.trim()) {
      notify('Enter a club, user ID and staff role.', true)
      return
    }

    const { data: existing } = await supabase
      .from('club_staff')
      .select('id')
      .eq('team_id', selectedTeam)
      .eq('user_id', staffUserId.trim())
      .maybeSingle()

    if (existing) {
      notify('This user is already staff at this club.', true)
      return
    }

    setSaving(true)

    const { error } = await supabase
      .from('club_staff')
      .insert({
        team_id: selectedTeam,
        user_id: staffUserId.trim(),
        role: staffRole,
      })

    if (error) {
      notify(error.message, true)
    } else {
      notify('Club staff member added.')
      setStaffUserId('')
      await loadData()
    }

    setSaving(false)
  }

  async function removeStaff(staffId: string) {
    if (!window.confirm('Remove this staff member from the club?')) return

    setSaving(true)

    const { error } = await supabase
      .from('club_staff')
      .delete()
      .eq('id', staffId)

    if (error) {
      notify(error.message, true)
    } else {
      notify('Staff member removed.')
      await loadData()
    }

    setSaving(false)
  }

  const clubMemberships = memberships.filter(item => {
    const matchesClub = item.team_id === selectedTeam
    const player = players.find(p => p.id === item.player_id)

    return (
      matchesClub &&
      (
        player?.gamertag.toLowerCase().includes(search.toLowerCase()) ||
        item.status.toLowerCase().includes(search.toLowerCase())
      )
    )
  })

  const clubStaff = staff.filter(item =>
    item.team_id === selectedTeam
  )

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 text-white p-8">
        Loading club management...
      </main>
    )
  }

  if (!allowed) {
    return (
      <main className="min-h-screen bg-gray-950 text-white p-8">
        <h1 className="text-2xl font-bold">Access denied</h1>
        <p className="text-gray-400 mt-2">
          General Admin or Super Admin access is required.
        </p>
        <Link href="/admin" className="text-blue-400 mt-5 inline-block">
          Back to dashboard
        </Link>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-7xl mx-auto">

        <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
          <div>
            <p className="text-blue-400 text-sm font-semibold">
              NVPL ADMINISTRATION
            </p>
            <h1 className="text-4xl font-bold mt-2">
              Club Management
            </h1>
            <p className="text-gray-400 mt-2">
              Manage club squads, player memberships and staff.
            </p>
          </div>

          <Link
            href="/admin"
            className="bg-gray-800 hover:bg-gray-700 rounded-lg px-4 py-2"
          >
            Back to dashboard
          </Link>
        </div>

        {message && (
          <div className={`p-4 rounded-lg border mb-6 ${
            isError
              ? 'bg-red-950/40 border-red-800 text-red-300'
              : 'bg-green-950/40 border-green-800 text-green-300'
          }`}>
            {message}
          </div>
        )}

        {teams.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
            No clubs were found in the teams table.
          </div>
        ) : (
          <>
            <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
              <label className="block text-sm text-gray-400">
                Select club
                <select
                  value={selectedTeam}
                  onChange={e => setSelectedTeam(e.target.value)}
                  className={`${inputClass} mt-2`}
                >
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>
                      {getTeamName(team)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">Active players</p>
                  <p className="text-2xl font-bold mt-1">
                    {clubMemberships.filter(m => m.status === 'active').length}
                  </p>
                </div>

                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">Club staff</p>
                  <p className="text-2xl font-bold mt-1">
                    {clubStaff.length}
                  </p>
                </div>

                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">Total memberships</p>
                  <p className="text-2xl font-bold mt-1">
                    {memberships.filter(m => m.team_id === selectedTeam).length}
                  </p>
                </div>
              </div>
            </section>

            <div className="flex gap-3 mb-6">
              <button
                onClick={() => setActiveTab('squad')}
                className={`rounded-lg px-5 py-3 font-semibold ${
                  activeTab === 'squad'
                    ? 'bg-blue-600'
                    : 'bg-gray-800'
                }`}
              >
                Squad management
              </button>

              <button
                onClick={() => setActiveTab('staff')}
                className={`rounded-lg px-5 py-3 font-semibold ${
                  activeTab === 'staff'
                    ? 'bg-blue-600'
                    : 'bg-gray-800'
                }`}
              >
                Club staff
              </button>
            </div>

            {activeTab === 'squad' && (
              <>
                <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
                  <h2 className="text-2xl font-bold mb-5">
                    Add player to squad
                  </h2>

                  <form onSubmit={addPlayer} className="space-y-4">
                    <label className="block text-sm text-gray-400">
                      Player
                      <select
                        value={selectedPlayer}
                        onChange={e => setSelectedPlayer(e.target.value)}
                        className={`${inputClass} mt-2`}
                        required
                      >
                        <option value="">Select player</option>
                        {players.map(player => (
                          <option key={player.id} value={player.id}>
                            {player.gamertag} — {player.position || 'No position'} — {player.region}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <label className="text-sm text-gray-400">
                        Primary position
                        <input
                          value={primaryPosition}
                          onChange={e => setPrimaryPosition(e.target.value)}
                          placeholder="e.g. ST"
                          className={`${inputClass} mt-2`}
                        />
                      </label>

                      <label className="text-sm text-gray-400">
                        Secondary position
                        <input
                          value={secondaryPosition}
                          onChange={e => setSecondaryPosition(e.target.value)}
                          placeholder="e.g. CAM"
                          className={`${inputClass} mt-2`}
                        />
                      </label>

                      <label className="text-sm text-gray-400">
                        Squad number
                        <input
                          type="number"
                          min="0"
                          max="99"
                          value={squadNumber}
                          onChange={e => setSquadNumber(e.target.value)}
                          placeholder="Optional"
                          className={`${inputClass} mt-2`}
                        />
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={saving}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg px-6 py-3 font-semibold"
                    >
                      {saving ? 'Adding...' : 'Add player'}
                    </button>
                  </form>
                </section>

                <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                  <div className="flex flex-wrap justify-between gap-4 mb-5">
                    <h2 className="text-2xl font-bold">Club squad</h2>
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search players..."
                      className="bg-gray-800 border border-gray-700 rounded-lg p-3"
                    />
                  </div>

                  <div className="space-y-3">
                    {clubMemberships.length === 0 ? (
                      <p className="text-gray-400">
                        No matching memberships.
                      </p>
                    ) : clubMemberships.map(member => {
                      const player = players.find(
                        p => p.id === member.player_id
                      )

                      return (
                        <div
                          key={member.id}
                          className="bg-gray-800 rounded-lg p-4 flex flex-wrap justify-between gap-4"
                        >
                          <div>
                            <p className="font-semibold">
                              {player?.gamertag || 'Unknown player'}
                            </p>
                            <p className="text-sm text-gray-400 mt-1">
                              {member.primary_position || 'No primary position'}
                              {member.secondary_position
                                ? ` / ${member.secondary_position}`
                                : ''}
                              {' · '}
                              {member.squad_number !== null
                                ? `#${member.squad_number}`
                                : 'No squad number'}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {member.status}
                            </p>
                          </div>

                          <select
                            value={member.status}
                            disabled={saving}
                            onChange={e =>
                              updateMembershipStatus(member.id, e.target.value)
                            }
                            className="bg-gray-700 border border-gray-600 rounded-lg p-2"
                          >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                            <option value="left">Left club</option>
                          </select>
                        </div>
                      )
                    })}
                  </div>
                </section>
              </>
            )}

            {activeTab === 'staff' && (
              <>
                <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
                  <h2 className="text-2xl font-bold mb-5">
                    Add club staff
                  </h2>

                  <form onSubmit={addStaff} className="space-y-4">
                    <label className="block text-sm text-gray-400">
                      User ID
                      <input
                        value={staffUserId}
                        onChange={e => setStaffUserId(e.target.value)}
                        placeholder="Supabase user UUID"
                        className={`${inputClass} mt-2`}
                        required
                      />
                    </label>

                    <label className="block text-sm text-gray-400">
                      Staff role
                      <select
                        value={staffRole}
                        onChange={e => setStaffRole(e.target.value)}
                        className={`${inputClass} mt-2`}
                      >
                        <option value="manager">Manager</option>
                        <option value="assistant_manager">Assistant Manager</option>
                        <option value="captain">Captain</option>
                        <option value="coach">Coach</option>
                        <option value="analyst">Analyst</option>
                      </select>
                    </label>

                    <button
                      type="submit"
                      disabled={saving}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg px-6 py-3 font-semibold"
                    >
                      {saving ? 'Adding...' : 'Add staff member'}
                    </button>
                  </form>
                </section>

                <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                  <h2 className="text-2xl font-bold mb-5">
                    Current club staff
                  </h2>

                  <div className="space-y-3">
                    {clubStaff.length === 0 ? (
                      <p className="text-gray-400">
                        No staff members assigned.
                      </p>
                    ) : clubStaff.map(member => (
                      <div
                        key={member.id}
                        className="bg-gray-800 rounded-lg p-4 flex flex-wrap justify-between items-center gap-4"
                      >
                        <div>
                          <p className="font-semibold">{member.role}</p>
                          <p className="text-xs text-gray-400 mt-1 break-all">
                            {member.user_id}
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => removeStaff(member.id)}
                          className="bg-red-900/50 hover:bg-red-800 text-red-300 rounded-lg px-4 py-2"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </div>
    </main>
  )
}
