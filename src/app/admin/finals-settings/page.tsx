
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Competition = {
  id: string
  name: string
  finals_format: string
  finals_qualifiers: number
  finals_legs: number
  third_place_playoff: boolean
}

export default function FinalsSettingsPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [id, setId] = useState('')
  const [format, setFormat] = useState('single_elimination')
  const [qualifiers, setQualifiers] = useState(8)
  const [legs, setLegs] = useState(1)
  const [third, setThird] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase
      .from('competitions')
      .select('id,name,finals_format,finals_qualifiers,finals_legs,third_place_playoff')
      .order('created_at', { ascending: false })

    setCompetitions(data || [])
  }

  function selectCompetition(value: string) {
    setId(value)
    const c = competitions.find(x => x.id === value)
    if (!c) return

    setFormat(c.finals_format || 'single_elimination')
    setQualifiers(c.finals_qualifiers || 8)
    setLegs(c.finals_legs || 1)
    setThird(c.third_place_playoff || false)
  }

  async function save() {
    if (!id) {
      setMessage('Choose a competition first.')
      return
    }

    setLoading(true)
    setMessage('')

    const { error } = await supabase.rpc('update_nvpl_finals_settings', {
      p_competition_id: id,
      p_finals_qualifiers: format === 'page_playoff' ? 5 : qualifiers,
      p_finals_format: format,
      p_finals_legs: legs,
      p_third_place_playoff: third
    })

    setMessage(error ? error.message : 'Finals settings saved.')
    setLoading(false)
    await load()
  }

  return (
    <main className="min-h-screen bg-[#080b14] text-white p-6">
      <div className="max-w-3xl mx-auto space-y-7">
        <header>
          <p className="text-blue-400 font-bold text-sm">NVPL ADMIN</p>
          <h1 className="text-4xl font-black mt-2">Finals Settings</h1>
        </header>

        {message && <div className="bg-blue-950 border border-blue-800 rounded-xl p-4">{message}</div>}

        <section className="bg-[#111827] border border-gray-800 rounded-2xl p-6 space-y-5">
          <label className="block space-y-2">
            <span className="text-sm text-gray-400">Competition</span>
            <select
              value={id}
              onChange={e => selectCompetition(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3"
            >
              <option value="">Choose competition</option>
              {competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-gray-400">Finals format</span>
            <select
              value={format}
              onChange={e => setFormat(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3"
            >
              <option value="single_elimination">Single elimination</option>
              <option value="double_elimination">Double elimination</option>
              <option value="page_playoff">Page playoff — top 5</option>
            </select>
          </label>

          {format !== 'page_playoff' && (
            <label className="block space-y-2">
              <span className="text-sm text-gray-400">Qualifying teams</span>
              <select
                value={qualifiers}
                onChange={e => setQualifiers(Number(e.target.value))}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3"
              >
                {[2,4,8,16,32].map(n => <option key={n} value={n}>{n} teams</option>)}
              </select>
            </label>
          )}

          <label className="block space-y-2">
            <span className="text-sm text-gray-400">Legs per tie</span>
            <select
              value={legs}
              onChange={e => setLegs(Number(e.target.value))}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3"
            >
              <option value={1}>One leg</option>
              <option value={2}>Two legs — home and away</option>
            </select>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={third}
              onChange={e => setThird(e.target.checked)}
              className="w-5 h-5"
            />
            <span>Include third-place playoff</span>
          </label>

          <button
            onClick={save}
            disabled={loading || !id}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl p-3 font-bold"
          >
            {loading ? 'Saving...' : 'Save finals settings'}
          </button>
        </section>
      </div>
    </main>
  )
}
