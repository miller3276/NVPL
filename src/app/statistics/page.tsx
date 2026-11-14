
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type PlayerStat = {
  player_id: string
  username: string
  gamertag: string
  avatar_url: string | null
  region: string
  team_name: string
  appearances: number
  goals: number
  assists: number
  shots: number
  shots_on_target: number
  saves: number
  clean_sheets: number
  passes_completed: number
  passes_attempted: number
  passing_accuracy: number
  minutes_played: number
}

type SortKey =
  | 'goals'
  | 'assists'
  | 'appearances'
  | 'saves'
  | 'clean_sheets'
  | 'passing_accuracy'
  | 'shots'
  | 'minutes_played'

export default function StatisticsPage() {
  const [players, setPlayers] = useState<PlayerStat[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<SortKey>('goals')
  const [search, setSearch] = useState('')
  const [region, setRegion] = useState('all')

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('nvpl_player_statistics')
        .select('*')

      if (!error) {
        setPlayers((data || []) as PlayerStat[])
      }

      setLoading(false)
    }

    load()
  }, [])

  const filtered = players
    .filter(p => {
      const query = search.toLowerCase()
      const matchesSearch =
        p.username?.toLowerCase().includes(query) ||
        p.gamertag?.toLowerCase().includes(query) ||
        p.team_name?.toLowerCase().includes(query)

      const matchesRegion = region === 'all' || p.region === region

      return matchesSearch && matchesRegion
    })
    .sort((a, b) => Number(b[sort] || 0) - Number(a[sort] || 0))

  const leaders = [
    { label: 'Top scorer', key: 'goals' as SortKey, suffix: 'goals' },
    { label: 'Most assists', key: 'assists' as SortKey, suffix: 'assists' },
    { label: 'Most saves', key: 'saves' as SortKey, suffix: 'saves' },
    { label: 'Most appearances', key: 'appearances' as SortKey, suffix: 'matches' }
  ]

  if (loading) {
    return <main className="p-8">Loading statistics...</main>
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-7xl space-y-8">
        <header>
          <p className="font-bold tracking-widest text-blue-400">NVPL</p>
          <h1 className="text-4xl font-black">Statistics</h1>
          <p className="mt-2 text-slate-400">
            Player performances, records and league leaders.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {leaders.map(item => {
            const leader = [...players].sort(
              (a, b) => Number(b[item.key]) - Number(a[item.key])
            )[0]

            return (
              <button
                key={item.key}
                onClick={() => setSort(item.key)}
                className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-left hover:border-blue-500"
              >
                <p className="text-sm text-slate-400">{item.label}</p>
                <p className="mt-2 truncate text-xl font-bold">
                  {leader?.gamertag || leader?.username || 'No data yet'}
                </p>
                <p className="mt-1 text-2xl font-black text-blue-400">
                  {leader ? leader[item.key] : 0}
                </p>
                <p className="text-xs text-slate-500">{item.suffix}</p>
              </button>
            )
          })}
        </section>

        <section className="space-y-4 rounded-xl bg-slate-900 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-bold">Player leaderboard</h2>
            <span className="text-sm text-slate-400">
              {filtered.length} players
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search player or club..."
              className="rounded-lg bg-slate-800 p-3"
            />

            <select
              value={region}
              onChange={e => setRegion(e.target.value)}
              className="rounded-lg bg-slate-800 p-3"
            >
              <option value="all">All regions</option>
              <option value="OCE">OCE</option>
              <option value="EU">EU</option>
              <option value="NA">NA</option>
            </select>

            <select
              value={sort}
              onChange={e => setSort(e.target.value as SortKey)}
              className="rounded-lg bg-slate-800 p-3"
            >
              <option value="goals">Goals</option>
              <option value="assists">Assists</option>
              <option value="appearances">Appearances</option>
              <option value="saves">Saves</option>
              <option value="clean_sheets">Clean sheets</option>
              <option value="passing_accuracy">Passing accuracy</option>
              <option value="shots">Shots</option>
              <option value="minutes_played">Minutes played</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="border-b border-slate-700 text-slate-400">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">Player</th>
                  <th className="p-3">Club</th>
                  <th className="p-3">Apps</th>
                  <th className="p-3">Goals</th>
                  <th className="p-3">Assists</th>
                  <th className="p-3">Shots</th>
                  <th className="p-3">Saves</th>
                  <th className="p-3">Clean sheets</th>
                  <th className="p-3">Pass accuracy</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((player, index) => (
                  <tr
                    key={`${player.player_id}-${player.team_name}`}
                    className="border-b border-slate-800"
                  >
                    <td className="p-3 font-bold">{index + 1}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        {player.avatar_url && (
                          <img
                            src={player.avatar_url}
                            alt=""
                            className="h-9 w-9 rounded-full object-cover"
                          />
                        )}
                        <div>
                          <p className="font-semibold">
                            {player.gamertag || player.username}
                          </p>
                          <p className="text-xs text-slate-500">
                            @{player.username}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">{player.team_name}</td>
                    <td className="p-3">{player.appearances}</td>
                    <td className="p-3 font-bold text-blue-400">
                      {player.goals}
                    </td>
                    <td className="p-3">{player.assists}</td>
                    <td className="p-3">{player.shots}</td>
                    <td className="p-3">{player.saves}</td>
                    <td className="p-3">{player.clean_sheets}</td>
                    <td className="p-3">
                      {Number(player.passing_accuracy).toFixed(1)}%
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400">
                      No statistics have been recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  )
}
