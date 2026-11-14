
'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Message = {
  id: string
  sender_id: string
  recipient_id: string
  message: string
  created_at: string
}

type Conversation = {
  id: string
  participant_one: string
  participant_two: string
}

function ConversationContent() {
  const params = useParams()
  const router = useRouter()
  const conversationId = params.id as string

  const [userId, setUserId] = useState('')
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [message, setMessage] = useState('')
  const [otherName, setOtherName] = useState('NVPL Player')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  const loadMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from('nvpl_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error(error)
      return
    }

    setMessages((data || []) as Message[])
  }, [conversationId])

  useEffect(() => {
    async function initialise() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      setUserId(user.id)

      const { data, error } = await supabase
        .from('nvpl_conversations')
        .select('*')
        .eq('id', conversationId)
        .single()

      if (error || !data) {
        router.push('/messages')
        return
      }

      const currentConversation = data as Conversation

      if (
        currentConversation.participant_one !== user.id &&
        currentConversation.participant_two !== user.id
      ) {
        router.push('/messages')
        return
      }

      setConversation(currentConversation)

      const otherPlayer =
        currentConversation.participant_one === user.id
          ? currentConversation.participant_two
          : currentConversation.participant_one

      const { data: profile } = await supabase
        .from('player_profiles')
        .select('username, gamertag')
        .eq('user_id', otherPlayer)
        .maybeSingle()

      setOtherName(
        profile?.username || profile?.gamertag || 'NVPL Player'
      )

      await loadMessages()
      setLoading(false)
    }

    initialise()
  }, [conversationId, router, loadMessages])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()

    const cleanMessage = message.trim()

    if (!cleanMessage || !conversation || sending || !userId) return

    const recipientId =
      conversation.participant_one === userId
        ? conversation.participant_two
        : conversation.participant_one

    setSending(true)

    const { error } = await supabase
      .from('nvpl_messages')
      .insert({
        conversation_id: conversation.id,
        sender_id: userId,
        recipient_id: recipientId,
        message: cleanMessage
      })

    if (error) {
      alert(error.message)
    } else {
      setMessage('')
      await loadMessages()
    }

    setSending(false)
  }

  return (
    <main className="min-h-screen bg-[#080d18] text-white px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <Link href="/messages" className="text-blue-400 text-sm font-bold">
          ← BACK TO MESSAGES
        </Link>

        <div className="mt-7 rounded-2xl border border-white/10 bg-[#111a2b] overflow-hidden">
          <div className="p-5 border-b border-white/10">
            <h1 className="text-xl font-black">{otherName}</h1>
            <p className="text-xs text-gray-400 mt-1">
              NVPL PRIVATE MESSAGES
            </p>
          </div>

          <div className="p-5 space-y-4 min-h-[400px] max-h-[600px] overflow-y-auto">
            {loading ? (
              <p className="text-gray-400">Loading messages...</p>
            ) : messages.length === 0 ? (
              <p className="text-gray-400 text-center mt-20">
                Start the conversation.
              </p>
            ) : (
              messages.map(item => {
                const ownMessage = item.sender_id === userId

                return (
                  <div
                    key={item.id}
                    className={`flex ${ownMessage ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      ownMessage ? 'bg-blue-600' : 'bg-[#202c40]'
                    }`}>
                      <p className="break-words">{item.message}</p>
                      <p className="text-[10px] text-white/60 mt-2">
                        {new Date(item.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <form
            onSubmit={sendMessage}
            className="p-4 border-t border-white/10 flex gap-3"
          >
            <input
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Write a message..."
              maxLength={5000}
              className="flex-1 min-w-0 rounded-xl bg-[#080d18] border border-white/10 px-4 py-3 text-white outline-none focus:border-blue-500"
            />

            <button
              type="submit"
              disabled={sending || !message.trim()}
              className="rounded-xl bg-blue-600 px-5 font-bold disabled:opacity-50"
            >
              {sending ? '...' : 'SEND'}
            </button>
          </form>
        </div>

        <p className="text-xs text-gray-500 mt-4">
          Messages are private to conversation participants, but NVPL Super
          Admins can review message history for moderation.
        </p>
      </div>
    </main>
  )
}

export default function ConversationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#080d18] text-white p-10">
        Loading conversation...
      </div>
    }>
      <ConversationContent />
    </Suspense>
  )
}
