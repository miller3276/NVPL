
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function TeamsPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [abbreviation, setAbbreviation] = useState('')
  const [region, setRegion] = useState('OCE')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    async function checkLogin() {
      const { data } = await supabase.auth.getUser()

      if (!data.user) {
        router.replace('/login')
      } else {
        setChecking(false)
      }
    }

    checkLogin()
  }, [router])

  async function createTeam(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) {
      setMessage('Please log in again.')
      setLoading(false)
      return
    }

    const { error } = await supabase.from('teams').insert({
      name: name.trim(),
      abbreviation: abbreviation.trim().toUpperCase(),
      region,
      owner_id: userData.user.id,
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Club created successfully!')
      setName('')
      setAbbreviation('')
    }

    setLoading(false)
  }

  if (checking) {
    return <main className="min-h-screen bg-[#080d18] text-white flex items-center justify-center">Loading...</main>
  }

  return (
    <main className="min-h-screen bg-[#080d18] text-white p-6">
      <div className="max-w-2xl mx-auto">
        <Link href="/dashboard" className="text-blue-400 hover:text-blue-300">
          ← Back to dashboard
        </Link>

        <h1 className="text-4xl font-black mt-10">Create a Club</h1>
        <p className="text-gray-400 mt-2">
          Register your club in the National Virtual Pro League.
        </p>

        <form onSubmit={createTeam} className="mt-8 space-y-6 rounded-2xl border border-white/10 bg-[#111a2b] p-7">
          <div>
            <label className="block text-sm mb-2">Club name</label>
            <input
              required
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your club name"
              className="w-full rounded-lg bg-[#080d18] border border-white/10 p-3 outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm mb-2">Club abbreviation</label>
            <input
              required
              minLength={3}
              maxLength={5}
              value={abbreviation}
              onChange={(e) => setAbbreviation(e.target.value.toUpperCase())}
              placeholder="e.g. NVPL"
              className="w-full rounded-lg bg-[#080d18] border border-white/10 p-3 outline-none focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-2">3–5 characters.</p>
          </div>

          <div>
            <label className="block text-sm mb-2">Region</label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full rounded-lg bg-[#080d18] border border-white/10 p-3"
            >
              <option value="OCE">Oceania</option>
              <option value="EU">Europe</option>
              <option value="NA">North America</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 p-3 font-bold disabled:opacity-50"
          >
            {loading ? 'Creating club...' : 'Create club'}
          </button>

          {message && <p className="text-sm text-blue-300">{message}</p>}
        </form>
      </div>
    </main>
  )
}
