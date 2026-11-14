
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Stats = {
  competitions: number
  clubs: number
  players: number
  fixtures: number
  posts: number
  reports: number
  tickets: number
  admins: number
}

const initialStats: Stats = {
  competitions: 0,
  clubs: 0,
  players: 0,
  fixtures: 0,
  posts: 0,
  reports: 0,
  tickets: 0,
  admins: 0,
}

const sections = [
  { label: 'Competitions', href: '/admin/competitions' },
  { label: 'Clubs', href: '/admin/clubs' },
  { label: 'Players', href: '/admin/players' },
  { label: 'Player Rankings', href: '/admin/rankings' },
  { label: 'Fixtures & Results', href: '/admin/fixtures' },
  { label: 'Community', href: '/admin/community' },
  { label: 'Moderation', href: '/admin/community' },
  { label: 'Support', href: '/support' },
  { label: 'Administrators', href: '/admin/permissions' },
  { label: 'Settings', href: '/admin/management' },
]

const statItems = [
  { key: 'competitions', label: 'Competitions', icon: '🏆', href: '/admin/competitions' },
  { key: 'clubs', label: 'Clubs', icon: '🛡️', href: '/admin/clubs' },
  { key: 'players', label: 'Players', icon: '👤', href: '/admin/players' },
  { key: 'fixtures', label: 'Fixtures', icon: '⚽', href: '/admin/fixtures' },
  { key: 'posts', label: 'Community Posts', icon: '💬', href: '/admin/community' },
  { key: 'reports', label: 'Reports', icon: '🚩', href: '/admin/community' },
  { key: 'tickets', label: 'Support Tickets', icon: '🎫', href: '/support' },
  { key: 'admins', label: 'Administrators', icon: '🔐', href: '/admin/permissions' },
] as const

