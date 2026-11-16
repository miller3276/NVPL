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
  season: string
}

export default function FixturesPage() {
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function load() {
      const [fixtureResult, teamResult, competitionResult] = await Promise.all([
        supabase
          .from('nvpl_fixtures')
          .select('id, competition_id, home_team_id, away_team_id, matchweek, kickoff_at, status, home_score, away_score')
          .order('kickoff_at', { ascending: true }),
        supabase
          .from('teams')
          .select('id, name, abbreviation'),
        supabase
          .from('competitions')
          .select('id, name, region, season')
      ])

      if (fixtureResult.error || teamResult.error || competitionResult.error) {
        setMessage(
          fixtureResult.error?.message ||
          teamResult.error?.message ||
          competitionResult.error?.message ||
          'Could not load fixtures.'
        )
      } else {
        setFixtures(fixtureResult.data || [])
        setTeams(teamResult.data || [])
        setCompetitions(competitionResult.data || [])
      }

      setLoading(false)
    }

    load()
  }, [])

  function teamName(id: string) {
    const team = teams.find(team => team.id === id)
    return team ? `${team.name} (${team.abbreviation})` : 'Unknown club'
  }

  function competitionName(id: string) {
    return competitions.find(item => item.id === id)?.name || 'Competition'
  }

  const visibleFixtures = fixtures.filter(fixture => {
    if (filter === 'all') return true
    return fixture.status === filter
  })

  return (
    <main className="min-h-screen bg-[#080b14] text-white px-5 py-10">
      <div className="max-w-5xl mx-auto">
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white">
          ← Back to dashboard
        </Link>

        <div className="mt-8 mb-8">
          <p className="text-sm tracking-[0.25em] text-blue-400 font-semibold">
            NATIONAL VIRTUAL PRO LEAGUE
          </p>
          <h1 className="text-4xl font-bold mt-2">Fixtures & results</h1>
          <p className="text-gray-400 mt-2">
            View scheduled matches, completed fixtures and match discussions.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { value: 'all', label: 'All fixtures' },
            { value: 'scheduled', label: 'Upcoming' },
            { value: 'completed', label: 'Completed' },
            { value: 'cancelled', label: 'Cancelled' }
          ].map(option => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              className={`rounded-lg px-4 py-2 text-sm ${
                filter === option.value
                  ? 'bg-blue-600 text-white'
                  : 'border border-white/10 text-gray-300 hover:bg-white/5'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {message && (
          <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm">
            {message}
          </div>
        )}

        {loading ? (
          <p className="text-gray-400">Loading fixtures...</p>
        ) : visibleFixtures.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-gray-400">
            No fixtures to display.
          </div>
        ) : (
          <div className="space-y-4">
            {visibleFixtures.map(fixture => (
              <article
                key={fixture.id}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
              >
                <div className="flex flex-wrap justify-between gap-2 text-xs text-blue-400 mb-5">
                  <span>{competitionName(fixture.competition_id)}</span>
                  <span>Matchweek {fixture.matchweek}</span>
                </div>

                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <div className="text-right">
                    <p className="font-bold">{teamName(fixture.home_team_id)}</p>
                    <p className="text-xs text-gray-500">Home</p>
                  </div>

                  <div className="rounded-xl bg-black/30 px-4 py-3 text-center min-w-20">
                    {fixture.status === 'completed' &&
                    fixture.home_score !== null &&
                    fixture.away_score !== null ? (
                      <p className="text-2xl font-bold tabular-nums">
                        {fixture.home_score} - {fixture.away_score}
                      </p>
                    ) : (
                      <p className="font-bold text-gray-400">VS</p>
                    )}
                  </div>

                  <div>
                    <p className="font-bold">{teamName(fixture.away_team_id)}</p>
                    <p className="text-xs text-gray-500">Away</p>
                  </div>
                </div>

                <div className="flex flex-wrap justify-between items-center gap-3 mt-5 border-t border-white/10 pt-4">
                  <div className="text-xs text-gray-400">
                    <p>{new Date(fixture.kickoff_at).toLocaleString('en-AU')}</p>
                    <p className="mt-1">{fixture.status.toUpperCase()}</p>
                  </div>

                  <Link
                    href={`/fixtures/${fixture.id}`}
                    className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition"
                  >
                    Match Thread →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}