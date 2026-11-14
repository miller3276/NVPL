
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Profile = {
  id: string
  user_id: string
  gamertag: string | null
  username: string | null
  position: string | null
  region: string | null
  country: string | null
  bio: string | null
  avatar_url: string | null
}

type Team = {
  id: string
  name: string
  abbreviation: string | null
}

type Membership = {
  id: string
  team_id: string
  player_id: string
  primary_position: string | null
  squad_number: number | null
  status: string | null
  left_at: string | null
}

type Fixture = {
  id: string
  competition_id: string
  home_team_id: string
  away_team_id: string
  matchweek: number | null
  kickoff_at: string | null
  status: string
  home_score: number | null
  away_score: number | null
}

type Competition = {
  id: string
  name: string
  region: string | null
  division: string | null
  status: string
  season: string | null
}

type Notification = {
  id: string
  title: string
  message: string
  notification_type: string | null
  link: string | null
  is_read: boolean
  created_at: string
}

type CommunityPost = {
  id: string
  author_username: string
  content: string
  created_at: string
  pinned: boolean
  featured: boolean
}

type PlayerStats = {
  goals: number
  assists: number
  shots: number
  shotsOnTarget: number
  saves: number
  minutes: number
  passesCompleted: number
  passesAttempted: number
}

const emptyStats: PlayerStats = {
  goals: 0,
  assists: 0,
  shots: 0,
  shotsOnTarget: 0,
  saves: 0,
  minutes: 0,
  passesCompleted: 0,
  passesAttempted: 0,
}

function formatDate(date: string | null) {
  if (!date) return 'Date TBC'

  return new Date(date).toLocaleString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatRelativeDate(date: string) {
  return new Date(date).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
  })
}

