
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
  is_ranked: boolean
}

const categories = ['ATT', 'MID', 'CDM', 'FULLBACKS', 'CB', 'GK']
const tiers = ['Gold', 'Silver', 'Bronze', 'Elite', 'Diamond']

export default function AdminRankingsPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function loadPlayers() {
      const { data: admin, error: adminError } =
        await supabase.rpc('is_nvpl_super_admin')

      if (adminError || !admin) {
        setMessage('You do not have permission to access this page.')
        setLoading(false)
        return
      }

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
          market_value_millions,
          is_ranked
        `)
        .order('gamertag')

      if (error) {
        setMessage(error.message)
      } else {
        setPlayers((data ?? []) as Player[])
      }

      setLoading(false)
    }

    loadPlayers()
  }, [])

  function updatePlayer(
    userId: string,
    field: keyof Player,
    value: string | number | boolean | null
  ) {
    setPlayers(current =>
      current.map(player =>
        player.user_id === userId
          ? { ...player, [field]: value }
          : player
      )
    )
  }

  async function uploadImage(userId: string, file: File) {
    if (!file.type.startsWith('image/')) {
      setMessage('Please choose an image file.')
      return
    }

    const extension = file.name.split('.').pop()?.toLowerCase() || 'png'
    const path = `${userId}/${Date.now()}.${extension}`

    const { error } = await supabase.storage
      .from('ranking-images')
      .upload(path, file, { upsert: true })

    if (error) {
      setMessage(error.message)
      return
    }

    const { data } = supabase.storage
      .from('ranking-images')
      .getPublicUrl(path)

    updatePlayer(userId, 'rank_image_url', data.publicUrl)
    setMessage('Image uploaded. Save the player to apply it.')
  }

  async function savePlayer(player: Player) {
    const value = Number(player.market_value_millions)

    if (!Number.isFinite(value) || value < 0 || value > 15) {
      setMessage('Market value must be between €0M and €15M.')
      return
    }

    if (
      player.ranking_number !== null &&
      (!Number.isInteger(Number(player.ranking_number)) ||
        Number(player.ranking_number) < 1)
    ) {
      setMessage('Ranking number must be a positive whole number.')
      return
    }

    setSaving(player.user_id)
    setMessage('')

    const { error } = await supabase
      .from('player_profiles')
      .update({
        ranking_number: player.ranking_number,
        ranking_category: player.ranking_category,
        rank_tier: player.rank_tier,
        rank_image_url: player.rank_image_url,
        market_value_millions: value,
        is_ranked: player.is_ranked,
      })
      .eq('user_id', player.user_id)

    if (error) {
      setMessage(error.message)
    } else {
      setMessage(`${player.gamertag} saved successfully.`)
    }

    setSaving(null)
  }

  return (
    <main className="min-h-screen bg-[#080d18] text-white">
      <nav className="border-b border-white/10 bg-[#101a2b] px-5 py-5">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link href="/" className="text-2xl font-black">
            NVPL<span className="text-blue-500">.</span>
          </Link>
          <Link href="/admin" className="text-sm text-gray-400 hover:text-white">
            Admin dashboard
          </Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-5 py-10">
        <p className="text-blue-400 text-xs font-black tracking-[0.3em]">
          ADMIN CONTROL PANEL
        </p>

        <h1 className="text-4xl font-black mt-3">PLAYER RANKINGS</h1>
        <p className="text-gray-400 mt-3">
          Edit player ranks, values, tiers and ranking images.
        </p>

        {message && (
          <div className="mt-6 rounded-xl border border-white/10 bg-[#111a2b] p-4 text-sm text-gray-300">
            {message}
          </div>
        )}

        {loading ? (
          <p className="text-gray-400 mt-10">Loading players...</p>
        ) : players.length === 0 ? (
          <p className="text-gray-400 mt-10">No players found, or access was denied.</p>
        ) : (
          <div className="mt-8 space-y-5">
            {players.map(player => (
              <div
                key={player.user_id}
                className="bg-[#111a2b] border border-white/10 rounded-2xl p-5"
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-[#202d43] flex items-center justify-center">
                    {player.avatar_url ? (
                      <img src={player.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-black text-gray-400">
                        {player.gamertag.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h2 className="font-black text-lg truncate">
                      {player.username || player.gamertag}
                    </h2>
                    <p className="text-xs text-gray-500">
                      {player.gamertag} · {player.region}
                    </p>
                  </div>

                  <label className="flex items-center gap-2 text-sm text-gray-300">
                    <input
                      type="checkbox"
                      checked={player.is_ranked}
                      onChange={e =>
                        updatePlayer(player.user_id, 'is_ranked', e.target.checked)
                      }
                      className="accent-blue-500"
                    />
                    Ranked
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <label className="text-xs text-gray-400">
                    RANK NUMBER
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={player.ranking_number ?? ''}
                      onChange={e =>
                        updatePlayer(
                          player.user_id,
                          'ranking_number',
                          e.target.value === '' ? null : Number(e.target.value)
                        )
                      }
                      placeholder="e.g. 24"
                      className="mt-2 w-full rounded-lg bg-[#080d18] border border-white/10 p-3 text-white"
                    />
                  </label>

                  <label className="text-xs text-gray-400">
                    POSITION CATEGORY
                    <select
                      value={player.ranking_category || ''}
                      onChange={e =>
                        updatePlayer(player.user_id, 'ranking_category', e.target.value || null)
                      }
                      className="mt-2 w-full rounded-lg bg-[#080d18] border border-white/10 p-3 text-white"
                    >
                      <option value="">Choose category</option>
                      {categories.map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </label>

                  <label className="text-xs text-gray-400">
                    MARKET VALUE (€M)
                    <input
                      type="number"
                      min="0"
                      max="15"
                      step="0.1"
                      value={player.market_value_millions}
                      onChange={e =>
                        updatePlayer(
                          player.user_id,
                          'market_value_millions',
                          e.target.value === '' ? 0 : Number(e.target.value)
                        )
                      }
                      className="mt-2 w-full rounded-lg bg-[#080d18] border border-white/10 p-3 text-white"
                    />
                  </label>

                  <label className="text-xs text-gray-400">
                    RANK TIER / COLOUR
                    <select
                      value={player.rank_tier || 'Bronze'}
                      onChange={e =>
                        updatePlayer(player.user_id, 'rank_tier', e.target.value)
                      }
                      className="mt-2 w-full rounded-lg bg-[#080d18] border border-white/10 p-3 text-white"
                    >
                      {tiers.map(tier => (
                        <option key={tier} value={tier}>{tier}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-4">
                  {player.rank_image_url && (
                    <img
                      src={player.rank_image_url}
                      alt="Ranking tier"
                      className="w-12 h-12 object-contain rounded-lg bg-[#080d18] p-1"
                    />
                  )}

                  <label className="cursor-pointer rounded-lg border border-white/10 bg-[#080d18] px-4 py-3 text-sm font-bold hover:border-blue-500">
                    Upload ranking image
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) uploadImage(player.user_id, file)
                        e.target.value = ''
                      }}
                    />
                  </label>

                  <button
                    onClick={() => savePlayer(player)}
                    disabled={saving === player.user_id}
                    className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-black hover:bg-blue-500 disabled:opacity-50"
                  >
                    {saving === player.user_id ? 'SAVING...' : 'SAVE PLAYER'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
