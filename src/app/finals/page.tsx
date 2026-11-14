
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Tie = {
  id: string
  competition_id: string
  bracket: string
  round_number: number
  match_number: number
  round_name: string
  home_aggregate: number
  away_aggregate: number
  status: string
  home_team: { name: string } | null
  away_team: { name: string } | null
}

type Competition = {
  id: string
  name: string
  region: string
}

export default function FinalsPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [selected, setSelected] = useState('')
  const [ties, setTies] = useState<Tie[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('competitions')
        .select('id,name,region')
        .order('created_at', { ascending: false })

      setCompetitions(data || [])
      if (data?.length) setSelected(data[0].id)
      setLoading(false)
    }

    load()
  }, [])

  useEffect(() => {
    async function loadTies() {
      if (!selected) {
        setTies([])
        return
      }

      const { data } = await supabase
        .from('nvpl_finals_ties')
        .select(`
          *,
          home_team:teams!nvpl_finals_ties_home_team_id_fkey(name),
          away_team:teams!nvpl_finals_ties_away_team_id_fkey(name)
        `)
        .eq('competition_id', selected)
        .order('round_number')
        .order('match_number')

      setTies((data || []) as Tie[])
    }

    loadTies()
  }, [selected])

  const main = ties.filter(t => t.bracket === 'main')
  const third = ties.filter(t => t.bracket === 'third_place')

  if (loading) {
    return <main className="min-h-screen bg-[#080d18] text-white p-8">Loading finals...</main>
  }

  return (
    <main className="min-h-screen bg-[#080d18] text-white p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-black">NVPL Finals</h1>
        <p className="text-gray-400 mt-2">Follow the road to the championship.</p>

        <select
          value={selected}
          onChange={e => setSelected(e.target.value)}
          className="mt-8 w-full max-w-md rounded-lg bg-[#111a2b] border border-white/10 p-3"
        >
          {competitions.map(c => (
            <option key={c.id} value={c.id}>
              {c.name} — {c.region}
            </option>
          ))}
        </select>

        <h2 className="text-2xl font-bold mt-10 mb-5">Main Bracket</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {main.map(tie => (
            <article key={tie.id} className="rounded-xl border border-white/10 bg-[#111a2b] p-5">
              <p className="text-xs font-bold text-blue-400 uppercase">{tie.round_name}</p>

              <div className="flex justify-between gap-3 mt-4">
                <span className="font-semibold">{tie.home_team?.name || 'TBD'}</span>
                <span className="font-black">{tie.home_aggregate}</span>
              </div>

              <div className="flex justify-between gap-3 mt-3">
                <span className="font-semibold">{tie.away_team?.name || 'TBD'}</span>
                <span className="font-black">{tie.away_aggregate}</span>
              </div>

              <div className="mt-4 border-t border-white/10 pt-3 flex justify-between text-xs text-gray-400">
                <span>{tie.status.replace('_', ' ')}</span>
                <span>Match {tie.match_number}</span>
              </div>
            </article>
          ))}
        </div>

        {third.length > 0 && (
          <>
            <h2 className="text-2xl font-bold mt-10 mb-5">Third Place Playoff</h2>
            {third.map(tie => (
              <article key={tie.id} className="rounded-xl border border-white/10 bg-[#111a2b] p-5">
                <p className="text-xs text-blue-400 font-bold">{tie.round_name}</p>
                <div className="flex justify-between mt-4">
                  <span>{tie.home_team?.name || 'TBD'}</span>
                  <strong>{tie.home_aggregate}</strong>
                </div>
                <div className="flex justify-between mt-3">
                  <span>{tie.away_team?.name || 'TBD'}</span>
                  <strong>{tie.away_aggregate}</strong>
                </div>
                <p className="text-xs text-gray-400 mt-4">{tie.status}</p>
              </article>
            ))}
          </>
        )}

        {!ties.length && (
          <p className="text-gray-500 mt-8">Finals have not been generated for this competition yet.</p>
        )}
      </div>
    </main>
  )
}
