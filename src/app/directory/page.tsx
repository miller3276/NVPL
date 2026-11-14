
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Player = {
  id: string
  username: string
  gamertag: string
  bio: string | null
  country: string | null
  region: string
  avatar_url: string | null
}

export default function DirectoryPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function loadPlayers() {
      const { data, error } = await supabase
        .from('player_profiles')
        .select('id, username, gamertag, bio, country, region, avatar_url')
        .not('username', 'is', null)
        .order('username', { ascending: true })

      if (error) {
        setMessage(error.message)
      } else {
        setPlayers(data || [])
      }

      setLoading(false)
    }

    loadPlayers()
  }, [])

  const filteredPlayers = players.filter(player =>
    player.username?.toLowerCase().includes(
      search.trim().replace(/^@/, '').toLowerCase()
    )
  )

  return (
    <main className="min-h-screen bg-[#080d18] text-white p-6">
      <div className="max-w-6xl mx-auto">
        <Link href="/dashboard" className="text-blue-400">
          ← Back to Dashboard
        </Link>

        <div className="mt-8 mb-8">
          <p className="text-blue-400 font-bold tracking-widest text-sm">
            NVPL COMMUNITY
          </p>
          <h1 className="text-4xl font-bold mt-2">Player Directory</h1>
          <p className="text-gray-400 mt-2">
            Find players across all NVPL regions.
          </p>
        </div>

        <div className="bg-[#111c30] border border-[#263957] rounded-xl p-5 mb-8">
          <label className="block text-sm text-gray-300 mb-3">
            Search NVPL username
          </label>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by @username..."
            className="w-full bg-[#080d18] border border-gray-700 rounded-lg p-4 outline-none focus:border-blue-500"
          />
          <p className="text-gray-500 text-sm mt-3">
            {filteredPlayers.length} players found
          </p>
        </div>

        {message && (
          <div className="bg-red-900/30 border border-red-700 p-4 rounded-lg mb-6">
            {message}
          </div>
        )}

        {loading ? (
          <p className="text-gray-400">Loading players...</p>
        ) : filteredPlayers.length === 0 ? (
          <div className="bg-[#111c30] border border-[#263957] rounded-xl p-10 text-center">
            <h2 className="text-xl font-bold">No players found</h2>
            <p className="text-gray-400 mt-2">
              Try another NVPL username.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredPlayers.map(player => (
              <Link
                href={`/player/${encodeURIComponent(player.username)}`}
                key={player.id}
                className="block bg-[#111c30] border border-[#263957] hover:border-blue-500 rounded-xl p-6 transition"
              >
                <div className="flex items-center gap-4">
                  {player.avatar_url ? (
                    <img
                      src={player.avatar_url}
                      alt=""
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-[#263957] flex items-center justify-center text-2xl font-bold">
                      {player.username.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0">
                    <h2 className="font-bold text-lg truncate">
                      @{player.username}
                    </h2>
                    <p className="text-gray-400 text-sm truncate">
                      {player.gamertag}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-5">
                  <span className="bg-blue-600/20 text-blue-300 px-3 py-1 rounded-full text-xs">
                    {player.region}
                  </span>
                  {player.country && (
                    <span className="bg-[#263957] text-gray-300 px-3 py-1 rounded-full text-xs">
                      {player.country}
                    </span>
                  )}
                </div>

                <p className="text-gray-400 text-sm mt-4 line-clamp-2">
                  {player.bio || 'No player bio added yet.'}
                </p>

                <p className="text-blue-400 text-sm font-semibold mt-5">
                  View Player Profile →
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
