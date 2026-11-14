
'use client'

import { useState } from 'react'

type EAResult = {
  success?: boolean
  error?: string
  club?: {
    clubId?: string
    name?: string
  }
  info?: unknown
  overallStats?: unknown
  members?: unknown
  matches?: unknown
  syncedAt?: string
}

export default function EAFCPage() {
  const [clubName, setClubName] = useState('')
  const [platform, setPlatform] = useState('common-gen5')
  const [result, setResult] = useState<EAResult | null>(null)
  const [loading, setLoading] = useState(false)

  async function connectClub() {
    if (!clubName.trim()) {
      setResult({ error: 'Enter your EA club name.' })
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const response = await fetch(
        `/api/eafc/club?name=${encodeURIComponent(
          clubName.trim()
        )}&platform=${platform}`
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'EA connection failed.')
      }

      setResult(data)
    } catch (error) {
      setResult({
        error: error instanceof Error
          ? error.message
          : 'Something went wrong.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#090d18] p-6 text-white">
      <div className="mx-auto max-w-5xl space-y-8">
        <header>
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">
            NVPL Integrations
          </p>
          <h1 className="mt-2 text-4xl font-bold">
            EA SPORTS FC
          </h1>
          <p className="mt-3 text-gray-400">
            Connect your Pro Clubs data to NVPL.
          </p>
        </header>

        <section className="rounded-2xl border border-white/10 bg-[#111827] p-6">
          <h2 className="text-xl font-semibold">Connect an EA Club</h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-gray-400">
                EA Club Name
              </label>
              <input
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                placeholder="Enter your exact club name"
                className="w-full rounded-lg border border-white/10 bg-[#090d18] p-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-400">
                Platform
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#090d18] p-3"
              >
                <option value="common-gen5">Current Generation</option>
                <option value="nx">Nintendo Switch</option>
              </select>
            </div>
          </div>

          <button
            onClick={connectClub}
            disabled={loading}
            className="mt-5 rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? 'Connecting...' : 'Connect EA Club'}
          </button>
        </section>

        {result?.error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
            {result.error}
          </div>
        )}

        {result?.success && (
          <>
            <section className="rounded-2xl border border-green-500/30 bg-green-500/10 p-6">
              <p className="text-sm text-green-300">EA club data retrieved</p>
              <h2 className="mt-2 text-2xl font-bold">
                {result.club?.name || clubName}
              </h2>
              <p className="mt-2 text-sm text-gray-400">
                EA Club ID: {result.club?.clubId || 'Unavailable'}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Retrieved: {result.syncedAt}
              </p>
            </section>

            {[
              ['Club Information', result.info],
              ['Overall Statistics', result.overallStats],
              ['Player Statistics', result.members],
              ['Recent Matches', result.matches],
            ].map(([heading, data]) => (
              <details
                key={heading as string}
                className="rounded-xl border border-white/10 bg-[#111827] p-5"
                open
              >
                <summary className="cursor-pointer font-semibold">
                  {heading as string}
                </summary>
                <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-words text-xs text-gray-300">
                  {JSON.stringify(data, null, 2)}
                </pre>
              </details>
            ))}
          </>
        )}
      </div>
    </main>
  )
}
