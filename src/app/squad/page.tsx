
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Team = {
  id: string
  name: string
  abbreviation: string
  region: string
}

type SquadMember = {
  id: string
  player_id: string
  username: string | null
  gamertag: string
  avatar_url: string | null
  primary_position: string
  secondary_position: string
  squad_number: string
}

const positions = [
  'GK', 'CB', 'LB', 'RB', 'CDM', 'CM',
  'CAM', 'LM', 'RM', 'LW', 'RW', 'ST'
]

export default function SquadPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeam, setSelectedTeam] = useState('')
  const [members, setMembers] = useState<SquadMember[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadTeams()
  }, [])

  async function loadTeams() {
    setLoading(true)
    setMessage('')

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

    const ownedTeams = (data ?? []) as Team[]
    setTeams(ownedTeams)

    if (ownedTeams.length > 0) {
      setSelectedTeam(ownedTeams[0].id)
      await loadSquad(ownedTeams[0].id)
    } else {
      setMembers([])
    }

    setLoading(false)
  }

  async function loadSquad(teamId: string) {
    setMessage('')

    const { data: membershipData, error } = await supabase
      .from('club_memberships')
      .select('id, player_id, primary_position, secondary_position, squad_number')
      .eq('team_id', teamId)
      .eq('status', 'active')

    if (error) {
      setMessage(error.message)
      setMembers([])
      return
    }

    const memberships = membershipData ?? []
    const playerIds = memberships.map((m: any) => m.player_id)

    if (playerIds.length === 0) {
      setMembers([])
      return
    }

    const { data: profiles, error: profileError } = await supabase
      .from('player_profiles')
      .select('id, username, gamertag, avatar_url')
      .in('id', playerIds)

    if (profileError) {
      setMessage(profileError.message)
      return
    }

    const profileMap = new Map(
      (profiles ?? []).map((profile: any) => [profile.id, profile])
    )

    const roster = memberships.map((membership: any) => {
      const profile: any = profileMap.get(membership.player_id)

      return {
        id: membership.id,
        player_id: membership.player_id,
        username: profile?.username ?? null,
        gamertag: profile?.gamertag ?? 'Unknown player',
        avatar_url: profile?.avatar_url ?? null,
        primary_position: membership.primary_position ?? 'CM',
        secondary_position: membership.secondary_position ?? '',
        squad_number: membership.squad_number?.toString() ?? ''
      }
    })

    setMembers(roster)
  }

  async function changeTeam(teamId: string) {
    setSelectedTeam(teamId)
    await loadSquad(teamId)
  }

  function updateMember(
    membershipId: string,
    field: 'primary_position' | 'secondary_position' | 'squad_number',
    value: string
  ) {
    setMembers(current =>
      current.map(member =>
        member.id === membershipId
          ? { ...member, [field]: value }
          : member
      )
    )
  }

  async function saveMember(member: SquadMember) {
    setSaving(member.id)
    setMessage('')

    const number = member.squad_number.trim()
      ? Number(member.squad_number)
      : null

    if (
      number !== null &&
      (!Number.isInteger(number) || number < 1 || number > 99)
    ) {
      setMessage('Squad numbers must be between 1 and 99.')
      setSaving('')
      return
    }

    const { error } = await supabase.rpc('manage_club_member', {
      p_membership_id: member.id,
      p_primary_position: member.primary_position,
      p_secondary_position: member.secondary_position || null,
      p_squad_number: number
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage(`Saved changes for ${member.gamertag}.`)
      await loadSquad(selectedTeam)
    }

    setSaving('')
  }

  async function releaseMember(member: SquadMember) {
    const confirmed = window.confirm(
      `Release ${member.gamertag} from this club?`
    )

    if (!confirmed) return

    setSaving(member.id)
    setMessage('')

    const { error } = await supabase.rpc('release_club_member', {
      p_membership_id: member.id
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage(`${member.gamertag} has been released.`)
      await loadSquad(selectedTeam)
    }

    setSaving('')
  }

  if (loading) {
    return <main className="min-h-screen bg-[#090d18] p-8 text-white">Loading squad...</main>
  }

  return (
    <main className="min-h-screen bg-[#090d18] px-5 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.25em] text-blue-400">
          NVPL CLUB MANAGEMENT
        </p>

        <h1 className="mb-3 text-4xl font-bold">Squad Management</h1>
        <p className="mb-8 text-gray-400">
          Manage your club roster, positions and squad numbers.
        </p>

        {message && (
          <div className="mb-6 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-gray-200">
            {message}
          </div>
        )}

        {teams.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
            <h2 className="mb-2 text-xl font-semibold">No club found</h2>
            <p className="text-gray-400">
              You need to own a club before you can manage its squad.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-8 max-w-sm">
              <label className="mb-2 block text-sm text-gray-400">
                Select your club
              </label>
              <select
                value={selectedTeam}
                onChange={e => changeTeam(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#151c2d] p-3 text-white"
              >
                {teams.map(team => (
                  <option key={team.id} value={team.id}>
                    {team.name} ({team.region})
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Active squad</h2>
              <span className="rounded-full bg-blue-500/15 px-4 py-2 text-sm text-blue-300">
                {members.length} players
              </span>
            </div>

            {members.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-gray-400">
                No active players are currently registered to this club.
              </div>
            ) : (
              <div className="space-y-4">
                {members.map(member => (
                  <div
                    key={member.id}
                    className="rounded-2xl border border-white/10 bg-[#111827] p-5"
                  >
                    <div className="mb-5 flex items-center gap-4">
                      {member.avatar_url ? (
                        <img
                          src={member.avatar_url}
                          alt=""
                          className="h-14 w-14 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/20 text-xl font-bold">
                          {member.gamertag.charAt(0).toUpperCase()}
                        </div>
                      )}

                      <div>
                        <h3 className="font-bold">{member.gamertag}</h3>
                        <p className="text-sm text-gray-400">
                          {member.username ? `@${member.username}` : 'No NVPL username'}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <label className="mb-2 block text-xs text-gray-400">
                          Primary position
                        </label>
                        <select
                          value={member.primary_position}
                          onChange={e =>
                            updateMember(member.id, 'primary_position', e.target.value)
                          }
                          className="w-full rounded-lg border border-white/10 bg-[#090d18] p-3 text-white"
                        >
                          {positions.map(position => (
                            <option key={position} value={position}>{position}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-2 block text-xs text-gray-400">
                          Secondary position
                        </label>
                        <select
                          value={member.secondary_position}
                          onChange={e =>
                            updateMember(member.id, 'secondary_position', e.target.value)
                          }
                          className="w-full rounded-lg border border-white/10 bg-[#090d18] p-3 text-white"
                        >
                          <option value="">None</option>
                          {positions.map(position => (
                            <option key={position} value={position}>{position}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-2 block text-xs text-gray-400">
                          Squad number
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="99"
                          value={member.squad_number}
                          onChange={e =>
                            updateMember(member.id, 'squad_number', e.target.value)
                          }
                          placeholder="1–99"
                          className="w-full rounded-lg border border-white/10 bg-[#090d18] p-3 text-white"
                        />
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        onClick={() => saveMember(member)}
                        disabled={saving === member.id}
                        className="rounded-lg bg-blue-600 px-5 py-2 font-semibold hover:bg-blue-500 disabled:opacity-50"
                      >
                        {saving === member.id ? 'Saving...' : 'Save changes'}
                      </button>

                      <button
                        onClick={() => releaseMember(member)}
                        disabled={saving === member.id}
                        className="rounded-lg border border-red-500/40 px-5 py-2 font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                      >
                        Release player
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}

