
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

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

type Team = {
  id: string
  name: string
  abbreviation: string
}

type Competition = {
  id: string
  name: string
  region: string
}

export default function AdminResultsPage() {
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [fixtureId, setFixtureId] = useState('')
  const [homeScore, setHomeScore] = useState('')
  const [awayScore, setAwayScore] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function loadData() {
    setLoading(true)

    const [fixtureResult, teamResult, competitionResult] = await Promise.all([
      supabase
        .from('nvpl_fixtures')
        .select('id, competition_id, home_team_id, away_team_id, matchweek, kickoff_at, status, home_score, away_score')
        .neq('status', 'cancelled')
        .order('kickoff_at', { ascending: false }),
      supabase.from('teams').select('id, name, abbreviation'),
      supabase.from('competitions').select('id, name, region')
    ])

    if (fixtureResult.error || teamResult.error || competitionResult.error) {
      setMessage(
        fixtureResult.error?.message ||
        teamResult.error?.message ||
        competitionResult.error?.message ||
        'Could not load results.'
      )
    } else {
      setFixtures(fixtureResult.data || [])
      setTeams(teamResult.data || [])
      setCompetitions(competitionResult.data || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const selectedFixture = fixtures.find(fixture => fixture.id === fixtureId)

  function teamName(id: string) {
    const team = teams.find(item => item.id === id)
    return team ? `${team.name} (${team.abbreviation})` : 'Unknown club'
  }

  function competitionName(id: string) {
    return competitions.find(item => item.id === id)?.name || 'Competition'
  }

  async function submitResult(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!fixtureId || homeScore === '' || awayScore === '') {
      setMessage('Choose a fixture and enter both scores.')
      return
    }

    setBusy(true)
    setMessage('')

    const { error } = await supabase.rpc('submit_nvpl_match_result', {
      p_fixture_id: fixtureId,
      p_home_score: Number(homeScore),
      p_away_score: Number(awayScore)
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Match result saved. League standings have updated.')
      setFixtureId('')
      setHomeScore('')
      setAwayScore('')
      await loadData()
    }

    setBusy(false)
  }

  return (
    <main className="min-h-screen bg-[#080b14] text-white px-5 py-10">
      <div className="max-w-5xl mx-auto">
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white">
          ← Back to dashboard
        </Link>

        <div className="mt-8 mb-8">
          <p className="text-sm tracking-[0.25em] text-blue-400 font-semibold">
            NVPL ADMINISTRATION
          </p>
          <h1 className="text-4xl font-bold mt-2">Match results</h1>
          <p className="text-gray-400 mt-2">
            Enter or correct scores for scheduled matches.
          </p>
        </div>

        {message && (
          <div className="mb-6 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-sm">
            {message}
          </div>
        )}

        {loading ? (
          <p className="text-gray-400">Loading matches...</p>
        ) : (
          <>
            <form
              onSubmit={submitResult}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 space-y-5"
            >
              <h2 className="text-2xl font-bold">Submit a result</h2>

              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  Select fixture
                </label>
                <select
                  required
                  value={fixtureId}
                  onChange={event => {
                    const id = event.target.value
                    setFixtureId(id)
                    const fixture = fixtures.find(item => item.id === id)
                    setHomeScore(
                      fixture?.home_score === null || fixture?.home_score === undefined
                        ? ''
                        : String(fixture.home_score)
                    )
                    setAwayScore(
                      fixture?.away_score === null || fixture?.away_score === undefined
                        ? ''
                        : String(fixture.away_score)
                    )
                  }}
                  className="w-full rounded-lg border border-white/10 bg-[#111827] p-3"
                >
                  <option value="">Choose a match</option>
                  {fixtures.map(fixture => (
                    <option key={fixture.id} value={fixture.id}>
                      {competitionName(fixture.competition_id)} — MW {fixture.matchweek} — {teamName(fixture.home_team_id)} vs {teamName(fixture.away_team_id)}
                    </option>
                  ))}
                </select>
              </div>

              {selectedFixture && (
                <div className="rounded-xl bg-black/20 p-4 text-sm text-gray-300">
                  <p>{teamName(selectedFixture.home_team_id)} vs {teamName(selectedFixture.away_team_id)}</p>
                  <p className="text-gray-500 mt-1">
                    {new Date(selectedFixture.kickoff_at).toLocaleString('en-AU')}
                  </p>
                  <p className="text-xs text-blue-400 mt-2">
                    Current status: {selectedFixture.status}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-2">
                    Home score
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={homeScore}
                    onChange={event => setHomeScore(event.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-[#111827] p-3"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-2">
                    Away score
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={awayScore}
                    onChange={event => setAwayScore(event.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-[#111827] p-3"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={busy || !fixtureId || homeScore === '' || awayScore === ''}
                className="rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500 disabled:opacity-50"
              >
                {busy ? 'Saving...' : 'Save match result'}
              </button>
            </form>

            <div className="mt-10">
              <h2 className="text-2xl font-bold mb-4">Recent results</h2>
              <div className="space-y-3">
                {fixtures.filter(fixture => fixture.status === 'completed').map(fixture => (
                  <div key={fixture.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex flex-wrap justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {teamName(fixture.home_team_id)} {fixture.home_score} - {fixture.away_score} {teamName(fixture.away_team_id)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {competitionName(fixture.competition_id)} · Matchweek {fixture.matchweek}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFixtureId(fixture.id)
                        setHomeScore(String(fixture.home_score ?? ''))
                        setAwayScore(String(fixture.away_score ?? ''))
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                      className="text-sm text-blue-400 hover:text-blue-300"
                    >
                      Edit result
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
