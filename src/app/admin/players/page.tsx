
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Player = {
  id: string
  user_id: string
  gamertag: string
  position: string | null
  region: string
  market_value_millions: number
  is_ranked: boolean
  admin_override_value_millions: number | null
  bio: string | null
  country: string | null
}

export default function AdminPlayersPage() {
  const router = useRouter()

  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [players, setPlayers] = useState<Player[]>([])
  const [selected, setSelected] = useState<Player | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function initialize() {
      try {
        const { data: { user }, error: authError } =
          await supabase.auth.getUser()

        if (authError || !user) {
          router.replace('/login')
          return
        }

        const { data, error: adminError } =
          await supabase.rpc('is_nvpl_super_admin')

        if (!active) return

        if (adminError || !data) {
          setAuthorized(false)
          setLoading(false)
          return
        }

        setAuthorized(true)
        await loadPlayers('', active)
      } catch {
        if (active) setError('Unable to verify administrator access.')
      } finally {
        if (active) setLoading(false)
      }
    }

    initialize()

    return () => {
      active = false
    }
  }, [router])

  async function loadPlayers(term = search, active = true) {
    setError('')

    let query = supabase
      .from('player_profiles')
      .select(`
        id,
        user_id,
        gamertag,
        position,
        region,
        market_value_millions,
        is_ranked,
        admin_override_value_millions,
        bio,
        country
      `)
      .order('gamertag')
      .limit(100)

    if (term.trim()) {
      query = query.ilike('gamertag', `%${term.trim()}%`)
    }

    const { data, error } = await query

    if (!active) return

    if (error) {
      setError(error.message)
      return
    }

    setPlayers((data ?? []) as Player[])
  }

  async function savePlayer() {
    if (!selected) return

    if (!selected.gamertag.trim() || !selected.region.trim()) {
      setError('Gamertag and region are required.')
      return
    }

    const marketValue = Number(selected.market_value_millions)
    const overrideValue = selected.admin_override_value_millions

    if (!Number.isFinite(marketValue) || marketValue < 0) {
      setError('Enter a valid market value.')
      return
    }

    if (
      overrideValue !== null &&
      (!Number.isFinite(overrideValue) || overrideValue < 0)
    ) {
      setError('Enter a valid override value or leave it blank.')
      return
    }

    setSaving(true)
    setError('')
    setMessage('')

    const { error } = await supabase
      .from('player_profiles')
      .update({
        gamertag: selected.gamertag.trim(),
        position: selected.position || null,
        region: selected.region.trim(),
        country: selected.country || null,
        bio: selected.bio || null,
        market_value_millions: marketValue,
        is_ranked: selected.is_ranked,
        admin_override_value_millions: overrideValue,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selected.id)

    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    setMessage('Player profile updated successfully.')
    setSelected(null)
    await loadPlayers()
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#080b12] text-white flex items-center justify-center">
        Loading player management...
      </main>
    )
  }

  if (!authorized) {
    return (
      <main className="min-h-screen bg-[#080b12] text-white flex items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Access Denied</h1>
          <p className="text-gray-400 mt-3">
            Super Admin access is required.
          </p>
          <button
            onClick={() => router.push('/admin')}
            className="mt-5 bg-blue-600 px-5 py-3 rounded-xl"
          >
            Back to Admin
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#080b12] text-white p-5 md:p-10">
      <div className="max-w-7xl mx-auto">

        <div className="flex flex-wrap justify-between gap-4 mb-8">
          <div>
            <p className="text-blue-400 text-sm font-bold">
              NVPL ADMINISTRATION
            </p>
            <h1 className="text-3xl md:text-4xl font-black mt-2">
              Player Management
            </h1>
            <p className="text-gray-400 mt-2">
              Search, edit and manage registered players.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => router.push('/admin')}
              className="border border-white/15 px-4 py-3 rounded-xl"
            >
              Admin Home
            </button>
            <button
              onClick={signOut}
              className="border border-red-500/30 text-red-400 px-4 py-3 rounded-xl"
            >
              Sign Out
            </button>
          </div>
        </div>

        <div className="bg-[#111722] border border-white/10 rounded-2xl p-5 mb-6">
          <label className="text-sm text-gray-400 block mb-2">
            Search by gamertag
          </label>

          <div className="flex flex-wrap gap-3">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') loadPlayers()
              }}
              placeholder="Enter player gamertag..."
              className="flex-1 min-w-[200px] bg-[#080b12] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-blue-500"
            />

            <button
              onClick={() => loadPlayers()}
              className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-xl font-semibold"
            >
              Search
            </button>

            <button
              onClick={() => {
                setSearch('')
                loadPlayers('')
              }}
              className="border border-white/15 px-5 py-3 rounded-xl"
            >
              Clear
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl p-4 mb-5">
            {error}
          </div>
        )}

        {message && (
          <div className="bg-green-500/10 border border-green-500/30 text-green-300 rounded-xl p-4 mb-5">
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          <section className="bg-[#111722] border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-white/10 flex justify-between">
              <h2 className="font-bold text-lg">Registered Players</h2>
              <span className="text-gray-500 text-sm">
                {players.length} shown
              </span>
            </div>

            <div className="max-h-[650px] overflow-y-auto">
              {players.length === 0 ? (
                <p className="p-6 text-gray-500">
                  No players found.
                </p>
              ) : (
                players.map(player => (
                  <button
                    key={player.id}
                    onClick={() => {
                      setSelected({ ...player })
                      setMessage('')
                      setError('')
                    }}
                    className={`w-full text-left p-5 border-b border-white/5 hover:bg-white/5 ${
                      selected?.id === player.id
                        ? 'bg-blue-600/10 border-l-2 border-l-blue-500'
                        : ''
                    }`}
                  >
                    <div className="flex justify-between gap-3">
                      <div>
                        <p className="font-bold">{player.gamertag}</p>
                        <p className="text-gray-500 text-sm mt-1">
                          {player.position || 'No position'} · {player.region}
                        </p>
                      </div>
                      <span className="text-xs text-blue-400">Edit →</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="bg-[#111722] border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-bold mb-5">Edit Player</h2>

            {!selected ? (
              <div className="text-gray-500 py-12 text-center">
                Select a player from the list to edit their profile.
              </div>
            ) : (
              <div className="space-y-4">

                <div>
                  <label className="text-sm text-gray-400">Gamertag</label>
                  <input
                    value={selected.gamertag}
                    onChange={e => setSelected({
                      ...selected,
                      gamertag: e.target.value,
                    })}
                    className="w-full mt-2 bg-[#080b12] border border-white/10 rounded-xl p-3"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-gray-400">Position</label>
                    <input
                      value={selected.position ?? ''}
                      onChange={e => setSelected({
                        ...selected,
                        position: e.target.value,
                      })}
                      placeholder="e.g. CM"
                      className="w-full mt-2 bg-[#080b12] border border-white/10 rounded-xl p-3"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-gray-400">Region</label>
                    <input
                      value={selected.region}
                      onChange={e => setSelected({
                        ...selected,
                        region: e.target.value,
                      })}
                      className="w-full mt-2 bg-[#080b12] border border-white/10 rounded-xl p-3"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-400">Country</label>
                  <input
                    value={selected.country ?? ''}
                    onChange={e => setSelected({
                      ...selected,
                      country: e.target.value,
                    })}
                    className="w-full mt-2 bg-[#080b12] border border-white/10 rounded-xl p-3"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-400">Bio</label>
                  <textarea
                    value={selected.bio ?? ''}
                    onChange={e => setSelected({
                      ...selected,
                      bio: e.target.value,
                    })}
                    rows={3}
                    className="w-full mt-2 bg-[#080b12] border border-white/10 rounded-xl p-3"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-400">
                    Market Value (Millions)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={selected.market_value_millions}
                    onChange={e => setSelected({
                      ...selected,
                      market_value_millions: Number(e.target.value),
                    })}
                    className="w-full mt-2 bg-[#080b12] border border-white/10 rounded-xl p-3"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-400">
                    Admin Override Value (Millions)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={selected.admin_override_value_millions ?? ''}
                    onChange={e => setSelected({
                      ...selected,
                      admin_override_value_millions:
                        e.target.value === '' ? null : Number(e.target.value),
                    })}
                    placeholder="Leave blank for automatic value"
                    className="w-full mt-2 bg-[#080b12] border border-white/10 rounded-xl p-3"
                  />
                </div>

                <label className="flex items-center gap-3 bg-[#080b12] p-4 rounded-xl">
                  <input
                    type="checkbox"
                    checked={selected.is_ranked}
                    onChange={e => setSelected({
                      ...selected,
                      is_ranked: e.target.checked,
                    })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Player is ranked</span>
                </label>

                <div className="flex gap-3 pt-3">
                  <button
                    onClick={savePlayer}
                    disabled={saving}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl py-3 font-bold"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>

                  <button
                    onClick={() => setSelected(null)}
                    className="border border-white/15 px-5 rounded-xl"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
