
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Competition = {
  id: string
  name: string
  region: string
  season: string
  division: string
}

type Team = {
  id: string
  [key: string]: unknown
}

type Fixture = {
  id: string
  competition_id: string
  home_team_id: string
  away_team_id: string
  matchweek: number
  kickoff_at: string
  status: string
  home_score: number | null
  away_score: number | null
}

const inputClass =
  'w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white'

function teamName(team?: Team) {
  if (!team) return 'Unknown team'

  const possibleNames = [
    'name',
    'team_name',
    'club_name',
    'gamertag',
    'display_name',
  ]

  for (const key of possibleNames) {
    const value = team[key]

    if (typeof value === 'string' && value.trim()) {
      return value
    }
  }

  return `Team ${team.id.slice(0, 8)}`
}

export default function FixtureAdminPage() {
  const router = useRouter()

  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [fixtures, setFixtures] = useState<Fixture[]>([])

  const [competitionId, setCompetitionId] = useState('')
  const [homeTeam, setHomeTeam] = useState('')
  const [awayTeam, setAwayTeam] = useState('')
  const [matchweek, setMatchweek] = useState(1)
  const [kickoff, setKickoff] = useState('')

  const [search, setSearch] = useState('')
  const [filterCompetition, setFilterCompetition] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  const [scores, setScores] = useState<
    Record<string, { home: string; away: string }>
  >({})

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [allowed, setAllowed] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState(false)

  const loadData = useCallback(async () => {
    const [competitionResult, teamResult, fixtureResult] =
      await Promise.all([
        supabase
          .from('competitions')
          .select('*')
          .order('created_at', { ascending: false }),

        supabase
          .from('teams')
          .select('*'),

        supabase
          .from('nvpl_fixtures')
          .select('*')
          .order('kickoff_at', { ascending: true }),
      ])

    const failed =
      competitionResult.error ||
      teamResult.error ||
      fixtureResult.error

    if (failed) {
      setMessage(failed.message)
      setErrorMessage(true)
      setLoading(false)
      return
    }

    const competitionData =
      (competitionResult.data || []) as Competition[]

    const teamData = (teamResult.data || []) as Team[]
    const fixtureData = (fixtureResult.data || []) as Fixture[]

    setCompetitions(competitionData)
    setTeams(teamData)
    setFixtures(fixtureData)

    if (!competitionId && competitionData.length > 0) {
      setCompetitionId(competitionData[0].id)
    }

    setLoading(false)
  }, [competitionId])

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
      await loadData()
    }

    initialise()
  }, [router, loadData])

  function showMessage(messageText: string, isError = false) {
    setMessage(messageText)
    setErrorMessage(isError)
  }

  async function createFixture(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!competitionId || !homeTeam || !awayTeam || !kickoff) {
      showMessage('Complete all fixture fields.', true)
      return
    }

    if (homeTeam === awayTeam) {
      showMessage('A team cannot play against itself.', true)
      return
    }

    if (!Number.isInteger(matchweek) || matchweek < 1) {
      showMessage('Enter a valid matchweek.', true)
      return
    }

    setSaving(true)
    setMessage('')

    const { error } = await supabase
      .from('nvpl_fixtures')
      .insert({
        competition_id: competitionId,
        home_team_id: homeTeam,
        away_team_id: awayTeam,
        matchweek,
        kickoff_at: new Date(kickoff).toISOString(),
        status: 'scheduled',
      })

    if (error) {
      showMessage(error.message, true)
    } else {
      showMessage('Fixture created successfully.')
      setHomeTeam('')
      setAwayTeam('')
      setKickoff('')
      await loadData()
    }

    setSaving(false)
  }

  async function updateScore(fixture: Fixture) {
    const score = scores[fixture.id]

    if (!score || score.home === '' || score.away === '') {
      showMessage('Enter both scores.', true)
      return
    }

    const home = Number(score.home)
    const away = Number(score.away)

    if (
      !Number.isInteger(home) ||
      !Number.isInteger(away) ||
      home < 0 ||
      away < 0
    ) {
      showMessage('Scores must be non-negative whole numbers.', true)
      return
    }

    setSaving(true)

    const { error } = await supabase
      .from('nvpl_fixtures')
      .update({
        home_score: home,
        away_score: away,
        status: 'completed',
      })
      .eq('id', fixture.id)

    if (error) {
      showMessage(error.message, true)
    } else {
      showMessage('Result saved and fixture marked completed.')
      await loadData()
    }

    setSaving(false)
  }

  async function updateStatus(id: string, status: string) {
    setSaving(true)

    const { error } = await supabase
      .from('nvpl_fixtures')
      .update({ status })
      .eq('id', id)

    if (error) {
      showMessage(error.message, true)
    } else {
      showMessage('Fixture status updated.')
      await loadData()
    }

    setSaving(false)
  }

  function getCompetitionName(id: string) {
    return competitions.find(item => item.id === id)?.name ||
      'Unknown competition'
  }

  function getTeamName(id: string) {
    return teamName(teams.find(item => item.id === id))
  }

  const filteredFixtures = fixtures.filter(fixture => {
    const matchesCompetition =
      filterCompetition === 'all' ||
      fixture.competition_id === filterCompetition

    const matchesStatus =
      filterStatus === 'all' ||
      fixture.status === filterStatus

    const query = search.toLowerCase()

    const matchesSearch =
      getTeamName(fixture.home_team_id).toLowerCase().includes(query) ||
      getTeamName(fixture.away_team_id).toLowerCase().includes(query) ||
      getCompetitionName(fixture.competition_id)
        .toLowerCase()
        .includes(query)

    return matchesCompetition && matchesStatus && matchesSearch
  })

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 text-white p-8">
        Loading fixture management...
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
              Fixture Management
            </h1>
            <p className="text-gray-400 mt-2">
              Create fixtures, schedule matches and manage results.
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
            errorMessage
              ? 'bg-red-950/40 border-red-800 text-red-300'
              : 'bg-green-950/40 border-green-800 text-green-300'
          }`}>
            {message}
          </div>
        )}

        <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
          <h2 className="text-2xl font-bold mb-5">
            Create fixture
          </h2>

          {competitions.length === 0 || teams.length < 2 ? (
            <p className="text-yellow-400">
              You need at least one competition and two teams before creating fixtures.
            </p>
          ) : (
            <form onSubmit={createFixture} className="space-y-5">

              <label className="block text-sm text-gray-400">
                Competition
                <select
                  value={competitionId}
                  onChange={e => setCompetitionId(e.target.value)}
                  className={`${inputClass} mt-2`}
                  required
                >
                  {competitions.map(competition => (
                    <option key={competition.id} value={competition.id}>
                      {competition.name} — {competition.region} — {competition.division}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block text-sm text-gray-400">
                  Home team
                  <select
                    value={homeTeam}
                    onChange={e => setHomeTeam(e.target.value)}
                    className={`${inputClass} mt-2`}
                    required
                  >
                    <option value="">Select home team</option>
                    {teams.map(team => (
                      <option key={team.id} value={team.id}>
                        {teamName(team)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm text-gray-400">
                  Away team
                  <select
                    value={awayTeam}
                    onChange={e => setAwayTeam(e.target.value)}
                    className={`${inputClass} mt-2`}
                    required
                  >
                    <option value="">Select away team</option>
                    {teams.map(team => (
                      <option key={team.id} value={team.id}>
                        {teamName(team)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block text-sm text-gray-400">
                  Matchweek
                  <input
                    type="number"
                    min="1"
                    value={matchweek}
                    onChange={e => setMatchweek(Number(e.target.value))}
                    className={`${inputClass} mt-2`}
                    required
                  />
                </label>

                <label className="block text-sm text-gray-400">
                  Kickoff date and time
                  <input
                    type="datetime-local"
                    value={kickoff}
                    onChange={e => setKickoff(e.target.value)}
                    className={`${inputClass} mt-2`}
                    required
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg px-6 py-3 font-semibold"
              >
                {saving ? 'Creating...' : 'Create fixture'}
              </button>
            </form>
          )}
        </section>

        <section>
          <div className="flex flex-wrap justify-between items-center gap-4 mb-5">
            <div>
              <h2 className="text-2xl font-bold">All fixtures</h2>
              <p className="text-gray-400 text-sm mt-1">
                {filteredFixtures.length} fixtures displayed
              </p>
            </div>

            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search teams or competitions..."
              className="bg-gray-800 border border-gray-700 rounded-lg p-3"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <select
              value={filterCompetition}
              onChange={e => setFilterCompetition(e.target.value)}
              className={inputClass}
            >
              <option value="all">All competitions</option>
              {competitions.map(competition => (
                <option key={competition.id} value={competition.id}>
                  {competition.name}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className={inputClass}
            >
              <option value="all">All statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="live">Live</option>
              <option value="completed">Completed</option>
              <option value="postponed">Postponed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {filteredFixtures.length === 0 ? (
            <div className="bg-gray-900 rounded-xl p-8 text-center text-gray-400">
              No fixtures found.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredFixtures.map(fixture => (
                <div
                  key={fixture.id}
                  className="bg-gray-900 border border-gray-800 rounded-xl p-5"
                >
                  <div className="flex flex-wrap justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-blue-400 text-sm font-semibold">
                        {getCompetitionName(fixture.competition_id)}
                      </p>

                      <p className="text-gray-500 text-xs mt-1">
                        Matchweek {fixture.matchweek}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 mt-4">
                        <span className="font-semibold">
                          {getTeamName(fixture.home_team_id)}
                        </span>

                        <span className="text-xl font-bold">
                          {fixture.home_score ?? '-'} : {fixture.away_score ?? '-'}
                        </span>

                        <span className="font-semibold">
                          {getTeamName(fixture.away_team_id)}
                        </span>
                      </div>

                      <p className="text-xs text-gray-500 mt-3">
                        {new Date(fixture.kickoff_at).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 min-w-48">
                      <select
                        value={fixture.status}
                        onChange={e => updateStatus(fixture.id, e.target.value)}
                        disabled={saving}
                        className="bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm"
                      >
                        <option value="scheduled">Scheduled</option>
                        <option value="live">Live</option>
                        <option value="completed">Completed</option>
                        <option value="postponed">Postponed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>

                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          min="0"
                          placeholder="Home"
                          value={scores[fixture.id]?.home ?? ''}
                          onChange={e => setScores(previous => ({
                            ...previous,
                            [fixture.id]: {
                              home: e.target.value,
                              away: previous[fixture.id]?.away ?? '',
                            },
                          }))}
                          className="bg-gray-800 border border-gray-700 rounded-lg p-2 w-full"
                        />

                        <input
                          type="number"
                          min="0"
                          placeholder="Away"
                          value={scores[fixture.id]?.away ?? ''}
                          onChange={e => setScores(previous => ({
                            ...previous,
                            [fixture.id]: {
                              home: previous[fixture.id]?.home ?? '',
                              away: e.target.value,
                            },
                          }))}
                          className="bg-gray-800 border border-gray-700 rounded-lg p-2 w-full"
                        />
                      </div>

                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => updateScore(fixture)}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg p-2 text-sm font-semibold"
                      >
                        Save result
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </main>
  )
}
