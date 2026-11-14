
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Notification = {
  id: string
  title: string
  message: string
  notification_type: string | null
  link: string | null
  is_read: boolean
  created_at: string
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [updating, setUpdating] = useState(false)

  const loadNotifications = useCallback(async () => {
    setError('')

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError) throw authError

      if (!user) {
        setError('Please sign in to view your notifications.')
        setNotifications([])
        return
      }

      const { data, error: queryError } = await supabase
        .from('nvpl_notifications')
        .select(
          'id, title, message, notification_type, link, is_read, created_at'
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (queryError) throw queryError

      const results = data || []

      setNotifications(results)
      setUnreadCount(results.filter((item) => !item.is_read).length)
    } catch (err) {
      console.error(err)
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load notifications.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadNotifications()

    const channel = supabase
      .channel('nvpl-notifications-page')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'nvpl_notifications',
        },
        () => void loadNotifications()
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [loadNotifications])

  async function markRead(id: string) {
    setUpdating(true)

    const { error: updateError } = await supabase
      .from('nvpl_notifications')
      .update({ is_read: true })
      .eq('id', id)

    if (updateError) {
      setError(updateError.message)
    } else {
      setNotifications((current) =>
        current.map((item) =>
          item.id === id ? { ...item, is_read: true } : item
        )
      )
      setUnreadCount((count) => Math.max(0, count - 1))
    }

    setUpdating(false)
  }

  async function markAllRead() {
    setUpdating(true)
    setError('')

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('Please sign in again.')

      const { error: updateError } = await supabase
        .from('nvpl_notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false)

      if (updateError) throw updateError

      setNotifications((current) =>
        current.map((item) => ({ ...item, is_read: true }))
      )
      setUnreadCount(0)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to update notifications.'
      )
    } finally {
      setUpdating(false)
    }
  }

  const visibleNotifications =
    filter === 'unread'
      ? notifications.filter((item) => !item.is_read)
      : notifications

  function notificationDestination(item: Notification) {
    return item.link || '/notifications'
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#080d19] text-white flex items-center justify-center">
        <p className="text-gray-400">Loading notifications...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#080d19] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/dashboard" className="text-sm font-bold text-blue-400">
              ← Back to dashboard
            </Link>
            <h1 className="mt-3 text-3xl font-black">Notifications</h1>
            <p className="mt-2 text-gray-400">
              Stay up to date with everything happening in NVPL.
            </p>
          </div>

          <button
            onClick={loadNotifications}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm hover:bg-white/10"
          >
            ↻ Refresh
          </button>
        </header>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        <section className="mb-6 grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-[#111827] p-5">
            <p className="text-sm text-gray-400">Total notifications</p>
            <p className="mt-2 text-3xl font-black">
              {notifications.length}
            </p>
          </div>

          <div className="rounded-2xl border border-blue-500/20 bg-[#111827] p-5">
            <p className="text-sm text-gray-400">Unread notifications</p>
            <p className="mt-2 text-3xl font-black text-blue-400">
              {unreadCount}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#111827] p-5 sm:p-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                  filter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                All
              </button>

              <button
                onClick={() => setFilter('unread')}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                  filter === 'unread'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                Unread ({unreadCount})
              </button>
            </div>

            <button
              onClick={markAllRead}
              disabled={updating || unreadCount === 0}
              className="text-sm font-semibold text-blue-400 hover:text-blue-300 disabled:text-gray-600"
            >
              {updating ? 'Updating...' : 'Mark all as read'}
            </button>
          </div>

          {visibleNotifications.length === 0 ? (
            <div className="py-16 text-center">
              <div className="text-4xl">🔔</div>
              <h2 className="mt-4 text-lg font-bold">
                {filter === 'unread'
                  ? 'You are all caught up!'
                  : 'No notifications yet'}
              </h2>
              <p className="mt-2 text-sm text-gray-400">
                New NVPL updates will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleNotifications.map((item) => (
                <article
                  key={item.id}
                  className={`rounded-2xl border p-5 transition ${
                    item.is_read
                      ? 'border-white/10 bg-white/[0.02]'
                      : 'border-blue-500/30 bg-blue-500/[0.06]'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-bold">{item.title}</h2>

                        {!item.is_read && (
                          <span className="rounded-full bg-blue-600 px-2 py-1 text-[10px] font-bold uppercase">
                            New
                          </span>
                        )}

                        {item.notification_type && (
                          <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] uppercase text-gray-400">
                            {item.notification_type}
                          </span>
                        )}
                      </div>

                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-300">
                        {item.message}
                      </p>

                      <p className="mt-3 text-xs text-gray-500">
                        {new Date(item.created_at).toLocaleString('en-AU', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>

                      {item.link && (
                        <Link
                          href={notificationDestination(item)}
                          onClick={() => {
                            if (!item.is_read) void markRead(item.id)
                          }}
                          className="mt-4 inline-block text-sm font-semibold text-blue-400 hover:text-blue-300"
                        >
                          Open →
                        </Link>
                      )}
                    </div>

                    {!item.is_read && (
                      <button
                        onClick={() => void markRead(item.id)}
                        disabled={updating}
                        className="shrink-0 rounded-lg border border-blue-500/30 px-3 py-2 text-xs font-semibold text-blue-400 hover:bg-blue-500/10 disabled:opacity-50"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-8 text-center text-xs text-gray-500">
          NVPL · Notifications Centre
        </footer>
      </div>
    </main>
  )
}
