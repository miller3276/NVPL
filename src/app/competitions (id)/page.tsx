
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Competition = {
  id: string
  name: string
  region: string
  season: string
  division: string
  description: string | null
  status: string
  start_date: string | null
  end_date: string | null
}

export default function CompetitionPage() {
  const params = useParams()
  const id = params.id as string

  const [competition, setCompetition] = useState<Competition | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) loadCompetition()
  }, [id])

  async function loadCompetition() {
    const { data } = await supabase
      .from('competitions')
      .select('id, name, region, season, division, description, status, start_date, end_date')
      .eq('id', id)
      .maybeSingle()

    setCompetition(data as Competition | null)
    setLoading(false)
  }

  if (loading) {
    return <main className="min-h-screen bg-gray-950 text-white p-8">Loading competition...</main>
  }

  if (!competition) {
    return <main className="min-h-screen bg-gray-950 text-white p-8">Competition not found.</main>
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-5xl mx-auto">

        <a href="/competitions" className="text-blue-400 hover:underline">
          ← All competitions
        </a>

        <section className="bg-gray-900 border border-gray-800 rounded-2xl p-8 mt-6">
          <div className="flex flex-wrap justify-between gap-4">
            <span className="text-blue-400 font-bold">{competition.region}</span>
            <span className="text-sm text-gray-400 capitalize">{competition.status}</span>
          </div>

          <h1 className="text-4xl font-bold mt-4">{competition.name}</h1>

          <p className="text-gray-400 mt-3">
            {competition.season} · {competition.division}
          </p>

          {competition.description && (
            <p className="text-gray-300 mt-6 whitespace-pre-wrap">
              {competition.description}
            </p>
          )}

          <div className="grid grid-cols-2 gap-4 mt-8">
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-400 text-sm">Start date</p>
              <p className="font-semibold mt-1">{competition.start_date || 'TBA'}</p>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-400 text-sm">End date</p>
              <p className="font-semibold mt-1">{competition.end_date || 'TBA'}</p>
            </div>
          </div>
        </section>

        <section className="mt-8 bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-2xl font-bold">Competition information</h2>
          <p className="text-gray-400 mt-3">
            Team registrations, fixtures, standings and results will appear here
            as those systems are added.
          </p>
        </section>

      </div>
    </main>
  )
}
