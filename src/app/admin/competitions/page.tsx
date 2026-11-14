
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
  finals_qualifiers: number
  finals_format: string
  finals_legs: number
  third_place_playoff: boolean
}

const inputClass =
  'w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white'

export default function CompetitionAdminPage() {
  const router = useRouter()

  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [region, setRegion] = useState('OCE')
  const [season, setSeason] = useState('2027')
  const [division, setDivision] = useState('Division 1')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [status, setStatus] = useState('upcoming')

  const [qualifiers, setQualifiers] = useState(8)
  const [finalsFormat, setFinalsFormat] = useState('single_elimination')
  const [finalsLegs, setFinalsLegs] = useState(1)
  const [thirdPlace, setThirdPlace] = useState(false)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [allowed, setAllowed] = useState(false)
  const [message, setMessage] = useState('')
  const [messageError, setMessageError] = useState(false)

  const loadCompetitions = useCallback(async () => {
    const { data, error } = await supabase
      .from('competitions')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(error.message)
      setMessageError(true)
    } else {
      setCompetitions((data || []) as Competition[])
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    async function initialise() {
      const { data: authData, error: authError } =
        await supabase.auth.getUser()

      if (authError || !authData.user) {
        router.replace('/login')
        return
      }

      const { data, error } = await supabase.rpc(
        'nvpl_can_manage_competitions'
      )

      if (error || data !== true) {
        setAllowed(false)
        setLoading(false)
        return
      }

      setAllowed(true)
      await loadCompetitions()
    }

    initialise()
  }, [router, loadCompetitions])

  function resetForm() {
    setEditingId(null)
    setName('')
    setRegion('OCE')
    setSeason('2027')
    setDivision('Division 1')
    setDescription('')
    setStartDate('')
    setEndDate('')
    setStatus('upcoming')
    setQualifiers(8)
    setFinalsFormat('single_elimination')
    setFinalsLegs(1)
    setThirdPlace(false)
  }

  function editCompetition(competition: Competition) {
    setEditingId(competition.id)
    setName(competition.name)
    setRegion(competition.region)
    setSeason(competition.season)
    setDivision(competition.division)
    setDescription(competition.description || '')
    setStartDate(competition.start_date || '')
    setEndDate(competition.end_date || '')
    setStatus(competition.status)
    setQualifiers(competition.finals_qualifiers ?? 8)
    setFinalsFormat(competition.finals_format || 'single_elimination')
    setFinalsLegs(competition.finals_legs ?? 1)
    setThirdPlace(competition.third_place_playoff ?? false)

    setMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function saveCompetition(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setMessage('')
    setMessageError(false)

    if (!name.trim() || !season.trim() || !division.trim()) {
      setMessage('Enter a competition name, season and division.')
      setMessageError(true)
      return
    }

    if (startDate && endDate && endDate < startDate) {
      setMessage('End date cannot be before start date.')
      setMessageError(true)
      return
    }

    if (!Number.isInteger(qualifiers) || qualifiers < 2 || qualifiers > 64) {
      setMessage('Finals qualifiers must be between 2 and 64.')
      setMessageError(true)
      return
    }

    if (!Number.isInteger(finalsLegs) || finalsLegs < 1 || finalsLegs > 5) {
      setMessage('Finals legs must be between 1 and 5.')
      setMessageError(true)
      return
    }

    setSaving(true)

    if (editingId) {
      const { error } = await supabase
        .from('competitions')
        .update({
          name: name.trim(),
          region,
          season: season.trim(),
          division: division.trim(),
          description: description.trim() || null,
          start_date: startDate || null,
          end_date: endDate || null,
          status,
          finals_qualifiers: qualifiers,
          finals_format: finalsFormat,
          finals_legs: finalsLegs,
          third_place_playoff: thirdPlace,
        })
        .eq('id', editingId)

      if (error) {
        setMessage(error.message)
        setMessageError(true)
      } else {
        setMessage('Competition updated successfully.')
        resetForm()
        await loadCompetitions()
      }
    } else {
      const { error } = await supabase.rpc('create_nvpl_competition', {
        p_name: name.trim(),
        p_region: region,
        p_season: season.trim(),
        p_division: division.trim(),
        p_description: description.trim(),
        p_start_date: startDate || null,
        p_end_date: endDate || null,
      })

      if (error) {
        setMessage(error.message)
        setMessageError(true)
      } else {
        setMessage('Competition created successfully.')
        resetForm()
        await loadCompetitions()
      }
    }

    setSaving(false)
  }

  async function changeStatus(id: string, newStatus: string) {
    setMessage('')
    setMessageError(false)

    const { error } = await supabase.rpc(
      'update_nvpl_competition_status',
      {
        p_competition_id: id,
        p_status: newStatus,
      }
    )

    if (error) {
      setMessage(error.message)
      setMessageError(true)
    } else {
      setMessage('Competition status updated.')
      await loadCompetitions()
    }
  }

  const filteredCompetitions = competitions.filter(competition => {
    const query = search.toLowerCase()

    return (
      competition.name.toLowerCase().includes(query) ||
      competition.region.toLowerCase().includes(query) ||
      competition.season.toLowerCase().includes(query) ||
      competition.division.toLowerCase().includes(query)
    )
  })

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 text-white p-8">
        Loading competition management...
      </main>
    )
  }

  if (!allowed) {
    return (
      <main className="min-h-screen bg-gray-950 text-white p-8">
        <h1 className="text-2xl font-bold">Access denied</h1>
        <p className="text-gray-400 mt-2">
          Competition Admin or Super Admin access is required.
        </p>
        <Link href="/admin" className="text-blue-400 mt-5 inline-block">
          Back to admin dashboard
        </Link>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-6xl mx-auto">

        <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
          <div>
            <p className="text-blue-400 text-sm font-semibold">
              NVPL ADMINISTRATION
            </p>
            <h1 className="text-4xl font-bold mt-2">
              Competition Management
            </h1>
          </div>

          <Link
            href="/admin"
            className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg"
          >
            Back to dashboard
          </Link>
        </div>

        {message && (
          <div className={`rounded-lg p-4 mb-6 border ${
            messageError
              ? 'bg-red-950/40 border-red-800 text-red-300'
              : 'bg-green-950/40 border-green-800 text-green-300'
          }`}>
            {message}
          </div>
        )}

        <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
          <div className="flex justify-between items-center gap-3 mb-5">
            <div>
              <h2 className="text-2xl font-bold">
                {editingId ? 'Edit competition' : 'Create competition'}
              </h2>
              <p className="text-gray-400 text-sm mt-1">
                Manage competition information and Finals settings.
              </p>
            </div>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-700 hover:bg-gray-600 rounded-lg px-4 py-2"
              >
                Cancel
              </button>
            )}
          </div>

          <form onSubmit={saveCompetition} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="text-sm text-gray-400">
                Competition name
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Competition name"
                  className={`${inputClass} mt-2`}
                  required
                />
              </label>

              <label className="text-sm text-gray-400">
                Region
                <select
                  value={region}
                  onChange={e => setRegion(e.target.value)}
                  className={`${inputClass} mt-2`}
                >
                  <option value="OCE">OCE</option>
                  <option value="EU">EU</option>
                  <option value="NA">NA</option>
                  <option value="SA">South America</option>
                  <option value="ASIA">Asia</option>
                  <option value="AFR">Africa</option>
                  <option value="GLOBAL">Global</option>
                </select>
              </label>

              <label className="text-sm text-gray-400">
                Season
                <input
                  value={season}
                  onChange={e => setSeason(e.target.value)}
                  className={`${inputClass} mt-2`}
                  required
                />
              </label>

              <label className="text-sm text-gray-400">
                Division
                <input
                  value={division}
                  onChange={e => setDivision(e.target.value)}
                  className={`${inputClass} mt-2`}
                  required
                />
              </label>

              <label className="text-sm text-gray-400">
                Start date
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className={`${inputClass} mt-2`}
                />
              </label>

              <label className="text-sm text-gray-400">
                End date
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className={`${inputClass} mt-2`}
                />
              </label>

              <label className="text-sm text-gray-400">
                Status
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                  className={`${inputClass} mt-2`}
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="registration_open">Registration Open</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
            </div>

            <label className="block text-sm text-gray-400">
              Description
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Competition description"
                className={`${inputClass} mt-2`}
              />
            </label>

            <div className="border-t border-gray-800 pt-5">
              <h3 className="text-xl font-bold mb-4">
                Finals configuration
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="text-sm text-gray-400">
                  Qualifying teams
                  <input
                    type="number"
                    min={2}
                    max={64}
                    value={qualifiers}
                    onChange={e => setQualifiers(Number(e.target.value))}
                    className={`${inputClass} mt-2`}
                  />
                </label>

                <label className="text-sm text-gray-400">
                  Finals format
                  <select
                    value={finalsFormat}
                    onChange={e => setFinalsFormat(e.target.value)}
                    className={`${inputClass} mt-2`}
                  >
                    <option value="single_elimination">Single Elimination</option>
                    <option value="double_elimination">Double Elimination</option>
                  </select>
                </label>

                <label className="text-sm text-gray-400">
                  Legs per tie
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={finalsLegs}
                    onChange={e => setFinalsLegs(Number(e.target.value))}
                    className={`${inputClass} mt-2`}
                  />
                </label>
              </div>

              <label className="flex items-center gap-3 mt-5 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={thirdPlace}
                  onChange={e => setThirdPlace(e.target.checked)}
                  className="w-4 h-4"
                />
                Enable third-place playoff
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-6 py-3 rounded-lg font-semibold"
            >
              {saving
                ? 'Saving...'
                : editingId
                  ? 'Save competition changes'
                  : 'Create competition'}
            </button>
          </form>
        </section>

        <section>
          <div className="flex flex-wrap justify-between items-center gap-4 mb-5">
            <div>
              <h2 className="text-2xl font-bold">All competitions</h2>
              <p className="text-gray-400 text-sm mt-1">
                {competitions.length} competitions
              </p>
            </div>

            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search competitions..."
              className="bg-gray-800 border border-gray-700 rounded-lg p-3"
            />
          </div>

          {filteredCompetitions.length === 0 ? (
            <div className="bg-gray-900 rounded-xl p-8 text-center text-gray-400">
              No competitions found.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCompetitions.map(competition => (
                <div
                  key={competition.id}
                  className="bg-gray-900 border border-gray-800 rounded-xl p-5"
                >
                  <div className="flex flex-wrap justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-xl font-bold">
                        {competition.name}
                      </h3>

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

                      <p className="text-xs text-gray-500 mt-1">
                        Finals: {competition.finals_qualifiers ?? 8} qualifiers ·{' '}
                        {competition.finals_format || 'single_elimination'} ·{' '}
                        {competition.finals_legs ?? 1} leg(s)
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 min-w-44">
                      <span className="text-sm text-blue-400 capitalize">
                        {competition.status.replaceAll('_', ' ')}
                      </span>

                      <select
                        value={competition.status}
                        onChange={e => changeStatus(competition.id, e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm"
                      >
                        <option value="upcoming">Upcoming</option>
                        <option value="registration_open">Registration Open</option>
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => editCompetition(competition)}
                        className="bg-blue-600 hover:bg-blue-700 rounded-lg p-2 text-sm"
                      >
                        Edit competition
                      </button>

                      <Link
                        href={`/competitions/${competition.id}`}
                        className="text-blue-400 text-sm hover:underline"
                      >
                        View competition →
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
