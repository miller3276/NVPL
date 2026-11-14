'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Competition = {
  id: string
  name: string
  region: string
  division: string | null
  season: string | null
  status: string
  start_date: string | null
  description: string | null
}

type Post = {
  id: string
  author_id: string
  author_username: string | null
  author_avatar: string | null
  content: string
  image_url: string | null
  pinned: boolean
  featured: boolean
  created_at: string
}

const menuLinks = [
  { name: 'HOME', href: '/', icon: '⌂' },
  { name: 'ALL LEAGUES', href: '/competitions', icon: '🏆' },
  { name: 'COMPETITIONS', href: '/competitions', icon: '⚽' },
  { name: 'RANKINGS', href: '/rankings', icon: '📊' },
  { name: 'CLUBS', href: '/clubs', icon: '🛡️' },
  { name: 'PLAYERS', href: '/players', icon: '👤' },
  { name: 'FIXTURES', href: '/fixtures', icon: '📅' },
  { name: 'PLAYER MARKET', href: '/market', icon: '💎' },
  { name: 'MESSAGES', href: '/messages', icon: '✉️' },
  { name: 'NOTIFICATIONS', href: '/notifications', icon: '🔔' },
  { name: 'COMMUNITY', href: '/community', icon: '💬' },
  { name: 'SUPPORT', href: '/support', icon: '🎧' },
  { name: 'MY PROFILE', href: '/dashboard', icon: '⚙️' },
]