function isCompleted(status: string) {
  return ['completed', 'played', 'finished', 'full time'].includes(
    status.toLowerCase()
  )
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [stats, setStats] = useState<PlayerStats>(emptyStats)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [unreadMessages, setUnreadMessages] = useState(0)

  const loadDashboard = useCallback(async () => {
    setError('')

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError) throw authError

      if (!user) {
        setProfile(null)
        setError('Please sign in to view your dashboard.')
        return
      }

      const { data: profileData, error: profileError } = await supabase
        .from('player_profiles')
        .select(
          'id, user_id, gamertag, username, position, region, country, bio, avatar_url'
        )
        .eq('user_id', user.id)
        .maybeSingle()

      if (profileError) throw profileError

      setProfile(profileData)

      const [
        notificationResult,
        notificationCountResult,
        messageCountResult,
        competitionResult,
        postResult,
      ] = await Promise.all([
        supabase
          .from('nvpl_notifications')
          .select(
            'id, title, message, notification_type, link, is_read, created_at'
          )
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(6),

        supabase
          .from('nvpl_notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_read', false),

        supabase
          .from('nvpl_messages')
          .select('id', { count: 'exact', head: true })
          .eq('recipient_id', user.id)
          .eq('is_read', false),

        supabase
          .from('competitions')
          .select('id, name, region, division, status, season')
          .order('created_at', { ascending: false })
          .limit(6),

        supabase
          .from('nvpl_community_posts')
          .select(
            'id, author_username, content, created_at, pinned, featured'
          )
          .order('created_at', { ascending: false })
          .limit(4),
      ])

      if (notificationResult.error) throw notificationResult.error
      if (notificationCountResult.error) throw notificationCountResult.error
      if (messageCountResult.error) throw messageCountResult.error
      if (competitionResult.error) throw competitionResult.error
      if (postResult.error) throw postResult.error

      setNotifications(notificationResult.data || [])
      setUnreadNotifications(notificationCountResult.count || 0)
      setUnreadMessages(messageCountResult.count || 0)
      setCompetitions(competitionResult.data || [])
      setPosts(postResult.data || [])

      if (!profileData) {
        setMemberships([])
        setTeams([])
        setFixtures([])
        setStats(emptyStats)
        return
      }

      const { data: membershipData, error: membershipError } =
        await supabase
          .from('club_memberships')
          .select(
            'id, team_id, player_id, primary_position, squad_number, status, left_at'
          )
          .eq('player_id', profileData.id)
          .is('left_at', null)

      if (membershipError) throw membershipError

      const activeMemberships = membershipData || []
      setMemberships(activeMemberships)

      const teamIds = [
        ...new Set(activeMemberships.map((membership) => membership.team_id)),
      ]

      if (teamIds.length > 0) {
        const { data: teamData, error: teamError } = await supabase
          .from('teams')
          .select('id, name, abbreviation')
          .in('id', teamIds)

        if (teamError) throw teamError
        setTeams(teamData || [])
      } else {
        setTeams([])
      }

      const { data: statData, error: statsError } = await supabase
        .from('nvpl_match_player_stats')
        .select(
          'goals, assists, shots, shots_on_target, saves, minutes_played, passes_completed, passes_attempted'
        )
        .eq('player_id', profileData.id)

      if (statsError) throw statsError

      const totals = (statData || []).reduce(
        (result, item) => ({
          goals: result.goals + (item.goals || 0),
          assists: result.assists + (item.assists || 0),
          shots: result.shots + (item.shots || 0),
          shotsOnTarget:
            result.shotsOnTarget + (item.shots_on_target || 0),
          saves: result.saves + (item.saves || 0),
          minutes: result.minutes + (item.minutes_played || 0),
          passesCompleted:
            result.passesCompleted + (item.passes_completed || 0),
          passesAttempted:
            result.passesAttempted + (item.passes_attempted || 0),
        }),
        emptyStats
      )

      setStats(totals)

      if (teamIds.length > 0) {
        const { data: fixtureData, error: fixtureError } = await supabase
          .from('nvpl_fixtures')
          .select(
            'id, competition_id, home_team_id, away_team_id, matchweek, kickoff_at, status, home_score, away_score'
          )
          .or(
            `home_team_id.in.(${teamIds.join(',')}),away_team_id.in.(${teamIds.join(',')})`
          )
          .order('kickoff_at', { ascending: false })
          .limit(30)

        if (fixtureError) throw fixtureError
        setFixtures(fixtureData || [])
      } else {
        setFixtures([])
      }
    } catch (err) {
      console.error('Dashboard loading error:', err)
      setError(
        err instanceof Error ? err.message : 'Unable to load dashboard.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDashboard()

    const channel = supabase
      .channel('nvpl-dashboard-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'nvpl_notifications' },
        () => void loadDashboard()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'nvpl_fixtures' },
        () => void loadDashboard()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'nvpl_community_posts' },
        () => void loadDashboard()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'nvpl_match_player_stats' },
        () => void loadDashboard()
      )
      .subscribe()

    const handleFocus = () => void loadDashboard()
    window.addEventListener('focus', handleFocus)

    return () => {
      window.removeEventListener('focus', handleFocus)
      void supabase.removeChannel(channel)
    }
  }, [loadDashboard])

  async function refreshDashboard() {
    setRefreshing(true)
    await loadDashboard()
    setRefreshing(false)
  }

  async function markNotificationRead(id: string) {
    const { error: updateError } = await supabase
      .from('nvpl_notifications')
      .update({ is_read: true })
      .eq('id', id)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setNotifications((current) =>
      current.map((item) =>
        item.id === id ? { ...item, is_read: true } : item
      )
    )

    setUnreadNotifications((count) => Math.max(0, count - 1))
  }

  async function markAllNotificationsRead() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const { error: updateError } = await supabase
      .from('nvpl_notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setNotifications((current) =>
      current.map((item) => ({ ...item, is_read: true }))
    )
    setUnreadNotifications(0)
  }

  const teamName = (id: string) =>
    teams.find((team) => team.id === id)?.name || 'Unknown club'

  const competitionName = (id: string) =>
    competitions.find((competition) => competition.id === id)?.name ||
    'Competition'

  const upcomingFixtures = fixtures
    .filter(
      (fixture) =>
        !isCompleted(fixture.status) &&
        (!fixture.kickoff_at || new Date(fixture.kickoff_at) >= new Date())
    )
    .sort((a, b) => {
      if (!a.kickoff_at) return 1
      if (!b.kickoff_at) return -1
      return (
        new Date(a.kickoff_at).getTime() -
        new Date(b.kickoff_at).getTime()
      )
    })
    .slice(0, 5)

  const recentResults = fixtures
    .filter((fixture) => isCompleted(fixture.status))
    .slice(0, 5)

  const displayName =
    profile?.gamertag || profile?.username || 'Player'

  if (loading) {
    return (
      <main className="min-h-screen bg-[#080d19] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="text-gray-400">Loading your NVPL dashboard...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#080d19] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/" className="text-sm font-bold tracking-widest text-blue-400">
              NVPL
            </Link>
            <h1 className="mt-2 text-3xl font-black">Player Dashboard</h1>
            <p className="mt-1 text-sm text-gray-400">
              Your competitive home.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/notifications"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm hover:bg-white/10"
            >
              Notifications
              {unreadNotifications > 0 && (
                <span className="ml-2 rounded-full bg-blue-600 px-2 py-0.5 text-xs">
                  {unreadNotifications}
                </span>
              )}
            </Link>

            <Link
              href="/messages"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm hover:bg-white/10"
            >
              Messages
              {unreadMessages > 0 && (
                <span className="ml-2 rounded-full bg-blue-600 px-2 py-0.5 text-xs">
                  {unreadMessages}
                </span>
              )}
            </Link>

            <button
              onClick={refreshDashboard}
              disabled={refreshing}
              className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50"
            >
              {refreshing ? 'Refreshing...' : '↻ Refresh'}
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {!profile ? (
          <section className="rounded-2xl border border-white/10 bg-[#111827] p-8">
            <h2 className="text-xl font-bold">Player profile not found</h2>
            <p className="mt-2 text-gray-400">
              Your account is signed in, but there is no player profile linked
              to it yet.
            </p>
            <Link
              href="/profile"
              className="mt-5 inline-block rounded-xl bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-500"
            >
              View profile
            </Link>
          </section>
        ) : (
          <>
            <section className="mb-8 overflow-hidden rounded-3xl border border-blue-400/20 bg-gradient-to-r from-[#142b55] via-[#10203e] to-[#111827] p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-6">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-widest text-blue-300">
                    Welcome back
                  </p>
                  <h2 className="mt-2 text-3xl font-black sm:text-4xl">
                    {displayName}
                  </h2>
                  <p className="mt-3 text-gray-300">
                    {profile.position || 'Position not set'} ·{' '}
                    {profile.region || 'Region not set'}
                    {profile.country ? ` · ${profile.country}` : ''}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link
                      href="/profile"
                      className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold hover:bg-blue-500"
                    >
                      View player profile
                    </Link>
                    <Link
                      href="/statistics"
                      className="rounded-xl border border-white/20 px-5 py-3 text-sm font-bold hover:bg-white/10"
                    >
                      View statistics
                    </Link>
                  </div>
                </div>

                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="Player avatar"
                    className="h-24 w-24 rounded-full border-4 border-white/20 object-cover"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white/10 bg-blue-600 text-3xl font-black">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </section>

            <section className="mb-8">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold">Career statistics</h2>
                <Link href="/statistics" className="text-sm text-blue-400 hover:text-blue-300">
                  Full statistics →
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  ['Goals', stats.goals],
                  ['Assists', stats.assists],
                  ['Shots', stats.shots],
                  ['Shots on target', stats.shotsOnTarget],
                  ['Saves', stats.saves],
                  ['Minutes played', stats.minutes],
                  ['Passes completed', stats.passesCompleted],
                  [
                    'Passing accuracy',
                    stats.passesAttempted > 0
                      ? `${Math.round(
                          (stats.passesCompleted / stats.passesAttempted) *
                            100
                        )}%`
                      : '0%',
                  ],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-2xl border border-white/10 bg-[#111827] p-5"
                  >
                    <p className="text-sm text-gray-400">{label}</p>
                    <p className="mt-2 text-3xl font-black">{value}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="grid gap-8 lg:grid-cols-2">
              <section className="rounded-2xl border border-white/10 bg-[#111827] p-5">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-xl font-bold">My clubs</h2>
                  <Link href="/clubs" className="text-sm text-blue-400">
                    All clubs →
                  </Link>
                </div>

                {memberships.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    You are not currently listed in a club.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {memberships.map((membership) => (
                      <Link
                        key={membership.id}
                        href="/clubs"
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:border-blue-500/40"
                      >
                        <div>
                          <p className="font-bold">
                            {teamName(membership.team_id)}
                          </p>
                          <p className="mt-1 text-sm text-gray-400">
                            {membership.primary_position || 'Position TBC'}
                            {membership.squad_number !== null
                              ? ` · #${membership.squad_number}`
                              : ''}
                          </p>
                        </div>
                        <span className="text-blue-400">→</span>
                      </Link>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-white/10 bg-[#111827] p-5">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-xl font-bold">Upcoming fixtures</h2>
                  <Link href="/fixtures" className="text-sm text-blue-400">
                    All fixtures →
                  </Link>
                </div>

                {upcomingFixtures.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    No upcoming fixtures are currently listed for your clubs.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {upcomingFixtures.map((fixture) => (
                      <Link
                        key={fixture.id}
                        href="/fixtures"
                        className="block rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:border-blue-500/40"
                      >
                        <p className="mb-3 text-xs text-blue-300">
                          {competitionName(fixture.competition_id)}
                          {fixture.matchweek
                            ? ` · Matchweek ${fixture.matchweek}`
                            : ''}
                        </p>
                        <div className="flex items-center justify-between gap-3 text-sm font-semibold">
                          <span>{teamName(fixture.home_team_id)}</span>
                          <span className="text-gray-500">VS</span>
                          <span className="text-right">
                            {teamName(fixture.away_team_id)}
                          </span>
                        </div>
                        <p className="mt-3 text-xs text-gray-400">
                          {formatDate(fixture.kickoff_at)}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-white/10 bg-[#111827] p-5">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-xl font-bold">Recent results</h2>
                  <Link href="/fixtures" className="text-sm text-blue-400">
                    Match history →
                  </Link>
                </div>

                {recentResults.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    No completed results are available yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {recentResults.map((fixture) => (
                      <Link
                        key={fixture.id}
                        href="/fixtures"
                        className="block rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:border-blue-500/40"
                      >
                        <p className="mb-2 text-xs text-gray-400">
                          {competitionName(fixture.competition_id)}
                        </p>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span>{teamName(fixture.home_team_id)}</span>
                          <span className="text-lg font-black">
                            {fixture.home_score ?? '-'} :{' '}
                            {fixture.away_score ?? '-'}
                          </span>
                          <span className="text-right">
                            {teamName(fixture.away_team_id)}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                          {formatDate(fixture.kickoff_at)}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-white/10 bg-[#111827] p-5">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-xl font-bold">Competitions</h2>
                  <Link href="/competitions" className="text-sm text-blue-400">
                    Browse competitions →
                  </Link>
                </div>

                {competitions.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    No competitions are currently available.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {competitions.map((competition) => (
                      <Link
                        key={competition.id}
                        href="/competitions"
                        className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:border-blue-500/40"
                      >
                        <div>
                          <p className="font-bold">{competition.name}</p>
                          <p className="mt-1 text-xs text-gray-400">
                            {[competition.region, competition.division, competition.season]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        </div>
                        <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs text-blue-300">
                          {competition.status}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-white/10 bg-[#111827] p-5">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold">Notifications</h2>
                    <p className="mt-1 text-xs text-gray-400">
                      {unreadNotifications} unread
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={markAllNotificationsRead}
                      disabled={unreadNotifications === 0}
                      className="text-xs font-semibold text-blue-400 disabled:text-gray-600"
                    >
                      Mark all read
                    </button>
                    <Link href="/notifications" className="text-xs text-blue-400">
                      View all →
                    </Link>
                  </div>
                </div>

                {notifications.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    You have no notifications.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`rounded-xl border p-4 ${
                          notification.is_read
                            ? 'border-white/10 bg-white/[0.02]'
                            : 'border-blue-500/30 bg-blue-500/[0.07]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">
                              {notification.title}
                            </p>
                            <p className="mt-1 text-sm text-gray-400">
                              {notification.message}
                            </p>
                            <p className="mt-2 text-xs text-gray-500">
                              {formatRelativeDate(notification.created_at)}
                            </p>
                          </div>
                          {!notification.is_read && (
                            <button
                              onClick={() =>
                                void markNotificationRead(notification.id)
                              }
                              className="shrink-0 text-xs text-blue-400 hover:text-blue-300"
                            >
                              Mark read
                            </button>
                          )}
                        </div>
                        {notification.link && (
                          <Link
                            href={notification.link}
                            onClick={() => {
                              if (!notification.is_read) {
                                void markNotificationRead(notification.id)
                              }
                            }}
                            className="mt-3 inline-block text-xs font-semibold text-blue-400"
                          >
                            Open notification →
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-white/10 bg-[#111827] p-5">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-xl font-bold">Community feed</h2>
                  <Link href="/community" className="text-sm text-blue-400">
                    Open community →
                  </Link>
                </div>

                {posts.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    No community posts are available yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {posts.map((post) => (
                      <Link
                        key={post.id}
                        href="/community"
                        className="block rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:border-blue-500/40"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">
                            {post.author_username}
                          </p>
                          {post.pinned && (
                            <span className="text-xs text-yellow-400">
                              Pinned
                            </span>
                          )}
                          {post.featured && (
                            <span className="text-xs text-blue-400">
                              Featured
                            </span>
                          )}
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-gray-300">
                          {post.content}
                        </p>
                        <p className="mt-3 text-xs text-gray-500">
                          {formatRelativeDate(post.created_at)}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <section className="mt-8 rounded-2xl border border-white/10 bg-[#111827] p-5">
              <h2 className="text-xl font-bold">Quick access</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {[
                  ['My profile', '/profile'],
                  ['Competitions', '/competitions'],
                  ['Fixtures', '/fixtures'],
                  ['Statistics', '/statistics'],
                  ['Clubs', '/clubs'],
                  ['Player market', '/transfers'],
                  ['Community', '/community'],
                  ['Messages', '/messages'],
                  ['Support', '/support'],
                  ['Notifications', '/notifications'],
                ].map(([label, href]) => (
                  <Link
                    key={href}
                    href={href}
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-center text-sm font-semibold hover:border-blue-500/50 hover:bg-blue-500/10"
                  >
                    {label} →
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}

        <footer className="mt-10 border-t border-white/10 py-6 text-center text-xs text-gray-500">
          NVPL · Player Dashboard
        </footer>
      </div>
    </main>
  )
}
