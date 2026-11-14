
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Competition = {
  id: string
  name: string
  region: string
  division: string
}

type Team = {
  id: string
  [key: string]: unknown
}

type Standing = {
  team_id: string
  played: number
  wins: number
  draws: number
  losses: number
  goals_for: number
  goals_against: number
  goal_difference: number
  points: number
}

const inputClass =
  'w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white'

function getTeamName(team?: Team) {
  if (!team) return 'Unknown team'

  for (const key of ['name', 'team_name', 'club_name', 'display_name']) {
    const value = team[key]
    if (typeof value === 'string' && value.trim()) return value
  }

  return `Team ${team.id.slice(0, 8)}`
}

export default function StandingsAdminPage() {
  const router = useRouter()

  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [standings, setStandings] = useState<Standing[]>([])

  const [competitionId, setCompetitionId] = useState('')
  const [kickoff, setKickoff] = useState('')
  const [daysBetween, setDaysBetween] = useState(7)
  const [doubleRound, setDoubleRound] = useState(true)

  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [allowed, setAllowed] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState(false)

  const loadStandings = useCallback(async (id: string) => {
    if (!id) {
      setStandings([])
      return
    }

    const { data, error } = await supabase.rpc(
      'nvpl_get_league_table',
      { p_competition_id: id }
    )

    if (error) {
      setMessage(error.message)
      setErrorMessage(true)
      return
    }

    setStandings((data || []) as Standing[])
  }, [])

  const loadInitialData = useCallback(async () => {
    const [competitionResult, teamResult] = await Promise.all([
      supabase
        .from('competitions')
        .select('*')
        .order('created_at', { ascending: false }),

      supabase
        .from('teams')
        .select('*'),
    ])

    if (competitionResult.error || teamResult.error) {
      setMessage(
        competitionResult.error?.message ||
        teamResult.error?.message ||
        'Could not load data.'
      )
      setErrorMessage(true)
      setLoading(false)
      return
    }

    const competitionData =
      (competitionResult.data || []) as Competition[]

    setCompetitions(competitionData)
    setTeams((teamResult.data || []) as Team[])

    if (competitionData.length > 0) {
      setCompetitionId(competitionData[0].id)
      await loadStandings(competitionData[0].id)
    }

    setLoading(false)
  }, [loadStandings])

  useEffect(() => {
    async function initialise() {
      const { data: authData, error: authError } =
        await supabase.auth.getUser()

      if (authError || !authData.user) {
        router.replace('/login')
        return
      }

      const { data, error } = await supabase.rpc(
        'nvpl_can_manage_competitions'
      )

      if (error || data !== true) {
        setAllowed(false)
        setLoading(false)
        return
      }

      setAllowed(true)
      await loadInitialData()
    }

    initialise()
  }, [router, loadInitialData])

  async function selectCompetition(id: string) {
    setCompetitionId(id)
    setMessage('')
    await loadStandings(id)
  }

  async function generateFixtures() {
    if (!competitionId || !kickoff) {
      setMessage('Select a competition and first kickoff date.')
      setErrorMessage(true)
      return
    }

    if (daysBetween < 1 || daysBetween > 90) {
      setMessage('Days between matchweeks must be between 1 and 90.')
      setErrorMessage(true)
      return
    }

    if (!window.confirm(
      'Generate a complete round-robin schedule? This cannot be repeated if fixtures already exist for this competition.'
    )) return

    setGenerating(true)
    setMessage('')
    setErrorMessage(false)

    const { data, error } = await supabase.rpc(
      'nvpl_generate_round_robin',
      {
        p_competition_id: competitionId,
        p_first_kickoff: new Date(kickoff).toISOString(),
        p_days_between: daysBetween,
        p_double_round_robin: doubleRound,
      }
    )

    if (error) {
      setMessage(error.message)
      setErrorMessage(true)
    } else {
      setMessage(`${data} fixtures generated successfully.`)
      await loadStandings(competitionId)
    }

    setGenerating(false)
  }

  const teamCount = standings.length
  const fixtureCount = standings.reduce(
    (total, item) => total + Number(item.played), 0
  ) / 2

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 text-white p-8">
        Loading league tables...
      </main>
    )
  }

  if (!allowed) {
    return (
      <main className="min-h-screen bg-gray-950 text-white p-8">
        <h1 className="text-2xl font-bold">Access denied</h1>
        <p className="text-gray-400 mt-2">
          Competition Admin or Super Admin access is required.
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
              Fixtures & League Tables
            </h1>
            <p className="text-gray-400 mt-2">
              Generate schedules and monitor competition standings.
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
          <div className={`rounded-lg p-4 mb-6 border ${
            errorMessage
              ? 'bg-red-950/40 border-red-800 text-red-300'
              : 'bg-green-950/40 border-green-800 text-green-300'
          }`}>
            {message}
          </div>
        )}

        <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
          <h2 className="text-2xl font-bold mb-5">
            Automatic fixture generation
          </h2>

          {competitions.length === 0 ? (
            <p className="text-gray-400">
              Create a competition before generating fixtures.
            </p>
          ) : (
            <div className="space-y-4">

              <label className="block text-sm text-gray-400">
                Competition
                <select
                  value={competitionId}
                  onChange={e => selectCompetition(e.target.value)}
                  className={`${inputClass} mt-2`}
                >
                  {competitions.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} — {item.region} — {item.division}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm text-gray-400">
                First matchweek kickoff
                <input
                  type="datetime-local"
                  value={kickoff}
                  onChange={e => setKickoff(e.target.value)}
                  className={`${inputClass} mt-2`}
                />
              </label>

              <label className="block text-sm text-gray-400">
                Days between matchweeks
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={daysBetween}
                  onChange={e => setDaysBetween(Number(e.target.value))}
                  className={`${inputClass} mt-2`}
                />
              </label>

              <label className="flex items-center gap-3 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={doubleRound}
                  onChange={e => setDoubleRound(e.target.checked)}
                  className="w-4 h-4"
                />
                Home and away fixtures (double round robin)
              </label>

              <button
                type="button"
                onClick={generateFixtures}
                disabled={generating || !kickoff}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg px-6 py-3 font-semibold"
              >
                {generating ? 'Generating...' : 'Generate fixtures'}
              </button>

              <p className="text-xs text-gray-500">
                Generation requires at least two teams with an approved,
                accepted, registered or active competition registration.
                Existing fixtures prevent another generation.
              </p>
            </div>
          )}
        </section>

        <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex flex-wrap justify-between gap-3 items-center mb-5">
            <div>
              <h2 className="text-2xl font-bold">League table</h2>
              <p className="text-sm text-gray-400 mt-1">
                {teamCount} registered teams · {fixtureCount || 0} completed matches
              </p>
            </div>

            <button
              onClick={() => loadStandings(competitionId)}
              className="bg-gray-800 hover:bg-gray-700 rounded-lg px-4 py-2"
            >
              Refresh table
            </button>
          </div>

          {standings.length === 0 ? (
            <p className="text-gray-400 py-8 text-center">
              No registered teams found for this competition.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-gray-400 border-b border-gray-700">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Club</th>
                    <th className="p-3 text-center">P</th>
                    <th className="p-3 text-center">W</th>
                    <th className="p-3 text-center">D</th>
                    <th className="p-3 text-center">L</th>
                    <th className="p-3 text-center">GF</th>
                    <th className="p-3 text-center">GA</th>
                    <th className="p-3 text-center">GD</th>
                    <th className="p-3 text-center font-bold">Pts</th>
                  </tr>
                </thead>

                <tbody>
                  {standings.map((item, index) => (
                    <tr
                      key={item.team_id}
                      className="border-b border-gray-800 hover:bg-gray-800/50"
                    >
                      <td className="p-3 font-bold">{index + 1}</td>
                      <td className="p-3 font-semibold">
                        {getTeamName(
                          teams.find(team => team.id === item.team_id)
                        )}
                      </td>
                      <td className="p-3 text-center">{item.played}</td>
                      <td className="p-3 text-center">{item.wins}</td>
                      <td className="p-3 text-center">{item.draws}</td>
                      <td className="p-3 text-center">{item.losses}</td>
                      <td className="p-3 text-center">{item.goals_for}</td>
                      <td className="p-3 text-center">{item.goals_against}</td>
                      <td className="p-3 text-center">{item.goal_difference}</td>
                      <td className="p-3 text-center font-bold text-blue-400">
                        {item.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-gray-500 mt-4">
            Standings update from fixtures marked completed. Points:
            3 for a win, 1 for a draw and 0 for a loss.
            Tiebreakers: goal difference, then goals scored.
          </p>
        </section>

        <div className="mt-6">
          <Link
            href="/admin/fixtures"
            className="text-blue-400 hover:underline"
          >
            Open individual fixture management →
          </Link>
        </div>

      </div>
    </main>
  )
}
