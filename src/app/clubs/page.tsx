
'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Club = {
  id: string
  name: string
  abbreviation: string
  region: string
  description: string | null
  badge_url: string | null
  created_at: string
}

export default function ClubsPage() {
  const [clubs, setClubs] = useState<Club[]>([])
  const [search, setSearch] = useState('')
  const [region, setRegion] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadClubs() {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, abbreviation, region, description, badge_url, created_at')
        .order('name', { ascending: true })

      if (error) {
        setError(error.message)
      } else {
        setClubs(data || [])
      }

      setLoading(false)
    }

    loadClubs()
  }, [])

  const filteredClubs = useMemo(() => {
    const term = search.trim().toLowerCase()

    return clubs.filter(club => {
      const matchesSearch =
        club.name.toLowerCase().includes(term) ||
        club.abbreviation.toLowerCase().includes(term)

      const matchesRegion =
        region === 'ALL' || club.region === region

      return matchesSearch && matchesRegion
    })
  }, [clubs, search, region])

  return (
    <main className="min-h-screen bg-[#080d18] text-white px-5 py-10">
      <div className="max-w-7xl mx-auto">

        <Link
          href="/dashboard"
          className="text-blue-400 hover:text-blue-300 text-sm font-semibold"
        >
          ← Back to Dashboard
        </Link>

        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5 mt-9 mb-8">
          <div>
            <p className="text-blue-400 text-xs font-black tracking-[0.25em]">
              NATIONAL VIRTUAL PRO LEAGUE
            </p>

            <h1 className="text-4xl md:text-5xl font-black mt-3">
              Club Directory
            </h1>

            <p className="text-gray-400 mt-3">
              Discover clubs competing across the NVPL.
            </p>
          </div>

          <Link
            href="/teams"
            className="inline-flex justify-center rounded-xl bg-blue-600 hover:bg-blue-500 px-6 py-3 font-bold transition"
          >
            + Create a Club
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-4 bg-[#111c30] border border-[#263957] rounded-2xl p-5 mb-8">
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Search clubs
            </label>

            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search club name or abbreviation..."
              className="w-full rounded-xl bg-[#080d18] border border-[#263957] px-4 py-3 outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Region
            </label>

            <select
              value={region}
              onChange={e => setRegion(e.target.value)}
              className="w-full rounded-xl bg-[#080d18] border border-[#263957] px-4 py-3 outline-none focus:border-blue-500"
            >
              <option value="ALL">All Regions</option>
              <option value="OCE">Oceania</option>
              <option value="EU">Europe</option>
              <option value="NA">North America</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold">Registered Clubs</h2>
          <span className="text-sm text-gray-400">
            {filteredClubs.length} clubs
          </span>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300 mb-6">
            Could not load clubs: {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-gray-400">
            Loading clubs...
          </div>
        ) : filteredClubs.length === 0 ? (
          <div className="rounded-2xl border border-[#263957] bg-[#111c30] p-12 text-center">
            <h3 className="text-xl font-bold">No clubs found</h3>
            <p className="text-gray-400 mt-2">
              Try changing your search or region filter.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredClubs.map(club => (
              <div
                key={club.id}
                className="rounded-2xl border border-[#263957] bg-[#111c30] p-6 hover:border-blue-500/70 transition"
              >
                <div className="flex items-center gap-4">
                  {club.badge_url ? (
                    <img
                      src={club.badge_url}
                      alt={`${club.name} badge`}
                      className="w-16 h-16 rounded-xl object-contain bg-[#080d18] p-2"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                      <span className="text-xl font-black text-blue-300">
                        {club.abbreviation.slice(0, 5)}
                      </span>
                    </div>
                  )}

                  <div className="min-w-0">
                    <h3 className="text-xl font-bold truncate">
                      {club.name}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {club.abbreviation}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-5">
                  <span className="rounded-full bg-blue-600/20 text-blue-300 px-3 py-1 text-xs font-bold">
                    {club.region}
                  </span>
                  <span className="text-xs text-gray-500">
                    Registered Club
                  </span>
                </div>

                <p className="text-sm text-gray-400 mt-4 min-h-10">
                  {club.description || 'No club description available.'}
                </p>

                <div className="border-t border-[#263957] mt-5 pt-4">
                  <p className="text-xs text-gray-500">
                    Registered {new Date(club.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
