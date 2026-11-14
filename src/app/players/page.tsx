
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function PlayersPage() {
  const router = useRouter()
  const [gamertag, setGamertag] = useState('')
  const [position, setPosition] = useState('ST')
  const [region, setRegion] = useState('OCE')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function registerPlayer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    const { error } = await supabase
      .from('player_profiles')
      .insert({
        user_id: user.id,
        gamertag: gamertag.trim(),
        position,
        region
      })

    if (error) {
      setMessage(error.code === '23505'
        ? 'You already have a player profile.'
        : error.message)
    } else {
      setMessage('Player profile created successfully!')
    }

    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-[#080d18] text-white p-8">
      <div className="max-w-xl mx-auto">
        <Link href="/dashboard" className="text-blue-400">
          ← Back to Dashboard
        </Link>

        <h1 className="text-3xl font-bold mt-8">
          Register Player
        </h1>

        <p className="text-gray-400 mt-2 mb-8">
          Create your official NVPL player profile.
        </p>

        <form onSubmit={registerPlayer} className="space-y-5">
          <div>
            <label className="block mb-2">Gamertag</label>
            <input
              required
              maxLength={30}
              value={gamertag}
              onChange={(e) => setGamertag(e.target.value)}
              className="w-full p-3 rounded-lg bg-[#151e30] border border-gray-700"
              placeholder="Enter your EA gamertag"
            />
          </div>

          <div>
            <label className="block mb-2">Position</label>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="w-full p-3 rounded-lg bg-[#151e30] border border-gray-700"
            >
              {['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST'].map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block mb-2">Region</label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full p-3 rounded-lg bg-[#151e30] border border-gray-700"
            >
              <option value="OCE">Oceania</option>
              <option value="EU">Europe</option>
              <option value="NA">North America</option>
            </select>
          </div>

          <button
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 p-3 rounded-lg font-bold"
          >
            {loading ? 'Creating profile...' : 'Create Player Profile'}
          </button>

          {message && (
            <p className="text-sm text-blue-300">{message}</p>
          )}
        </form>

        <p className="text-gray-500 text-sm mt-6">
          New players begin at $3M and Unranked.
        </p>
      </div>
    </main>
  )
}
