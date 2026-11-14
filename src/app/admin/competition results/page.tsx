
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Competition = {
  id: string
  name: string
  division: string
  season: string
}

type Fixture = {
  id: string
  competition_id: string
  home_team_id: string
  away_team_id: string
  home_score: number | null
  away_score: number | null
  kickoff_at: string
  matchweek: number
  status: string
}

type Score = {
  home: string
  away: string
}

export default function CompetitionResultsPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [competitionId, setCompetitionId] = useState('')
  const [scores, setScores] = useState<Record<string, Score>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)

  async function loadPage() {
    setLoading(true)
    setError('')

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser()

      if (authError || !authData.user) {
        throw new Error('Please log in first.')
      }

      const { data: admin, error: adminError } = await supabase
        .from('nvpl_admins')
        .select('user_id')
        .eq('user_id', authData.user.id)
        .maybeSingle()

      if (adminError) throw adminError

      if (!admin) {
        setIsAdmin(false)
        throw new Error('You do not have admin access.')
      }

      setIsAdmin(true)

      const { data: competitionData, error: competitionError } =
        await supabase
          .from('competitions')
          .select('id, name, division, season')
          .order('created_at', { ascending: false })

      if (competitionError) throw competitionError

      const list = (competitionData || []) as Competition[]
      setCompetitions(list)

      const selected = competitionId || list[0]?.id || ''

      setCompetitionId(selected)

      if (selected) {
        await loadFixtures(selected)
      } else {
        setFixtures([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load page.')
    } finally {
      setLoading(false)
    }
  }

  async function loadFixtures(id: string) {
    const { data, error } = await supabase
      .from('nvpl_fixtures')
      .select(`
        id,
        competition_id,
        home_team_id,
        away_team_id,
        home_score,
        away_score,
        kickoff_at,
        matchweek,
        status
      `)
      .eq('competition_id', id)
      .order('kickoff_at', { ascending: true })

    if (error) throw error

    const list = (data || []) as Fixture[]
    setFixtures(list)

    setScores(previous => {
      const next = { ...previous }

      for (const fixture of list) {
        next[fixture.id] = {
          home: String(fixture.home_score ?? ''),
          away: String(fixture.away_score ?? ''),
        }
      }

      return next
    })
  }

  useEffect(() => {
    loadPage()
  }, [])

  async function changeCompetition(id: string) {
    setCompetitionId(id)
    setMessage('')
    setError('')

    try {
      await loadFixtures(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load fixtures.')
    }
  }

  async function submitResult(fixture: Fixture) {
    setError('')
    setMessage('')

    const score = scores[fixture.id]

    if (!score || score.home.trim() === '' || score.away.trim() === '') {
      setError('Enter both scores.')
      return
    }

    const home = Number(score.home)
    const away = Number(score.away)

    if (
      !Number.isInteger(home) ||
      !Number.isInteger(away) ||
      home < 0 ||
      away < 0 ||
      home > 99 ||
      away > 99
    ) {
      setError('Scores must be whole numbers between 0 and 99.')
      return
    }

    const confirmed = window.confirm(
      `Submit result ${home} - ${away}?`
    )

    if (!confirmed) return

    setSaving(fixture.id)

    try {
      const { error } = await supabase.rpc(
        'nvpl_admin_submit_fixture_result',
        {
          p_fixture_id: fixture.id,
          p_home_score: home,
          p_away_score: away,
        }
      )

      if (error) throw error

      setMessage('Result submitted and standings updated.')
      await loadFixtures(competitionId)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to submit result.'
      )
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#090d18] p-8 text-white">
        Loading competition results...
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#090d18] p-5 text-white md:p-10">
      <div className="mx-auto max-w-6xl space-y-7">
        <header>
          <p className="text-sm font-bold uppercase tracking-widest text-blue-400">
            NVPL Administration
          </p>
          <h1 className="mt-2 text-3xl font-bold">
            Competition Results
          </h1>
          <p className="mt-2 text-gray-400">
            Submit official match results and update league standings.
          </p>
        </header>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-green-300">
            {message}
          </div>
        )}

        {isAdmin && (
          <>
            <section className="rounded-2xl border border-white/10 bg-[#111827] p-5">
              <label className="mb-2 block text-sm text-gray-400">
                Select competition
              </label>

              <select
                value={competitionId}
                onChange={e => changeCompetition(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#090d18] p-3 text-white"
              >
                {competitions.map(competition => (
                  <option key={competition.id} value={competition.id}>
                    {competition.name} — {competition.division} — {competition.season}
                  </option>
                ))}
              </select>
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Fixtures</h2>
                <span className="text-sm text-gray-400">
                  {fixtures.length} matches
                </span>
              </div>

              {fixtures.length === 0 && (
                <div className="rounded-xl border border-white/10 bg-[#111827] p-6 text-gray-400">
                  No fixtures found for this competition.
                </div>
              )}

              {fixtures.map(fixture => (
                <article
                  key={fixture.id}
                  className="rounded-2xl border border-white/10 bg-[#111827] p-5"
                >
                  <div className="mb-4 flex flex-wrap justify-between gap-2 text-sm text-gray-400">
                    <span>Matchweek {fixture.matchweek}</span>
                    <span>{new Date(fixture.kickoff_at).toLocaleString()}</span>
                    <span className="capitalize">{fixture.status}</span>
                  </div>

                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <div className="min-w-0">
                      <p className="mb-2 text-xs text-gray-400">Home team</p>
                      <p className="break-all text-sm font-semibold">
                        {fixture.home_team_id}
                      </p>
                      <input
                        type="number"
                        min="0"
                        max="99"
                        value={scores[fixture.id]?.home ?? ''}
                        onChange={e =>
                          setScores(previous => ({
                            ...previous,
                            [fixture.id]: {
                              ...previous[fixture.id],
                              home: e.target.value,
                              away: previous[fixture.id]?.away ?? '',
                            },
                          }))
                        }
                        className="mt-3 w-full rounded-lg border border-white/10 bg-[#090d18] p-3 text-center text-xl"
                        aria-label="Home score"
                      />
                    </div>

                    <span className="pt-8 text-gray-500">VS</span>

                    <div className="min-w-0">
                      <p className="mb-2 text-xs text-gray-400">Away team</p>
                      <p className="break-all text-sm font-semibold">
                        {fixture.away_team_id}
                      </p>
                      <input
                        type="number"
                        min="0"
                        max="99"
                        value={scores[fixture.id]?.away ?? ''}
                        onChange={e =>
                          setScores(previous => ({
                            ...previous,
                            [fixture.id]: {
                              home: previous[fixture.id]?.home ?? '',
                              away: e.target.value,
                            },
                          }))
                        }
                        className="mt-3 w-full rounded-lg border border-white/10 bg-[#090d18] p-3 text-center text-xl"
                        aria-label="Away score"
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => submitResult(fixture)}
                    disabled={saving === fixture.id}
                    className="mt-5 w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-500 disabled:opacity-50"
                  >
                    {saving === fixture.id
                      ? 'Submitting...'
                      : 'Submit official result'}
                  </button>
                </article>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  )
}
