
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Props = {
  fixtureId: string
  homeTeamId: string
  awayTeamId: string
}

type EAClub = {
  goals: string
  goalsAgainst: string
  details?: {
    name?: string
    clubId?: number
  }
}

type EAMatch = {
  matchId: string
  timestamp: number
  clubs: Record<string, EAClub>
}

type Team = {
  id: string
  name: string
  ea_club_id: number | null
  ea_club_name: string | null
  ea_platform: string | null
}

type LineupPlayer = {
  name: string
  position: string
  number: string
  team: 'home' | 'away'
}

const FORMATIONS = [
  '4-3-3',
  '4-2-3-1',
  '4-1-4-1',
  '4-4-2',
  '3-5-2',
  '3-4-3',
  '5-3-2',
  '5-4-1',
]

function getClubs(match: EAMatch) {
  return Object.entries(match.clubs || {}).map(([id, club]) => ({
    id,
    name: club.details?.name || `Club ${id}`,
    goals: Number(club.goals || 0),
    goalsAgainst: Number(club.goalsAgainst || 0),
  }))
}

export default function FixtureEAReport({
  fixtureId,
  homeTeamId,
  awayTeamId,
}: Props) {
  const [homeTeam, setHomeTeam] = useState<Team | null>(null)
  const [awayTeam, setAwayTeam] = useState<Team | null>(null)
  const [matches, setMatches] = useState<EAMatch[]>([])
  const [selectedMatch, setSelectedMatch] = useState<EAMatch | null>(null)

  const [formation, setFormation] = useState('4-3-3')
  const [lineup, setLineup] = useState<LineupPlayer[]>([])
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [canManage, setCanManage] = useState(false)

  useEffect(() => {
    load()
  }, [fixtureId, homeTeamId, awayTeamId])

  async function load() {
    setLoading(true)
    setMessage('')

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setMessage('Sign in to view this report.')
      setLoading(false)
      return
    }

    const { data: teams, error } = await supabase
      .from('teams')
      .select(
        'id,name,owner_id,ea_club_id,ea_club_name,ea_platform'
      )
      .in('id', [homeTeamId, awayTeamId])

    if (error || !teams) {
      setMessage('Could not load the teams.')
      setLoading(false)
      return
    }

    const home = teams.find(t => t.id === homeTeamId)
    const away = teams.find(t => t.id === awayTeamId)

    if (!home || !away) {
      setMessage('Could not find both teams.')
      setLoading(false)
      return
    }

    setHomeTeam(home as Team)
    setAwayTeam(away as Team)

    const { data: staff } = await supabase
      .from('club_staff')
      .select('team_id')
      .eq('user_id', user.id)
      .in('team_id', [homeTeamId, awayTeamId])

    const { data: admin } = await supabase.rpc(
      'nvpl_can_manage_competitions'
    )

    const manager =
      home.owner_id === user.id ||
      away.owner_id === user.id ||
      (staff?.length || 0) > 0 ||
      admin === true

    setCanManage(manager)

    const { data: report } = await supabase
      .from('nvpl_fixture_match_reports')
      .select('*')
      .eq('fixture_id', fixtureId)
      .maybeSingle()

    if (report) {
      setFormation(report.formation || '4-3-3')
      setLineup(report.lineup || [])
      setNotes(report.report_notes || '')
    }

    setLoading(false)
  }

  async function findMatches() {
    if (!homeTeam?.ea_club_id || !awayTeam?.ea_club_id) {
      setMessage('Both teams must link their EA clubs in Team Settings.')
      return
    }

    if (
      !homeTeam.ea_platform ||
      homeTeam.ea_platform !== awayTeam.ea_platform
    ) {
      setMessage('Both teams must use the same EA platform.')
      return
    }

    setSearching(true)
    setMessage('')
    setSelectedMatch(null)

    try {
      const params = new URLSearchParams({
        mode: 'fixtureMatches',
        homeClubId: String(homeTeam.ea_club_id),
        awayClubId: String(awayTeam.ea_club_id),
        platform: homeTeam.ea_platform,
      })

      const response = await fetch(`/api/eafc?${params}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'EA match search failed.')
      }

      setMatches(result.matches || [])

      if (!result.matches?.length) {
        setMessage(
          'No shared EA matches found in the recent match history.'
        )
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not retrieve EA matches.'
      )
    }

    setSearching(false)
  }

  function addPlayer(team: 'home' | 'away') {
    setLineup(current => [
      ...current,
      {
        name: '',
        position: '',
        number: '',
        team,
      },
    ])
  }

  function updatePlayer(
    index: number,
    field: keyof LineupPlayer,
    value: string
  ) {
    setLineup(current =>
      current.map((player, i) =>
        i === index ? { ...player, [field]: value } : player
      )
    )
  }

  function removePlayer(index: number) {
    setLineup(current => current.filter((_, i) => i !== index))
  }

  async function saveReport() {
    if (!canManage) {
      setMessage('You do not have permission to edit this report.')
      return
    }

    setSaving(true)
    setMessage('')

    const { error } = await supabase.rpc(
      'nvpl_save_fixture_match_report',
      {
        p_fixture_id: fixtureId,
        p_formation: formation,
        p_lineup: lineup,
        p_player_stats: [],
        p_report_notes: notes,
      }
    )

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Match report saved successfully.')
    }

    setSaving(false)
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-[#080b12] p-5 text-gray-400">
        Loading EA match report...
      </div>
    )
  }

  if (!homeTeam || !awayTeam) {
    return null
  }

  return (
    <section className="space-y-5 rounded-2xl border border-white/10 bg-[#080b12] p-5 text-white">
      <div>
        <h2 className="text-xl font-bold">EA FC Match Report</h2>
        <p className="mt-1 text-sm text-gray-400">
          Linked club match data and official lineup.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {[homeTeam, awayTeam].map(team => (
          <div
            key={team.id}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
          >
            <p className="text-xs uppercase text-gray-500">
              {team.id === homeTeamId ? 'Home team' : 'Away team'}
            </p>
            <p className="mt-1 font-semibold">{team.name}</p>
            <p className="mt-1 text-sm text-gray-400">
              {team.ea_club_name || 'EA club not linked'}
            </p>
            <p className="text-xs text-gray-500">
              {team.ea_club_id
                ? `EA ID: ${team.ea_club_id}`
                : 'No EA club ID'}
            </p>
          </div>
        ))}
      </div>

      <button
        onClick={findMatches}
        disabled={searching || !canManage}
        className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-500 disabled:opacity-50"
      >
        {searching ? 'Searching EA match history...' : 'Find EA Matches'}
      </button>

      {message && (
        <p className="rounded-lg bg-white/5 p-3 text-sm text-gray-300">
          {message}
        </p>
      )}

      {matches.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold">Matching EA Games</h3>

          {matches.map(match => {
            const clubs = getClubs(match)
            const home = clubs.find(
              club => club.id === String(homeTeam.ea_club_id)
            )
            const away = clubs.find(
              club => club.id === String(awayTeam.ea_club_id)
            )

            if (!home || !away) return null

            return (
              <button
                key={match.matchId}
                onClick={() => setSelectedMatch(match)}
                className={`w-full rounded-xl border p-4 text-left ${
                  selectedMatch?.matchId === match.matchId
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-white/10 bg-white/[0.03]'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{home.name}</p>
                    <p className="text-xs text-gray-500">Home</p>
                  </div>

                  <div className="text-xl font-bold tabular-nums">
                    {home.goals} - {away.goals}
                  </div>

                  <div className="min-w-0 flex-1 text-right">
                    <p className="truncate font-semibold">{away.name}</p>
                    <p className="text-xs text-gray-500">Away</p>
                  </div>
                </div>

                <p className="mt-3 text-xs text-gray-500">
                  Match ID: {match.matchId}
                  {' · '}
                  {new Date(match.timestamp * 1000).toLocaleString()}
                </p>
              </button>
            )
          })}
        </div>
      )}

      {selectedMatch && (
        <div className="space-y-4 rounded-xl border border-blue-500/30 bg-blue-500/5 p-4">
          <h3 className="font-bold">Selected EA Match</h3>

          {(() => {
            const clubs = getClubs(selectedMatch)
            const home = clubs.find(
              c => c.id === String(homeTeam.ea_club_id)
            )
            const away = clubs.find(
              c => c.id === String(awayTeam.ea_club_id)
            )

            return (
              <div className="flex items-center justify-between gap-3 text-center">
                <p className="flex-1 font-semibold">{home?.name}</p>
                <p className="text-3xl font-black">
                  {home?.goals} - {away?.goals}
                </p>
                <p className="flex-1 font-semibold">{away?.name}</p>
              </div>
            )
          })()}

          <p className="text-xs text-gray-400">
            EA match selected. This does not submit or confirm the official NVPL result.
            Use your existing result-submission process for that.
          </p>
        </div>
      )}

      <div className="space-y-4 border-t border-white/10 pt-5">
        <h3 className="font-bold">Formation & Lineup</h3>

        <label className="block text-sm text-gray-400">
          Formation
          <select
            value={formation}
            onChange={e => setFormation(e.target.value)}
            disabled={!canManage}
            className="mt-2 w-full rounded-lg border border-white/10 bg-[#111827] p-3 text-white"
          >
            {FORMATIONS.map(value => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <div className="space-y-3">
          {(['home', 'away'] as const).map(team => (
            <div key={team} className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">
                  {team === 'home' ? homeTeam.name : awayTeam.name}
                </h4>

                <button
                  onClick={() => addPlayer(team)}
                  disabled={!canManage}
                  className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20 disabled:opacity-50"
                >
                  + Add player
                </button>
              </div>

              {lineup.map((player, index) => {
                if (player.team !== team) return null

                return (
                  <div
                    key={`${team}-${index}`}
                    className="grid grid-cols-1 gap-2 rounded-lg border border-white/10 p-3 sm:grid-cols-[1fr_110px_75px_auto]"
                  >
                    <input
                      value={player.name}
                      onChange={e =>
                        updatePlayer(index, 'name', e.target.value)
                      }
                      placeholder="Player name"
                      disabled={!canManage}
                      className="min-w-0 rounded-lg bg-white/5 p-2 text-sm"
                    />

                    <input
                      value={player.position}
                      onChange={e =>
                        updatePlayer(index, 'position', e.target.value)
                      }
                      placeholder="Position"
                      disabled={!canManage}
                      className="rounded-lg bg-white/5 p-2 text-sm"
                    />

                    <input
                      value={player.number}
                      onChange={e =>
                        updatePlayer(index, 'number', e.target.value)
                      }
                      placeholder="Number"
                      disabled={!canManage}
                      className="rounded-lg bg-white/5 p-2 text-sm"
                    />

                    <button
                      onClick={() => removePlayer(index)}
                      disabled={!canManage}
                      className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <label className="block text-sm text-gray-400">
          Match notes
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            disabled={!canManage}
            placeholder="Add match notes..."
            rows={3}
            className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 p-3 text-white"
          />
        </label>

        <button
          onClick={saveReport}
          disabled={!canManage || saving}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-500 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Match Report'}
        </button>
      </div>
    </section>
  )
}
