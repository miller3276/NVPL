
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Competition = {
  id: string
  name: string
  region: string
  finals_format: string
  finals_qualifiers: number
}

type Leg = {
  id: string
  leg_number: number
  home_team_id: string | null
  away_team_id: string | null
  home_score: number | null
  away_score: number | null
  status: string
}

type Tie = {
  id: string
  competition_id: string
  bracket: string
  round_number: number
  match_number: number
  round_name: string
  home_team_id: string | null
  away_team_id: string | null
  home_aggregate: number
  away_aggregate: number
  status: string
  legs: Leg[]
  home_team: { name: string } | null
  away_team: { name: string } | null
}

export default function AdminFinalsPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [selected, setSelected] = useState('')
  const [ties, setTies] = useState<Tie[]>([])
  const [scores, setScores] = useState<Record<string, { home: string; away: string }>>({})
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCompetitions()
  }, [])

  async function loadCompetitions() {
    setLoading(true)

    const { data, error } = await supabase
      .from('competitions')
      .select('id,name,region,finals_format,finals_qualifiers')
      .order('created_at', { ascending: false })

    if (error) setMessage(error.message)
    else {
      setCompetitions(data || [])
      if (data?.length) {
        setSelected(current => current || data[0].id)
      }
    }

    setLoading(false)
  }

  async function loadTies(competitionId: string) {
    if (!competitionId) return

    const { data, error } = await supabase
      .from('nvpl_finals_ties')
      .select(`
        *,
        home_team:teams!nvpl_finals_ties_home_team_id_fkey(name),
        away_team:teams!nvpl_finals_ties_away_team_id_fkey(name),
        legs:nvpl_finals_legs(*)
      `)
      .eq('competition_id', competitionId)
      .order('round_number')
      .order('match_number')

    if (error) {
      setMessage(error.message)
      return
    }

    setTies((data || []) as Tie[])
  }

  useEffect(() => {
    if (selected) loadTies(selected)
  }, [selected])

  async function generate() {
    setMessage('')

    const { data, error } = await supabase.rpc(
      'generate_nvpl_finals_bracket_v3',
      { p_competition_id: selected }
    )

    if (error) setMessage(error.message)
    else {
      setMessage(`Finals generated: ${data} ties created.`)
      await loadTies(selected)
    }
  }

  async function submitScore(legId: string) {
    const score = scores[legId]

    if (!score || score.home === '' || score.away === '') {
      setMessage('Enter both scores first.')
      return
    }

    const { error } = await supabase.rpc(
      'nvpl_submit_finals_leg_v3',
      {
        p_leg_id: legId,
        p_home_score: Number(score.home),
        p_away_score: Number(score.away)
      }
    )

    if (error) setMessage(error.message)
    else {
      setMessage('Result saved.')
      await loadTies(selected)
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-[#080d18] text-white p-8">Loading finals...</main>
  }

  return (
    <main className="min-h-screen bg-[#080d18] text-white p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-black">Finals Manager</h1>
        <p className="text-gray-400 mt-2">Generate brackets and submit finals results.</p>

        {message && (
          <p className="mt-5 rounded-lg bg-[#17243a] p-4 text-sm">{message}</p>
        )}

        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <select
            value={selected}
            onChange={e => setSelected(e.target.value)}
            className="flex-1 rounded-lg bg-[#111a2b] border border-white/10 p-3"
          >
            {competitions.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.region}
              </option>
            ))}
          </select>

          <button
            onClick={generate}
            disabled={!selected}
            className="rounded-lg bg-blue-600 px-6 py-3 font-bold disabled:opacity-40"
          >
            Generate Finals
          </button>
        </div>

        <div className="mt-8 space-y-6">
          {ties.map(tie => (
            <section key={tie.id} className="rounded-xl border border-white/10 bg-[#111a2b] p-5">
              <div className="flex justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-blue-400 text-xs font-bold uppercase">
                    {tie.bracket.replace('_', ' ')} · {tie.round_name}
                  </p>
                  <h2 className="text-xl font-bold mt-1">
                    {tie.home_team?.name || 'TBD'} vs {tie.away_team?.name || 'TBD'}
                  </h2>
                </div>
                <p className="text-sm text-gray-400">
                  {tie.status} · Aggregate {tie.home_aggregate}–{tie.away_aggregate}
                </p>
              </div>

              <div className="mt-5 space-y-3">
                {(tie.legs || []).sort((a, b) => a.leg_number - b.leg_number).map(leg => (
                  <div key={leg.id} className="flex flex-wrap items-center gap-3">
                    <span className="text-sm text-gray-400 w-16">Leg {leg.leg_number}</span>

                    <input
                      type="number"
                      min="0"
                      placeholder="Home"
                      value={scores[leg.id]?.home ?? (leg.home_score?.toString() ?? '')}
                      onChange={e => setScores(s => ({
                        ...s,
                        [leg.id]: {
                          home: e.target.value,
                          away: s[leg.id]?.away ?? (leg.away_score?.toString() ?? '')
                        }
                      }))}
                      className="w-24 rounded-lg bg-[#080d18] border border-white/10 p-2"
                    />

                    <span>–</span>

                    <input
                      type="number"
                      min="0"
                      placeholder="Away"
                      value={scores[leg.id]?.away ?? (leg.away_score?.toString() ?? '')}
                      onChange={e => setScores(s => ({
                        ...s,
                        [leg.id]: {
                          home: s[leg.id]?.home ?? (leg.home_score?.toString() ?? ''),
                          away: e.target.value
                        }
                      }))}
                      className="w-24 rounded-lg bg-[#080d18] border border-white/10 p-2"
                    />

                    <button
                      onClick={() => submitScore(leg.id)}
                      disabled={tie.status === 'completed'}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold disabled:opacity-40"
                    >
                      Save result
                    </button>

                    <span className="text-xs text-gray-500">{leg.status}</span>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {!ties.length && (
            <p className="text-gray-500">No finals generated for this competition yet.</p>
          )}
        </div>
      </div>
    </main>
  )
}