function formatDate(date: string | null) {
  if (!date) return 'DATE TBA'

  return new Date(`${date}T00:00:00`).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function timeAgo(date: string) {
  const seconds = Math.floor(
    (Date.now() - new Date(date).getTime()) / 1000
  )

  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`

  return new Date(date).toLocaleDateString('en-AU')
}

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [checking, setChecking] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [loadingData, setLoadingData] = useState(false)

  useEffect(() => {
    let active = true

    async function loadHome() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!active) return

      setUser(user)

      if (user) {
        const { data: adminData } = await supabase.rpc(
          'is_nvpl_super_admin'
        )

        if (active) setIsAdmin(adminData === true)
      }

      if (active) setChecking(false)
    }

    loadHome()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return

      setUser(session?.user ?? null)

      if (!session?.user) {
        setIsAdmin(false)
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!user) return

    let active = true

    async function loadDashboard() {
      setLoadingData(true)

      const today = new Date().toISOString().slice(0, 10)

      const [competitionResult, postResult] = await Promise.all([
        supabase
          .from('competitions')
          .select(
            'id, name, region, division, season, status, start_date, description'
          )
          .gte('start_date', today)
          .order('start_date', { ascending: true })
          .limit(5),

        supabase
          .from('nvpl_community_posts')
          .select(
            'id, author_id, author_username, author_avatar, content, image_url, pinned, featured, created_at'
          )
          .order('pinned', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(6),
      ])

      if (!active) return

      if (!competitionResult.error) {
        setCompetitions(competitionResult.data ?? [])
      }

      if (!postResult.error) {
        setPosts(postResult.data ?? [])
      }

      setLoadingData(false)
    }

    loadDashboard()

    return () => {
      active = false
    }
  }, [user])

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (checking) {
    return (
      <main className="min-h-screen bg-[#080b12] text-white flex items-center justify-center">
        <div className="text-3xl font-black tracking-widest">NVPL.</div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#080b12] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#080b12]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-2xl font-black italic">
              N
            </div>
            <div>
              <div className="text-xl font-black tracking-widest">NVPL</div>
              <div className="text-[9px] tracking-[3px] text-gray-500">
                NATIONAL VIRTUAL PRO LEAGUE
              </div>
            </div>
          </Link>

          {user ? (
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle navigation menu"
              className="flex h-11 w-11 flex-col items-center justify-center gap-1.5 rounded-lg border border-white/10 hover:border-blue-500"
            >
              <span className={`h-0.5 w-5 bg-white transition ${menuOpen ? 'translate-y-2 rotate-45' : ''}`} />
              <span className={`h-0.5 w-5 bg-white transition ${menuOpen ? 'opacity-0' : ''}`} />
              <span className={`h-0.5 w-5 bg-white transition ${menuOpen ? '-translate-y-2 -rotate-45' : ''}`} />
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <Link href="/login" className="rounded-lg border border-white/20 px-5 py-3 text-xs font-bold hover:bg-white/10">
                LOGIN
              </Link>
              <Link href="/login" className="rounded-lg bg-blue-600 px-5 py-3 text-xs font-bold hover:bg-blue-500">
                JOIN NVPL
              </Link>
            </div>
          )}
        </div>
      </header>

      {user ? (
        <>
          {menuOpen && (
            <div className="fixed inset-0 z-50 bg-black/70" onClick={() => setMenuOpen(false)}>
              <aside
                className="ml-auto flex h-full w-full max-w-sm flex-col overflow-y-auto border-l border-white/10 bg-[#0d1422] p-6"
                onClick={event => event.stopPropagation()}
              >
                <div className="mb-8 flex items-center justify-between">
                  <div className="text-xl font-black tracking-widest">NVPL MENU</div>
                  <button onClick={() => setMenuOpen(false)} className="text-2xl text-gray-400 hover:text-white">
                    ×
                  </button>
                </div>

                <div className="mb-6 rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs text-gray-500">SIGNED IN AS</p>
                  <p className="mt-1 break-all font-bold">{user.email}</p>
                </div>

                <nav className="flex-1 space-y-1">
                  {menuLinks.map(item => (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-4 rounded-lg px-4 py-3 text-sm font-bold text-gray-300 transition hover:bg-blue-600/15 hover:text-white"
                    >
                      <span className="w-6 text-lg">{item.icon}</span>
                      {item.name}
                    </Link>
                  ))}

                  {isAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setMenuOpen(false)}
                      className="mt-4 flex items-center gap-4 rounded-lg border border-blue-500/30 bg-blue-600/10 px-4 py-3 text-sm font-bold text-blue-400 hover:bg-blue-600/20"
                    >
                      <span className="w-6 text-lg">🛠️</span>
                      ADMIN PANEL
                    </Link>
                  )}
                </nav>

                <button
                  onClick={signOut}
                  className="mt-8 rounded-lg border border-white/15 px-5 py-4 text-sm font-bold text-gray-300 hover:bg-white/10"
                >
                  SIGN OUT
                </button>
              </aside>
            </div>
          )}

          <div className="mx-auto max-w-7xl px-5 py-8 md:py-12">
            <section className="mb-10 overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-r from-blue-950 via-[#101827] to-[#101827] p-7 md:p-10">
              <p className="text-xs font-bold tracking-[4px] text-blue-400">
                NATIONAL VIRTUAL PRO LEAGUE
              </p>
              <h1 className="mt-4 text-3xl font-black md:text-5xl">
                WELCOME BACK.
              </h1>
              <p className="mt-3 text-gray-400">
                Your home for competitive Pro Clubs.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/community" className="rounded-lg bg-blue-600 px-5 py-3 text-xs font-bold hover:bg-blue-500">
                  VISIT COMMUNITY →
                </Link>
                <Link href="/competitions" className="rounded-lg border border-white/15 px-5 py-3 text-xs font-bold hover:bg-white/10">
                  EXPLORE LEAGUES
                </Link>
              </div>
            </section>

            <section className="mb-12">
              <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-bold tracking-[3px] text-blue-400">
                    THE NEXT MATCHDAY STARTS HERE
                  </p>
                  <h2 className="mt-2 text-2xl font-black md:text-3xl">
                    UPCOMING COMPETITIONS
                  </h2>
                </div>
                <Link href="/competitions" className="shrink-0 text-xs font-bold text-blue-400 hover:text-blue-300">
                  VIEW ALL →
                </Link>
              </div>

              {loadingData ? (
                <div className="rounded-xl border border-white/10 bg-[#101827] p-8 text-center text-gray-400">
                  Loading competitions...
                </div>
              ) : competitions.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-[#101827] p-8">
                  <p className="font-bold">No upcoming competitions listed yet.</p>
                  <p className="mt-2 text-sm text-gray-500">
                    New competitions will appear here when their start dates are announced.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {competitions.map(comp => (
                    <Link
                      key={comp.id}
                      href="/competitions"
                      className="group rounded-xl border border-white/10 bg-[#101827] p-6 transition hover:-translate-y-1 hover:border-blue-500/60"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="rounded-md bg-blue-600/15 px-3 py-1 text-xs font-black text-blue-400">
                          {comp.region}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                          {comp.status}
                        </span>
                      </div>
                      <h3 className="mt-5 text-xl font-black group-hover:text-blue-400">
                        {comp.name}
                      </h3>
                      <p className="mt-2 text-sm text-gray-400">
                        {[comp.division, comp.season].filter(Boolean).join(' • ') || 'NVPL Competition'}
                      </p>
                      <div className="mt-6 border-t border-white/10 pt-4">
                        <p className="text-xs text-gray-500">START DATE</p>
                        <p className="mt-1 font-bold">{formatDate(comp.start_date)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-bold tracking-[3px] text-blue-400">
                    WHAT'S HAPPENING
                  </p>
                  <h2 className="mt-2 text-2xl font-black md:text-3xl">
                    NVPL COMMUNITY
                  </h2>
                </div>
                <Link href="/community" className="shrink-0 text-xs font-bold text-blue-400 hover:text-blue-300">
                  OPEN COMMUNITY →
                </Link>
              </div>

              {loadingData ? (
                <div className="rounded-xl border border-white/10 bg-[#101827] p-8 text-center text-gray-400">
                  Loading community...
                </div>
              ) : posts.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-[#101827] p-8">
                  <p className="font-bold">The community is waiting for its first post.</p>
                  <p className="mt-2 text-sm text-gray-500">
                    Head into the community to see discussions and updates.
                  </p>
                  <Link href="/community" className="mt-5 inline-block text-sm font-bold text-blue-400">
                    VISIT COMMUNITY →
                  </Link>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {posts.map(post => (
                    <article
                      key={post.id}
                      className="overflow-hidden rounded-xl border border-white/10 bg-[#101827]"
                    >
                      <div className="flex items-center gap-3 p-5">
                        {post.author_avatar ? (
                          <img
                            src={post.author_avatar}
                            alt=""
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 font-black">
                            {(post.author_username || 'N').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold">
                            {post.author_username || 'NVPL Member'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {timeAgo(post.created_at)}
                          </p>
                        </div>
                        {post.pinned && (
                          <span className="text-xs font-bold text-blue-400">📌 PINNED</span>
                        )}
                        {post.featured && (
                          <span className="text-xs font-bold text-yellow-400">★ FEATURED</span>
                        )}
                      </div>

                      <p className="whitespace-pre-wrap px-5 pb-5 text-sm leading-7 text-gray-300">
                        {post.content}
                      </p>

                      {post.image_url && (
                        <img
                          src={post.image_url}
                          alt="Community post"
                          className="max-h-80 w-full object-cover"
                        />
                      )}

                      <div className="border-t border-white/10 px-5 py-4">
                        <Link href="/community" className="text-xs font-bold text-blue-400 hover:text-blue-300">
                          VIEW DISCUSSION →
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="mt-12 grid gap-4 sm:grid-cols-3">
              {[
                { name: 'ALL LEAGUES', detail: 'Explore every region', href: '/competitions', icon: '🏆' },
                { name: 'PLAYER RANKINGS', detail: 'See the competition', href: '/rankings', icon: '📊' },
                { name: 'GET SUPPORT', detail: 'We are here to help', href: '/support', icon: '🎧' },
              ].map(item => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="flex items-center gap-4 rounded-xl border border-white/10 bg-[#101827] p-5 transition hover:border-blue-500/50"
                >
                  <span className="text-3xl">{item.icon}</span>
                  <div>
                    <p className="font-black">{item.name}</p>
                    <p className="mt-1 text-xs text-gray-500">{item.detail}</p>
                  </div>
                  <span className="ml-auto text-blue-400">→</span>
                </Link>
              ))}
            </section>
          </div>
        </>
      ) : (
        <section className="mx-auto max-w-7xl px-6 py-32">
          <p className="text-xs font-bold tracking-[4px] text-blue-400">
            THE NEXT GENERATION OF PRO CLUBS
          </p>
          <h1 className="mt-6 text-5xl font-black leading-tight md:text-7xl">
            ONE GAME.
            <br />
            <span className="text-blue-500">THREE REGIONS.</span>
            <br />
            ONE COMMUNITY.
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-gray-400">
            A competitive home for Pro Clubs. Discover competitions,
            represent your team and compete against the best.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/login" className="rounded-lg bg-blue-600 px-7 py-4 text-sm font-bold hover:bg-blue-500">
              JOIN NVPL →
            </Link>
            <Link href="/community" className="rounded-lg border border-white/20 px-7 py-4 text-sm font-bold hover:bg-white/10">
              COMMUNITY
            </Link>
          </div>

          <div className="mt-20 grid gap-5 md:grid-cols-3">
            {[
              ['OCE', 'OCEANIA'],
              ['EU', 'EUROPE'],
              ['NA', 'NORTH AMERICA'],
            ].map(([code, name]) => (
              <div key={code} className="rounded-xl border border-white/10 bg-[#101827] p-8">
                <p className="text-5xl font-black text-blue-500">{code}</p>
                <p className="mt-4 font-bold">{name}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className="border-t border-white/10 px-6 py-8">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-4 text-xs text-gray-500">
          <span className="font-black tracking-widest text-white">NVPL.</span>
          <span>National Virtual Pro League © 2026</span>
          <Link href="/support" className="hover:text-white">SUPPORT</Link>
        </div>
      </footer>
    </main>
  )
}