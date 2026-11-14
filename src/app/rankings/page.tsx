
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Player = {
  user_id: string
  username: string | null
  gamertag: string
  position: string | null
  region: string
  avatar_url: string | null
  ranking_number: number | null
  ranking_category: string | null
  rank_tier: string | null
  rank_image_url: string | null
  market_value_millions: number
}

const categories = ['ALL', 'ATT', 'MID', 'CDM', 'FULLBACKS', 'CB', 'GK']

const tierStyles: Record<string, string> = {
  Gold: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  Silver: 'bg-slate-400/15 text-slate-200 border-slate-400/30',
  Bronze: 'bg-orange-700/15 text-orange-300 border-orange-700/30',
  Elite: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  Diamond: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
}

export default function RankingsPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [category, setCategory] = useState('ALL')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadRankings() {
      const { data, error } = await supabase
        .from('player_profiles')
        .select(`
          user_id,
          username,
          gamertag,
          position,
          region,
          avatar_url,
          ranking_number,
          ranking_category,
          rank_tier,
          rank_image_url,
          market_value_millions
        `)
        .eq('is_ranked', true)
        .order('ranking_number', { ascending: true, nullsFirst: false })

      if (error) {
        console.error(error)
      } else {
        setPlayers((data ?? []) as Player[])
      }

      setLoading(false)
    }

    loadRankings()
  }, [])

  const filteredPlayers = players.filter(player =>
    category === 'ALL' || player.ranking_category === category
  )

  return (
    <main className="min-h-screen bg-[#080d18] text-white">
      <nav className="border-b border-white/10 bg-[#101a2b] px-5 py-5">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <Link href="/" className="text-2xl font-black">
            NVPL<span className="text-blue-500">.</span>
          </Link>
          <Link href="/" className="text-sm text-gray-400 hover:text-white">
            Home
          </Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-5 py-12">
        <p className="text-blue-400 text-xs font-black tracking-[0.3em]">
          PLAYER DATABASE
        </p>

        <h1 className="text-4xl md:text-5xl font-black mt-3">
          PLAYER RANKINGS
        </h1>

        <p className="text-gray-400 mt-3">
          The official NVPL player rankings.
        </p>

        <div className="flex gap-2 flex-wrap mt-8">
          {categories.map(item => (
            <button
              key={item}
              onClick={() => setCategory(item)}
              className={`px-4 py-2 rounded-lg text-xs font-bold border transition ${
                category === item
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-[#111a2b] border-white/10 text-gray-400 hover:text-white'
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="mt-8 space-y-3">
          {loading ? (
            <p className="text-gray-400 py-12 text-center">
              Loading rankings...
            </p>
          ) : filteredPlayers.length === 0 ? (
            <div className="bg-[#111a2b] border border-white/10 rounded-2xl p-12 text-center">
              <h2 className="text-xl font-bold">No ranked players yet</h2>
              <p className="text-gray-500 text-sm mt-2">
                Rankings will appear here once players are added by NVPL administrators.
              </p>
            </div>
          ) : (
            filteredPlayers.map((player, index) => {
              const tier = player.rank_tier || 'Bronze'
              const tierStyle = tierStyles[tier] ||
                'bg-blue-500/15 text-blue-300 border-blue-500/30'

              return (
                <div
                  key={player.user_id}
                  className="bg-[#111a2b] border border-white/10 rounded-2xl p-4 md:p-5 flex items-center gap-3 md:gap-5"
                >
                  <div className="w-10 md:w-14 shrink-0 text-center">
                    <span className="text-xl md:text-2xl font-black text-blue-400">
                      #{player.ranking_number ?? index + 1}
                    </span>
                  </div>

                  <div className="w-12 h-12 md:w-16 md:h-16 shrink-0 rounded-xl overflow-hidden bg-[#202d43] flex items-center justify-center">
                    {player.avatar_url ? (
                      <img
                        src={player.avatar_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="font-black text-gray-400">
                        {(player.username || player.gamertag).slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h2 className="font-black text-base md:text-lg truncate">
                      {player.username || player.gamertag}
                    </h2>
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {player.gamertag} · {player.ranking_category || player.position || 'Unassigned'} · {player.region}
                    </p>
                  </div>

                  <div className="hidden sm:flex items-center gap-2">
                    {player.rank_image_url ? (
                      <img
                        src={player.rank_image_url}
                        alt={tier}
                        className="w-9 h-9 object-contain"
                      />
                    ) : null}
                    <span className={`border rounded-lg px-3 py-2 text-xs font-black ${tierStyle}`}>
                      {tier.toUpperCase()}
                    </span>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-500">VALUE</p>
                    <p className="text-lg md:text-xl font-black text-green-400">
                      €{Number(player.market_value_millions).toFixed(1)}M
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </main>
  )
}
