
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Conversation = {
  id: string
  participant_one: string
  participant_two: string
  created_at: string
}

type Player = {
  user_id: string
  username: string | null
  gamertag: string
}

export default function MessagesPage() {
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadMessages() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      setUserId(user.id)

      const { data, error } = await supabase
        .from('nvpl_conversations')
        .select('*')
        .or(`participant_one.eq.${user.id},participant_two.eq.${user.id}`)
        .order('created_at', { ascending: false })

      if (error) {
        console.error(error)
        setLoading(false)
        return
      }

      const conversationList = (data || []) as Conversation[]
      setConversations(conversationList)

      const playerIds = [...new Set(
        conversationList.flatMap(c => [
          c.participant_one,
          c.participant_two
        ]).filter(id => id !== user.id)
      )]

      if (playerIds.length > 0) {
        const { data: playerData } = await supabase
          .from('player_profiles')
          .select('user_id, username, gamertag')
          .in('user_id', playerIds)

        setPlayers((playerData || []) as Player[])
      }

      setLoading(false)
    }

    loadMessages()
  }, [router])

  function getName(id: string) {
    const player = players.find(p => p.user_id === id)
    return player?.username || player?.gamertag || 'NVPL Player'
  }

  return (
    <main className="min-h-screen bg-[#080d18] text-white px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="text-blue-400 text-sm font-bold">
          ← HOME
        </Link>

        <h1 className="text-4xl font-black mt-8">MESSAGES</h1>
        <p className="text-gray-400 mt-2">
          Your private player conversations.
        </p>

        <div className="mt-8 space-y-3">
          {loading ? (
            <p className="text-gray-400">Loading conversations...</p>
          ) : conversations.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#111a2b] p-8">
              <h2 className="text-xl font-bold">No messages yet</h2>
              <p className="text-gray-400 mt-2">
                Visit a player's profile and select Send Message to start a conversation.
              </p>
            </div>
          ) : (
            conversations.map(conversation => {
              const otherPlayer =
                conversation.participant_one === userId
                  ? conversation.participant_two
                  : conversation.participant_one

              return (
                <Link
                  key={conversation.id}
                  href={`/messages/${conversation.id}`}
                  className="block rounded-2xl border border-white/10 bg-[#111a2b] p-5 hover:border-blue-400/50 transition"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-bold text-lg">
                        {getName(otherPlayer)}
                      </h2>
                      <p className="text-gray-400 text-sm mt-1">
                        Open conversation
                      </p>
                    </div>
                    <span className="text-blue-400 text-xl">→</span>
                  </div>
                </Link>
              )
            })
          )}
        </div>
      </div>
    </main>
  )
}
