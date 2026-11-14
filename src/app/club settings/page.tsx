
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Team = {
  id: string
  name: string
  abbreviation: string
  region: string
  description: string | null
  badge_url: string | null
}

export default function ClubSettingsPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [teamId, setTeamId] = useState('')
  const [name, setName] = useState('')
  const [abbreviation, setAbbreviation] = useState('')
  const [description, setDescription] = useState('')
  const [badgeUrl, setBadgeUrl] = useState('')
  const [badgeFile, setBadgeFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadTeams()
  }, [])

  async function loadTeams() {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setMessage('Please log in first.')
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('teams')
      .select('id, name, abbreviation, region, description, badge_url')
      .eq('owner_id', user.id)
      .order('name')

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    const ownedTeams = (data || []) as Team[]
    setTeams(ownedTeams)

    if (ownedTeams.length > 0) {
      selectTeam(ownedTeams[0])
    }

    setLoading(false)
  }

  function selectTeam(team: Team) {
    setTeamId(team.id)
    setName(team.name)
    setAbbreviation(team.abbreviation)
    setDescription(team.description || '')
    setBadgeUrl(team.badge_url || '')
    setBadgeFile(null)
    setMessage('')
  }

  async function saveClub() {
    if (!teamId) return

    if (!name.trim() || !abbreviation.trim()) {
      setMessage('Club name and abbreviation are required.')
      return
    }

    if (description.length > 500) {
      setMessage('Description must be 500 characters or fewer.')
      return
    }

    setSaving(true)
    setMessage('')

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setMessage('Please log in again.')
      setSaving(false)
      return
    }

    let finalBadgeUrl = badgeUrl

    if (badgeFile) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(badgeFile.type)) {
        setMessage('Use a JPG, PNG or WebP image.')
        setSaving(false)
        return
      }

      if (badgeFile.size > 5 * 1024 * 1024) {
        setMessage('Badge must be smaller than 5 MB.')
        setSaving(false)
        return
      }

      const extension = badgeFile.type === 'image/png'
        ? 'png'
        : badgeFile.type === 'image/webp' ? 'webp' : 'jpg'

      const path = `${user.id}/${teamId}-${Date.now()}.${extension}`

      const { error: uploadError } = await supabase.storage
        .from('club-badges')
        .upload(path, badgeFile, { upsert: true })

      if (uploadError) {
        setMessage(uploadError.message)
        setSaving(false)
        return
      }

      const { data: publicData } = supabase.storage
        .from('club-badges')
        .getPublicUrl(path)

      finalBadgeUrl = publicData.publicUrl
    }

    const { error } = await supabase
      .from('teams')
      .update({
        name: name.trim(),
        abbreviation: abbreviation.trim().toUpperCase(),
        description: description.trim(),
        badge_url: finalBadgeUrl || null
      })
      .eq('id', teamId)
      .eq('owner_id', user.id)

    if (error) {
      setMessage(error.message)
    } else {
      setBadgeUrl(finalBadgeUrl)
      setBadgeFile(null)
      setMessage('Club profile saved successfully.')
      await loadTeams()
    }

    setSaving(false)
  }

  if (loading) {
    return <main className="min-h-screen bg-gray-950 text-white p-8">Loading club settings...</main>
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-3xl mx-auto">
        <p className="text-blue-400 font-semibold text-sm">NVPL CLUB MANAGEMENT</p>
        <h1 className="text-4xl font-bold mt-2 mb-6">Club Settings</h1>

        {teams.length === 0 ? (
          <p className="bg-gray-900 p-6 rounded-xl">
            You do not own a club yet.
          </p>
        ) : (
          <>
            {teams.length > 1 && (
              <select
                value={teamId}
                onChange={event => {
                  const team = teams.find(item => item.id === event.target.value)
                  if (team) selectTeam(team)
                }}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 mb-6"
              >
                {teams.map(team => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            )}

            <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
              <div className="flex items-center gap-5">
                {badgeUrl ? (
                  <img src={badgeUrl} alt="Club badge" className="w-24 h-24 object-contain rounded-xl bg-gray-800 p-2" />
                ) : (
                  <div className="w-24 h-24 bg-gray-800 rounded-xl flex items-center justify-center text-gray-500">
                    No badge
                  </div>
                )}

                <div>
                  <label className="block font-semibold mb-2">Club badge</label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={event => setBadgeFile(event.target.files?.[0] || null)}
                    className="text-sm text-gray-400 max-w-full"
                  />
                  {badgeFile && <p className="text-xs text-blue-400 mt-2">{badgeFile.name}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Club name</label>
                <input
                  value={name}
                  onChange={event => setName(event.target.value)}
                  maxLength={60}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Abbreviation</label>
                <input
                  value={abbreviation}
                  onChange={event => setAbbreviation(event.target.value)}
                  maxLength={6}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Club description</label>
                <textarea
                  value={description}
                  onChange={event => setDescription(event.target.value)}
                  maxLength={500}
                  rows={5}
                  placeholder="Tell everyone about your club..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3"
                />
                <p className="text-xs text-gray-500 mt-1">{description.length}/500</p>
              </div>

              <div className="text-sm text-gray-400">
                Region: {teams.find(team => team.id === teamId)?.region}
              </div>

              {message && <p className="text-sm text-blue-300">{message}</p>}

              <button
                onClick={saveClub}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-6 py-3 rounded-lg font-semibold"
              >
                {saving ? 'Saving...' : 'Save club profile'}
              </button>
            </section>

            <a
              href={`/club/${teamId}`}
              className="inline-block mt-6 text-blue-400 hover:underline"
            >
              View public club profile →
            </a>
          </>
        )}
      </div>
    </main>
  )
}
