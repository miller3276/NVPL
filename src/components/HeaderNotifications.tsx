
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Notification = {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  is_read: boolean
  created_at: string
}

export default function HeaderNotifications() {
  const router = useRouter()

  const [userId, setUserId] = useState<string | null>(null)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifications, setShowNotifications] = useState(false)

  async function loadData(id: string) {
    const [messagesResult, notificationsResult] = await Promise.all([
      supabase
        .from('nvpl_messages')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', id)
        .eq('is_read', false),

      supabase
        .from('nvpl_notifications')
        .select('*')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    setUnreadMessages(messagesResult.count || 0)

    if (!notificationsResult.error) {
      setNotifications(notificationsResult.data || [])
    }
  }

  useEffect(() => {
    let active = true
    let interval: ReturnType<typeof setInterval> | undefined

    async function initialise() {
      const { data } = await supabase.auth.getUser()

      if (!active || !data.user) return

      setUserId(data.user.id)
      await loadData(data.user.id)

      interval = setInterval(() => {
        loadData(data.user.id)
      }, 15000)
    }

    initialise()

    return () => {
      active = false
      if (interval) clearInterval(interval)
    }
  }, [])

  const unreadNotifications = notifications.filter(
    (notification) => !notification.is_read
  ).length

  async function openNotification(notification: Notification) {
    await supabase
      .from('nvpl_notifications')
      .update({ is_read: true })
      .eq('id', notification.id)

    if (userId) await loadData(userId)

    setShowNotifications(false)
    router.push(notification.link || '/')
  }

  if (!userId) return null

  return (
    <div className="flex items-center gap-3">

      {/* MAILBOX */}
      <Link
        href="/messages"
        className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xl transition hover:bg-white/10"
        title="Mailbox"
      >
        ✉️

        {unreadMessages > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadMessages > 99 ? '99+' : unreadMessages}
          </span>
        )}
      </Link>

      {/* NOTIFICATION BELL */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowNotifications(!showNotifications)}
          className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xl transition hover:bg-white/10"
          title="Notifications"
        >
          🔔

          {unreadNotifications > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unreadNotifications > 99 ? '99+' : unreadNotifications}
            </span>
          )}
        </button>

        {showNotifications && (
          <div className="absolute right-0 top-14 z-50 w-80 overflow-hidden rounded-2xl border border-white/10 bg-[#111827] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 p-4">
              <h3 className="font-bold text-white">Notifications</h3>

              <button
                type="button"
                onClick={() => setShowNotifications(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-400">
                  You're all caught up.
                </div>
              ) : (
                notifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => openNotification(notification)}
                    className={`w-full border-b border-white/5 p-4 text-left transition hover:bg-white/5 ${
                      !notification.is_read ? 'bg-blue-500/10' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xl">
                        {notification.type === 'invitation_accepted'
                          ? '⚽'
                          : '✉️'}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-white">
                          {notification.title}
                        </p>

                        <p className="mt-1 text-xs text-gray-400">
                          {notification.body}
                        </p>

                        <p className="mt-2 text-[10px] text-gray-500">
                          {new Date(notification.created_at).toLocaleString()}
                        </p>
                      </div>

                      {!notification.is_read && (
                        <span className="mt-1 h-2 w-2 rounded-full bg-blue-400" />
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="border-t border-white/10 p-3 text-center">
              <span className="text-xs text-gray-500">
                Showing your latest 20 notifications
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