export default function AdminPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [authorized, setAuthorized] = useState(false)
  const [error, setError] = useState('')
  const [stats, setStats] = useState<Stats>(initialStats)
  const [email, setEmail] = useState('')

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

        if (!active) return

        setEmail(user.email ?? '')

        const { data: isAdmin, error: adminError } =
          await supabase.rpc('is_nvpl_super_admin')

        if (adminError) {
          throw new Error('Could not verify administrator permissions.')
        }

        if (!isAdmin) {
          setAuthorized(false)
          setLoading(false)
          return
        }

        if (!active) return

        setAuthorized(true)
        await loadStats(active)
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error ? err.message : 'Something went wrong.'
          )
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    initialize()

    return () => {
      active = false
    }
  }, [router])

  async function loadStats(active = true) {
    setRefreshing(true)
    setError('')

    const tables: { key: keyof Stats; table: string }[] = [
      { key: 'competitions', table: 'competitions' },
      { key: 'clubs', table: 'teams' },
      { key: 'players', table: 'player_profiles' },
      { key: 'fixtures', table: 'nvpl_fixtures' },
      { key: 'posts', table: 'nvpl_community_posts' },
      { key: 'reports', table: 'nvpl_community_reports' },
      { key: 'tickets', table: 'nvpl_support_tickets' },
      { key: 'admins', table: 'nvpl_admins' },
    ]

    const results = await Promise.all(
      tables.map(async ({ key, table }) => {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true })

        return {
          key,
          count: error ? null : count ?? 0,
        }
      })
    )

    if (active) {
      setStats(previous => {
        const updated = { ...previous }

        results.forEach(result => {
          if (result.count !== null) {
            updated[result.key] = result.count
          }
        })

        return updated
      })

      const failed = results.filter(result => result.count === null)

      if (failed.length > 0) {
        setError(
          `Some statistics could not load: ${failed.map(item => item.key).join(', ')}. Check database permissions.`
        )
      }
    }

    setRefreshing(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#080b12] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-3xl mb-3">NVPL</div>
          <p className="text-gray-400">Checking administrator access...</p>
        </div>
      </main>
    )
  }

  if (!authorized) {
    return (
      <main className="min-h-screen bg-[#080b12] text-white flex items-center justify-center p-6">
        <div className="bg-[#111722] border border-red-500/30 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-gray-400 mb-6">
            This page is restricted to NVPL Super Administrators.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-white text-black font-semibold px-6 py-3 rounded-xl"
          >
            Return to Dashboard
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#080b12] text-white">
      <div className="flex min-h-screen">

        <aside className="flex w-56 md:w-64 shrink-0 bg-[#0d121c] border-r border-white/10 p-3 md:p-6 flex-col">
          <Link href="/admin" className="mb-10">
            <h1 className="text-2xl font-black tracking-wider">
              NVPL<span className="text-blue-500">.</span>
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Administration Centre
            </p>
          </Link>

          <div className="text-xs uppercase tracking-widest text-gray-500 mb-3">
            Management
          </div>

          <nav className="space-y-2">
            <Link
              href="/admin"
              className="block bg-blue-600/15 text-blue-400 rounded-xl px-3 py-3 font-semibold text-sm"
            >
              Overview
            </Link>

            {sections.map(item => (
              <Link
                key={item.label}
                href={item.href}
                className="block px-3 py-3 rounded-xl text-gray-400 text-sm hover:bg-white/5 hover:text-white transition"
              >
                {item.label}
                <span className="float-right text-blue-400">→</span>
              </Link>
            ))}
          </nav>

          <div className="mt-auto border-t border-white/10 pt-5">
            <p className="text-xs text-gray-500 mb-1">Signed in as</p>
            <p className="text-sm truncate mb-4">{email}</p>
            <button
              onClick={handleSignOut}
              className="w-full text-left text-sm text-red-400 hover:text-red-300"
            >
              Sign out
            </button>
          </div>
        </aside>

        <section className="flex-1 min-w-0 p-4 md:p-10">
          <div className="flex flex-wrap justify-between items-center gap-4 mb-10">
            <div>
              <p className="text-blue-400 text-sm font-semibold mb-2">
                NVPL CONTROL PANEL
              </p>
              <h2 className="text-3xl md:text-4xl font-black">
                Admin Overview
              </h2>
              <p className="text-gray-400 mt-2">
                Manage your international Pro Clubs platform.
              </p>
            </div>

            <button
              onClick={() => loadStats()}
              disabled={refreshing}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-5 py-3 rounded-xl font-semibold"
            >
              {refreshing ? 'Refreshing...' : '↻ Refresh Data'}
            </button>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl p-4 mb-6">
              {error}
            </div>
          )}

          <div className="bg-gradient-to-r from-blue-600/20 to-[#111722] border border-blue-500/20 rounded-2xl p-6 mb-8">
            <div className="flex flex-wrap justify-between gap-4 items-center">
              <div>
                <p className="text-blue-400 text-sm font-semibold">
                  ADMINISTRATOR ACCESS
                </p>
                <h3 className="text-2xl font-bold mt-2">
                  Super Administrator
                </h3>
                <p className="text-gray-400 text-sm mt-2">
                  Full platform administration account.
                </p>
              </div>
              <div className="bg-green-500/15 text-green-400 px-4 py-2 rounded-full text-sm font-semibold">
                ● Verified
              </div>
            </div>
          </div>

          <div className="mb-5">
            <h3 className="text-xl font-bold">Platform Statistics</h3>
            <p className="text-gray-500 text-sm mt-1">
              Select a section to manage it.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {statItems.map(item => (
              <Link
                key={item.key}
                href={item.href}
                className="bg-[#111722] border border-white/10 rounded-2xl p-5 hover:border-blue-500/60 hover:bg-[#151e2c] transition block"
              >
                <div className="flex justify-between items-center mb-5">
                  <span className="text-2xl">{item.icon}</span>
                  <span className="text-xs text-blue-400">OPEN →</span>
                </div>
                <div className="text-3xl font-black">
                  {stats[item.key].toLocaleString()}
                </div>
                <p className="text-gray-400 text-sm mt-2">
                  {item.label}
                </p>
              </Link>
            ))}
          </div>

          <div className="mt-5">
            <Link
              href="/admin/rankings"
              className="flex items-center justify-between bg-[#111722] border border-blue-500/30 rounded-2xl p-5 hover:border-blue-500 transition"
            >
              <div>
                <h3 className="font-bold text-lg">Player Rankings</h3>
                <p className="text-sm text-gray-400 mt-1">
                  Edit player ranks, values, tiers and images.
                </p>
              </div>
              <span className="text-blue-400 font-bold">OPEN →</span>
            </Link>
          </div>

          <div className="mt-10 bg-[#111722] border border-white/10 rounded-2xl p-6">
            <h3 className="text-xl font-bold mb-2">
              NVPL Administration
            </h3>
            <p className="text-gray-400 text-sm leading-6">
              Use the navigation panel to access your existing management
              sections and administer the NVPL platform.
            </p>
          </div>

          <p className="text-xs text-gray-600 mt-8">
            NVPL Administration • Beta Development
          </p>
        </section>
      </div>
    </main>
  )
}
