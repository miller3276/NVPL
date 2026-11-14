
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type PlayerProfile = {
  user_id: string
  gamertag: string
  username: string | null
  position: string | null
  region: string
  avatar_url: string | null
}

type Competition = {
  id: string
  name: string
  region: string
  season: string
  division: string
  status: string
  start_date: string | null
  image_url: string | null
}

type CommunityPost = {
  id: string
  author_username: string | null
  author_avatar: string | null
  content: string
  image_url: string | null
  pinned: boolean
  created_at: string
}

const regions = ['OCE', 'EU', 'NA']

const navigation = [
  { label: 'Home', href: '/', icon: '⌂' },
  { label: 'My Profile', href: '/dashboard', icon: '◉' },
  { label: 'Community', href: '/community', icon: '◎' },
  { label: 'Competitions', href: '/competitions', icon: '🏆' },
  { label: 'Rankings', href: '/rankings', icon: '↗' },
  { label: 'Clubs', href: '/clubs', icon: '⚽' },
  { label: 'Players', href: '/players', icon: '♙' },
  { label: 'Fixtures', href: '/fixtures', icon: '▦' },
  { label: 'Player Market', href: '/market', icon: '◇' },
  { label: 'Support', href: '/support', icon: '?' },
]

function formatDate(date: string | null) {
  if (!date) return 'Date TBA'

  return new Date(`${date}T00:00:00`).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function timeAgo(date: string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)

  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`

  return new Date(date).toLocaleDateString('en-AU')
}

export default function DashboardPage() {
  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)

  const [userId, setUserId] = useState('')
  const [email, setEmail] = useState('')
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [posts, setPosts] = useState<CommunityPost[]>([])

  const [username, setUsername] = useState('')
  const [gamertag, setGamertag] = useState('')
  const [position, setPosition] = useState('')
  const [region, setRegion] = useState('OCE')

  const [preview, setPreview] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadDashboard = useCallback(async (id: string) => {
    const [profileResult, competitionResult, postResult] = await Promise.all([
      supabase
        .from('player_profiles')
        .select('user_id, gamertag, username, position, region, avatar_url')
        .eq('user_id', id)
        .maybeSingle(),

      supabase
        .from('competitions')
        .select('id, name, region, season, division, status, start_date, image_url')
        .in('status', ['upcoming', 'registration_open'])
        .order('created_at', { ascending: false })
        .limit(6),

      supabase
        .from('nvpl_community_posts')
        .select('id, author_username, author_avatar, content, image_url, pinned, created_at')
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    if (profileResult.error) {
      setError(`Profile: ${profileResult.error.message}`)
    } else if (profileResult.data) {
      const player = profileResult.data as PlayerProfile
      setProfile(player)
      setUsername(player.username ?? '')
      setGamertag(player.gamertag ?? '')
      setPosition(player.position ?? '')
      setRegion(player.region ?? 'OCE')
    } else {
      setProfile(null)
    }

    if (!competitionResult.error) {
      setCompetitions((competitionResult.data ?? []) as Competition[])
    }

    if (!postResult.error) {
      setPosts((postResult.data ?? []) as CommunityPost[])
    }
  }, [])

  useEffect(() => {
    let mounted = true

    async function initialise() {
      const { data, error: sessionError } = await supabase.auth.getSession()

      if (!mounted) return

      if (sessionError || !data.session) {
        router.replace('/login')
        return
      }

      const user = data.session.user
      setUserId(user.id)
      setEmail(user.email ?? '')
      await loadDashboard(user.id)

      if (mounted) setLoading(false)
    }

    initialise()

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) {
          router.replace('/login')
        }
      }
    )

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [router, loadDashboard])

  async function saveProfile() {
    if (!userId) return

    if (!gamertag.trim()) {
      setError('Your EA FC gamertag is required.')
      return
    }

    setSaving(true)
    setError('')
    setMessage('')

    const { error: updateError } = await supabase
      .from('player_profiles')
      .update({
        gamertag: gamertag.trim(),
        username: username.trim() || null,
        position: position.trim() || null,
        region,
      })
      .eq('user_id', userId)

    if (updateError) {
      setError(updateError.message)
    } else {
      setMessage('Profile updated successfully.')
      await loadDashboard(userId)
    }

    setSaving(false)
  }

  async function uploadAvatar(file?: File) {
    if (!file || !userId) return

    setError('')
    setMessage('')

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']

    if (!allowedTypes.includes(file.type)) {
      setError('Choose a JPG, PNG or WEBP image.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Your image must be smaller than 5 MB.')
      return
    }

    setUploading(true)

    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `avatars/${userId}/${Date.now()}.${extension}`

    const { error: uploadError } = await supabase.storage
      .from('nvpl-media')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      })

    if (uploadError) {
      setError(uploadError.message)
      setUploading(false)
      return
    }

    const { data } = supabase.storage
      .from('nvpl-media')
      .getPublicUrl(path)

    const { error: updateError } = await supabase
      .from('player_profiles')
      .update({ avatar_url: data.publicUrl })
      .eq('user_id', userId)

    if (updateError) {
      setError(updateError.message)
    } else {
      setPreview('')
      setMessage('Profile picture uploaded successfully.')
      await loadDashboard(userId)
    }

    setUploading(false)

    if (fileInput.current) {
      fileInput.current.value = ''
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#080d18] text-white flex items-center justify-center">
        Loading your NVPL dashboard...
      </main>
    )
  }

  const displayName = profile?.username || profile?.gamertag || email

  return (
    <main className="min-h-screen bg-[#080d18] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0b1220]/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-black tracking-tight">
            NVPL<span className="text-blue-500">.</span>
          </Link>

          <div className="hidden md:flex items-center gap-7 text-sm text-gray-300">
            <Link href="/" className="hover:text-white">Home</Link>
            <Link href="/community" className="hover:text-white">Community</Link>
            <Link href="/competitions" className="hover:text-white">Competitions</Link>
            <Link href="/rankings" className="hover:text-white">Rankings</Link>
          </div>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-11 h-11 rounded-lg border border-white/10 flex flex-col items-center justify-center gap-1.5 hover:bg-white/5"
            aria-label="Open navigation menu"
          >
            <span className="w-5 h-0.5 bg-white" />
            <span className="w-5 h-0.5 bg-white" />
            <span className="w-5 h-0.5 bg-white" />
          </button>
        </div>

        {menuOpen && (
          <div className="absolute right-5 top-[68px] w-64 rounded-xl border border-white/10 bg-[#111a2b] p-3 shadow-2xl">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm text-gray-300 hover:bg-white/5 hover:text-white"
              >
                <span className="w-5 text-center">{item.icon}</span>
                {item.label}
              </Link>
            ))}
            <button
              onClick={logout}
              className="w-full text-left rounded-lg px-4 py-3 text-sm text-red-400 hover:bg-white/5"
            >
              Sign out
            </button>
          </div>
        )}
      </header>

      <div className="max-w-7xl mx-auto px-5 py-8">
        <div className="mb-8">
          <p className="text-xs font-bold tracking-[0.25em] text-blue-400">
            NVPL PLAYER HUB
          </p>
          <h1 className="mt-2 text-3xl md:text-4xl font-black">
            Welcome back, {displayName}.
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            Your competitions, community and player profile in one place.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-5 rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-300">
            {message}
          </div>
        )}

        <section className="grid grid-cols-1 lg:grid-cols-[1.1fr_2fr] gap-6">
          <div className="rounded-2xl border border-white/10 bg-[#111a2b] p-6">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                {preview || profile?.avatar_url ? (
                  <img
                    src={preview || profile?.avatar_url || ''}
                    alt="Player avatar"
                    className="h-24 w-24 rounded-full object-cover border-2 border-blue-500"
                  />
                ) : (
                  <div className="h-24 w-24 rounded-full border-2 border-blue-500 bg-[#1c2b45] flex items-center justify-center text-3xl font-black">
                    {(displayName[0] || 'N').toUpperCase()}
                  </div>
                )}
                <span className="absolute bottom-0 right-0 h-5 w-5 rounded-full bg-green-500 border-4 border-[#111a2b]" />
              </div>

              <div className="min-w-0">
                <p className="text-xs text-blue-400 font-bold tracking-widest">PLAYER PROFILE</p>
                <h2 className="mt-1 text-xl font-black truncate">{displayName}</h2>
                <p className="text-sm text-gray-400 truncate">{profile?.gamertag || 'Add your gamertag'}</p>
                <p className="mt-1 text-xs text-gray-500">{profile?.region || 'Region not set'}</p>
              </div>
            </div>

            <div className="mt-6">
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) {
                    setPreview(URL.createObjectURL(file))
                    uploadAvatar(file)
                  }
                }}
              />

              <button
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
                className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold hover:bg-blue-500 disabled:opacity-50"
              >
                {uploading ? 'Uploading image...' : 'Upload profile picture'}
              </button>
              <p className="mt-2 text-xs text-gray-500">JPG, PNG or WEBP · Maximum 5 MB</p>
            </div>

            <div className="mt-7 border-t border-white/10 pt-6">
              <h3 className="text-lg font-bold">Edit player details</h3>

              <label className="mt-4 block text-xs text-gray-400">Username</label>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Your NVPL username"
                className="mt-2 w-full rounded-lg border border-white/10 bg-[#080d18] px-4 py-3 text-sm outline-none focus:border-blue-500"
              />

              <label className="mt-4 block text-xs text-gray-400">EA FC Gamertag</label>
              <input
                value={gamertag}
                onChange={(event) => setGamertag(event.target.value)}
                placeholder="Your EA FC gamertag"
                className="mt-2 w-full rounded-lg border border-white/10 bg-[#080d18] px-4 py-3 text-sm outline-none focus:border-blue-500"
              />

              <label className="mt-4 block text-xs text-gray-400">Position</label>
              <input
                value={position}
                onChange={(event) => setPosition(event.target.value)}
                placeholder="e.g. GK, CB, CM, ST"
                className="mt-2 w-full rounded-lg border border-white/10 bg-[#080d18] px-4 py-3 text-sm outline-none focus:border-blue-500"
              />

              <label className="mt-4 block text-xs text-gray-400">Region</label>
              <select
                value={region}
                onChange={(event) => setRegion(event.target.value)}
                className="mt-2 w-full rounded-lg border border-white/10 bg-[#080d18] px-4 py-3 text-sm outline-none focus:border-blue-500"
              >
                {regions.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>

              <button
                onClick={saveProfile}
                disabled={saving || !profile}
                className="mt-5 w-full rounded-lg border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-sm font-bold text-blue-300 hover:bg-blue-500/20 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save profile details'}
              </button>

              {!profile && (
                <p className="mt-3 text-xs text-amber-300">
                  No player profile is linked to this account yet. Contact an NVPL admin to link your player profile.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <section className="rounded-2xl border border-white/10 bg-[#111a2b] p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold tracking-widest text-blue-400">NVPL LEAGUES</p>
                  <h2 className="mt-1 text-2xl font-black">Explore regions</h2>
                </div>
                <Link href="/competitions" className="text-sm text-blue-400 hover:text-blue-300">
                  All competitions →
                </Link>
              </div>

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { name: 'OCEANIA', code: 'OCE' },
                  { name: 'EUROPE', code: 'EU' },
                  { name: 'NORTH AMERICA', code: 'NA' },
                ].map((item) => (
                  <Link
                    key={item.code}
                    href={`/competitions?region=${item.code}`}
                    className="rounded-xl border border-white/10 bg-[#080d18] p-5 hover:border-blue-500/50"
                  >
                    <p className="text-xs font-bold text-blue-400">{item.code}</p>
                    <h3 className="mt-2 text-sm font-black">{item.name}</h3>
                    <p className="mt-3 text-xs text-gray-500">View leagues →</p>
                  </Link>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#111a2b] p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold tracking-widest text-blue-400">GET INVOLVED</p>
                  <h2 className="mt-1 text-2xl font-black">NVPL community</h2>
                </div>
                <Link href="/community" className="text-sm text-blue-400 hover:text-blue-300">
                  Open community →
                </Link>
              </div>

              <div className="mt-5 space-y-4">
                {posts.length === 0 && (
                  <p className="text-sm text-gray-400">No community posts are available yet.</p>
                )}

                {posts.map((post) => (
                  <article key={post.id} className="border-b border-white/10 pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      {post.author_avatar ? (
                        <img src={post.author_avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-[#263750] flex items-center justify-center font-bold">
                          {(post.author_username?.[0] || 'N').toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-bold">{post.author_username || 'NVPL Member'}</p>
                        <p className="text-xs text-gray-500">{timeAgo(post.created_at)}</p>
                      </div>
                      {post.pinned && (
                        <span className="ml-auto text-xs text-blue-400">PINNED</span>
                      )}
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-300">
                      {post.content}
                    </p>
                    {post.image_url && (
                      <img
                        src={post.image_url}
                        alt="Community post"
                        className="mt-3 max-h-64 w-full rounded-xl object-cover"
                      />
                    )}
                  </article>
                ))}
              </div>
            </section>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-white/10 bg-[#111a2b] p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold tracking-widest text-blue-400">WHAT'S HAPPENING</p>
              <h2 className="mt-1 text-2xl font-black">Upcoming competitions</h2>
            </div>
            <Link href="/competitions" className="text-sm text-blue-400 hover:text-blue-300">
              View all →
            </Link>
          </div>

          {competitions.length === 0 ? (
            <p className="mt-6 text-sm text-gray-400">
              No upcoming competitions are currently listed.
            </p>
          ) : (
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {competitions.map((competition) => (
                <Link
                  key={competition.id}
                  href={`/competitions/${competition.id}`}
                  className="group overflow-hidden rounded-xl border border-white/10 bg-[#080d18] hover:border-blue-500/50"
                >
                  {competition.image_url ? (
                    <img
                      src={competition.image_url}
                      alt={competition.name}
                      className="h-40 w-full object-cover transition group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="h-40 bg-gradient-to-br from-[#172b4a] to-[#080d18] flex items-center justify-center">
                      <span className="text-4xl font-black text-blue-400">NVPL</span>
                    </div>
                  )}

                  <div className="p-5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-blue-400">{competition.region}</span>
                      <span className="text-xs text-gray-500">{competition.status.replaceAll('_', ' ')}</span>
                    </div>
                    <h3 className="mt-3 text-lg font-black">{competition.name}</h3>
                    <p className="mt-1 text-sm text-gray-400">
                      {competition.division} · {competition.season}
                    </p>
                    <p className="mt-3 text-xs text-gray-500">
                      Starts {formatDate(competition.start_date)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-10 border-t border-white/10 py-6 flex flex-col sm:flex-row justify-between gap-3 text-xs text-gray-500">
          <span>© {new Date().getFullYear()} NVPL. All rights reserved.</span>
          <span>{email}</span>
        </footer>
      </div>
    </main>
  )
}
