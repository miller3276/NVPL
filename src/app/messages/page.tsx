
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Message = {
  id: string
  sender_id: string
  recipient_id: string
  message: string
  is_read: boolean
  created_at: string
}

type Player = {
  user_id: string
  username: string | null
  gamertag: string | null
  avatar_url: string | null
}

export default function MessagesPage() {
  const [userId, setUserId] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [selectedUser, setSelectedUser] = useState('')
  const [activeUser, setActiveUser] = useState('')
  const [reply, setReply] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  async function initialise() {
    setLoading(true)
    setError('')

    const { data: auth } = await supabase.auth.getUser()

    if (!auth.user) {
      setError('Please sign in to view messages.')
      setLoading(false)
      return
    }

    setUserId(auth.user.id)

    const [messageResult, playerResult] = await Promise.all([
      supabase
        .from('nvpl_messages')
        .select('*')
        .or(`sender_id.eq.${auth.user.id},recipient_id.eq.${auth.user.id}`)
        .order('created_at', { ascending: true }),

      supabase
        .from('player_profiles')
        .select('user_id,username,gamertag,avatar_url')
        .neq('user_id', auth.user.id)
        .order('username'),
    ])

    if (messageResult.error) setError(messageResult.error.message)
    else setMessages((messageResult.data || []) as Message[])

    if (playerResult.error) setError(playerResult.error.message)
    else setPlayers((playerResult.data || []) as Player[])

    await supabase
      .from('nvpl_messages')
      .update({ is_read: true })
      .eq('recipient_id', auth.user.id)
      .eq('is_read', false)

    setLoading(false)
  }

  function conversations() {
    const ids = new Set<string>()

    messages.forEach(message => {
      ids.add(
        message.sender_id === userId
          ? message.recipient_id
          : message.sender_id
      )
    })

    return Array.from(ids).map(id => {
      const conversationMessages = messages.filter(
        message =>
          (message.sender_id === userId && message.recipient_id === id) ||
          (message.sender_id === id && message.recipient_id === userId)
      )

      return {
        id,
        lastMessage: conversationMessages[conversationMessages.length - 1],
        unread: conversationMessages.filter(
          message =>
            message.recipient_id === userId &&
            !message.is_read
        ).length,
      }
    }).sort((a, b) =>
      new Date(b.lastMessage.created_at).getTime() -
      new Date(a.lastMessage.created_at).getTime()
    )
  }

  async function openConversation(id: string) {
    setActiveUser(id)

    await supabase
      .from('nvpl_messages')
      .update({ is_read: true })
      .eq('sender_id', id)
      .eq('recipient_id', userId)
      .eq('is_read', false)

    await initialise()
  }

  async function sendMessage(recipientId: string, content: string) {
    if (!content.trim() || !recipientId) return

    setSending(true)
    setError('')

    const { error } = await supabase
      .from('nvpl_messages')
      .insert({
        sender_id: userId,
        recipient_id: recipientId,
        message: content.trim(),
      })

    if (error) {
      setError(error.message)
      setSending(false)
      return
    }

    setReply('')
    setNewMessage('')
    setShowNew(false)
    setSelectedUser('')
    setActiveUser(recipientId)

    await initialise()
    setSending(false)
  }

  useEffect(() => {
    initialise()

    const channel = supabase
      .channel('nvpl-messages-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'nvpl_messages' },
        () => initialise()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const activeMessages = messages.filter(
    message =>
      (message.sender_id === userId && message.recipient_id === activeUser) ||
      (message.sender_id === activeUser && message.recipient_id === userId)
  )

  const activePlayer = players.find(player => player.user_id === activeUser)
  const unreadCount = messages.filter(
    message => message.recipient_id === userId && !message.is_read
  ).length

  function playerName(id: string) {
    const player = players.find(p => p.user_id === id)
    return player?.gamertag || player?.username || 'Player'
  }

  return (
    <main className="min-h-screen bg-[#080b12] text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        <header className="flex justify-between items-center gap-4 flex-wrap">
          <div>
            <p className="text-blue-400 font-semibold text-sm">NVPL</p>
            <h1 className="text-3xl font-bold">Messages</h1>
            <p className="text-gray-400 mt-1">
              Private player conversations
            </p>
          </div>

          <button
            onClick={() => {
              setShowNew(!showNew)
              setActiveUser('')
            }}
            className="bg-blue-600 hover:bg-blue-500 rounded-lg px-5 py-3 font-semibold"
          >
            + New Message
          </button>
        </header>

        {error && (
          <div className="bg-red-950 border border-red-800 text-red-300 rounded-lg p-3">
            {error}
          </div>
        )}

        {showNew && (
          <section className="bg-[#111827] border border-gray-800 rounded-xl p-5 space-y-4">
            <h2 className="text-xl font-bold">Start a conversation</h2>

            <select
              value={selectedUser}
              onChange={e => setSelectedUser(e.target.value)}
              className="w-full bg-[#080b12] border border-gray-700 rounded-lg p-3"
            >
              <option value="">Select a player</option>
              {players.map(player => (
                <option key={player.user_id} value={player.user_id}>
                  {player.gamertag || player.username || 'Player'}
                </option>
              ))}
            </select>

            <textarea
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder="Write your message..."
              rows={3}
              className="w-full bg-[#080b12] border border-gray-700 rounded-lg p-3"
            />

            <button
              disabled={!selectedUser || !newMessage.trim() || sending}
              onClick={() => sendMessage(selectedUser, newMessage)}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg px-5 py-3 font-semibold"
            >
              {sending ? 'Sending...' : 'Send Message'}
            </button>
          </section>
        )}

        {loading ? (
          <p className="text-gray-400">Loading messages...</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            <section className="bg-[#111827] border border-gray-800 rounded-xl p-5">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Inbox</h2>
                <span className="text-sm text-blue-400">
                  {unreadCount} unread
                </span>
              </div>

              <div className="space-y-2">
                {conversations().length === 0 && (
                  <p className="text-gray-500 text-sm">
                    No conversations yet.
                  </p>
                )}

                {conversations().map(conversation => (
                  <button
                    key={conversation.id}
                    onClick={() => {
                      setShowNew(false)
                      openConversation(conversation.id)
                    }}
                    className={`w-full text-left rounded-lg p-3 border ${
                      activeUser === conversation.id
                        ? 'bg-blue-950 border-blue-500'
                        : 'bg-[#080b12] border-gray-800 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold">
                        {playerName(conversation.id)}
                      </span>
                      {conversation.unread > 0 && (
                        <span className="bg-blue-600 rounded-full px-2 text-xs">
                          {conversation.unread}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-400 text-sm truncate mt-1">
                      {conversation.lastMessage.message}
                    </p>
                  </button>
                ))}
              </div>
            </section>

            <section className="lg:col-span-2 bg-[#111827] border border-gray-800 rounded-xl p-5 min-h-[550px] flex flex-col">
              {showNew ? (
                <p className="text-gray-400">
                  Choose a player above to start a conversation.
                </p>
              ) : !activeUser ? (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                  Select a conversation or start a new message.
                </div>
              ) : (
                <>
                  <div className="border-b border-gray-800 pb-4">
                    <h2 className="text-xl font-bold">
                      {activePlayer?.gamertag ||
                        activePlayer?.username ||
                        'Conversation'}
                    </h2>
                  </div>

                  <div className="flex-1 space-y-3 py-5 max-h-[500px] overflow-y-auto">
                    {activeMessages.map(message => (
                      <div
                        key={message.id}
                        className={`flex ${
                          message.sender_id === userId
                            ? 'justify-end'
                            : 'justify-start'
                        }`}
                      >
                        <div className={`max-w-[85%] rounded-xl p-3 ${
                          message.sender_id === userId
                            ? 'bg-blue-700'
                            : 'bg-[#080b12] border border-gray-700'
                        }`}>
                          <p className="whitespace-pre-wrap break-words">
                            {message.message}
                          </p>
                          <p className="text-xs opacity-60 mt-2">
                            {new Date(message.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <form
                    onSubmit={e => {
                      e.preventDefault()
                      sendMessage(activeUser, reply)
                    }}
                    className="flex gap-2 border-t border-gray-800 pt-4"
                  >
                    <input
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      placeholder="Write a message..."
                      className="flex-1 min-w-0 bg-[#080b12] border border-gray-700 rounded-lg p-3"
                    />
                    <button
                      disabled={!reply.trim() || sending}
                      className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-5 rounded-lg font-semibold"
                    >
                      Send
                    </button>
                  </form>
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  )
}
