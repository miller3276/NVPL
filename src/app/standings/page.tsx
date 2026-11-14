
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Competition = {
  id: string
  name: string
  region: string
  season: string
  division: string
}

type Standing = {
  competition_id: string
  team_id: string
  team_name: string
  abbreviation: string
  played: number
  wins: number
  draws: number
  losses: number
  goals_for: number
  goals_against: number
  goal_difference: number
  points: number
}

export default function StandingsPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [standings, setStandings] = useState<Standing[]>([])
  const [selectedCompetition, setSelectedCompetition] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function load() {
      const [competitionResult, standingsResult] = await Promise.all([
        supabase
          .from('competitions')
          .select('id, name, region, season, division')
          .order('name'),
        supabase
          .from('nvpl_league_standings')
          .select('competition_id, team_id, team_name, abbreviation, played, wins, draws, losses, goals_for, goals_against, goal_difference, points')
      ])

      if (competitionResult.error || standingsResult.error) {
        setMessage(
          competitionResult.error?.message ||
          standingsResult.error?.message ||
          'Could not load league standings.'
        )
      } else {
        const competitionData = competitionResult.data || []
        setCompetitions(competitionData)
        setStandings(standingsResult.data || [])

        if (competitionData.length > 0) {
          setSelectedCompetition(competitionData[0].id)
        }
      }

      setLoading(false)
    }

    load()
  }, [])

  const selected = competitions.find(
    competition => competition.id === selectedCompetition
  )

  const rows = standings
    .filter(row => row.competition_id === selectedCompetition)
    .sort((a, b) =>
      b.points - a.points ||
      b.goal_difference - a.goal_difference ||
      b.goals_for - a.goals_for ||
      a.team_name.localeCompare(b.team_name)
    )

  return (
    <main className="min-h-screen bg-[#080b14] text-white px-5 py-10">
      <div className="max-w-6xl mx-auto">
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white">
          ← Back to dashboard
        </Link>

        <div className="mt-8 mb-8">
          <p className="text-sm tracking-[0.25em] text-blue-400 font-semibold">
            NATIONAL VIRTUAL PRO LEAGUE
          </p>
          <h1 className="text-4xl font-bold mt-2">League standings</h1>
          <p className="text-gray-400 mt-2">
            Automatically calculated competition tables.
          </p>
        </div>

        {message && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm">
            {message}
          </div>
        )}

        {loading ? (
          <p className="text-gray-400">Loading standings...</p>
        ) : competitions.length === 0 ? (
          <p className="text-gray-400">No competitions have been created yet.</p>
        ) : (
          <>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 mb-6">
              <label className="block text-sm text-gray-300 mb-2">
                Choose competition
              </label>
              <select
                value={selectedCompetition}
                onChange={event => setSelectedCompetition(event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#111827] p-3"
              >
                {competitions.map(competition => (
                  <option key={competition.id} value={competition.id}>
                    {competition.name} — {competition.region} — {competition.division} — {competition.season}
                  </option>
                ))}
              </select>

              {selected && (
                <p className="text-sm text-gray-400 mt-3">
                  {selected.region} · {selected.division} · {selected.season}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-x-auto">
              <table className="w-full text-sm text-left min-w-[760px]">
                <thead className="bg-white/[0.05] text-gray-400">
                  <tr>
                    <th className="p-4">#</th>
                    <th className="p-4">Club</th>
                    <th className="p-4 text-center">P</th>
                    <th className="p-4 text-center">W</th>
                    <th className="p-4 text-center">D</th>
                    <th className="p-4 text-center">L</th>
                    <th className="p-4 text-center">GF</th>
                    <th className="p-4 text-center">GA</th>
                    <th className="p-4 text-center">GD</th>
                    <th className="p-4 text-center font-bold text-white">PTS</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.team_id} className="border-t border-white/10">
                      <td className="p-4 font-bold text-gray-400">{index + 1}</td>
                      <td className="p-4">
                        <span className="font-semibold">{row.team_name}</span>
                        <span className="text-gray-500 ml-2">{row.abbreviation}</span>
                      </td>
                      <td className="p-4 text-center">{row.played}</td>
                      <td className="p-4 text-center">{row.wins}</td>
                      <td className="p-4 text-center">{row.draws}</td>
                      <td className="p-4 text-center">{row.losses}</td>
                      <td className="p-4 text-center">{row.goals_for}</td>
                      <td className="p-4 text-center">{row.goals_against}</td>
                      <td className="p-4 text-center">
                        {row.goal_difference > 0 ? '+' : ''}{row.goal_difference}
                      </td>
                      <td className="p-4 text-center font-bold text-blue-400">
                        {row.points}
                      </td>
                    </tr>
                  ))}

                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-gray-400">
                        No registered clubs or standings yet for this competition.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-gray-500 mt-4">
              P = Played · W = Wins · D = Draws · L = Losses · GF = Goals For · GA = Goals Against · GD = Goal Difference · PTS = Points
            </p>
          </>
        )}
      </div>
    </main>
  )
}
