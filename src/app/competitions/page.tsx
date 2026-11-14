
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Competition = {
  id: string
  name: string
  region: string
  season: string
  division: string
  description: string | null
  start_date: string | null
  end_date: string | null
  status: string
}

export default function CompetitionAdminPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [name, setName] = useState('')
  const [region, setRegion] = useState('OCE')
  const [season, setSeason] = useState('2027')
  const [division, setDivision] = useState('Division 1')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadCompetitions()
  }, [])

  async function loadCompetitions() {
    setLoading(true)

    const { data, error } = await supabase
      .from('competitions')
      .select('id, name, region, season, division, description, start_date, end_date, status')
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(error.message)
    } else {
      setCompetitions((data || []) as Competition[])
    }

    setLoading(false)
  }

  async function createCompetition() {
    if (!name.trim() || !season.trim() || !division.trim()) {
      setMessage('Enter a competition name, season and division.')
      return
    }

    setSaving(true)
    setMessage('')

    const { data, error } = await supabase.rpc('create_nvpl_competition', {
      p_name: name,
      p_region: region,
      p_season: season,
      p_division: division,
      p_description: description,
      p_start_date: startDate || null,
      p_end_date: endDate || null
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Competition created successfully.')
      setName('')
      setDescription('')
      setStartDate('')
      setEndDate('')
      await loadCompetitions()
    }

    setSaving(false)
  }

  async function changeStatus(id: string, status: string) {
    setMessage('')

    const { error } = await supabase.rpc('update_nvpl_competition_status', {
      p_competition_id: id,
      p_status: status
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Competition status updated.')
      await loadCompetitions()
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-6xl mx-auto">

        <p className="text-blue-400 text-sm font-semibold">
          NVPL ADMINISTRATION
        </p>

        <h1 className="text-4xl font-bold mt-2 mb-8">
          Competition Management
        </h1>

        <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
          <h2 className="text-2xl font-bold mb-5">Create competition</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="Competition name"
              className="bg-gray-800 border border-gray-700 rounded-lg p-3"
            />

            <select
              value={region}
              onChange={event => setRegion(event.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg p-3"
            >
              <option value="OCE">OCE</option>
              <option value="EU">EU</option>
              <option value="NA">NA</option>
            </select>

            <input
              value={season}
              onChange={event => setSeason(event.target.value)}
              placeholder="Season (e.g. 2027)"
              className="bg-gray-800 border border-gray-700 rounded-lg p-3"
            />

            <input
              value={division}
              onChange={event => setDivision(event.target.value)}
              placeholder="Division (e.g. Division 1)"
              className="bg-gray-800 border border-gray-700 rounded-lg p-3"
            />

            <div>
              <label className="block text-sm text-gray-400 mb-2">Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={event => setStartDate(event.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">End date</label>
              <input
                type="date"
                value={endDate}
                onChange={event => setEndDate(event.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3"
              />
            </div>
          </div>

          <textarea
            value={description}
            onChange={event => setDescription(event.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Competition description"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 mt-4"
          />

          <button
            onClick={createCompetition}
            disabled={saving}
            className="mt-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-6 py-3 rounded-lg font-semibold"
          >
            {saving ? 'Creating...' : 'Create competition'}
          </button>
        </section>

        {message && (
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-6 text-sm">
            {message}
          </div>
        )}

        <h2 className="text-2xl font-bold mb-5">All competitions</h2>

        {loading ? (
          <p className="text-gray-400">Loading competitions...</p>
        ) : competitions.length === 0 ? (
          <div className="bg-gray-900 rounded-xl p-8 text-center text-gray-400">
            No competitions have been created yet.
          </div>
        ) : (
          <div className="space-y-4">
            {competitions.map(competition => (
              <div
                key={competition.id}
                className="bg-gray-900 border border-gray-800 rounded-xl p-5"
              >
                <div className="flex flex-wrap justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold">{competition.name}</h3>
                    <p className="text-gray-400 mt-1">
                      {competition.region} · {competition.season} · {competition.division}
                    </p>
                    {competition.description && (
                      <p className="text-sm text-gray-400 mt-2">
                        {competition.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      {competition.start_date || 'No start date'} – {competition.end_date || 'No end date'}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="text-sm text-blue-400 capitalize">
                      {competition.status}
                    </span>

                    <select
                      value={competition.status}
                      onChange={event => changeStatus(competition.id, event.target.value)}
                      className="bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm"
                    >
                      <option value="upcoming">Upcoming</option>
                      <option value="active">Active</option>
                      <option value="completed">Completed</option>
                    </select>

                    <a
                      href={`/competitions/${competition.id}`}
                      className="text-blue-400 text-sm hover:underline"
                    >
                      View competition →
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </main>
  )
}
