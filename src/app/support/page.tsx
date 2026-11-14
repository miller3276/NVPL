
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Ticket = {
  id: string
  user_id: string
  subject: string
  category: string
  priority: string
  status: string
  created_at: string
  updated_at: string
}

type SupportMessage = {
  id: string
  ticket_id: string
  sender_id: string
  sender_role: string
  content: string
  created_at: string
}

export default function SupportPage() {
  const [userId, setUserId] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [selected, setSelected] = useState<Ticket | null>(null)

  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState('General')
  const [priority, setPriority] = useState('normal')
  const [reply, setReply] = useState('')

  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function initialise() {
    setLoading(true)
    setError('')

    const { data: auth } = await supabase.auth.getUser()

    if (!auth.user) {
      setError('Please sign in to access support.')
      setLoading(false)
      return
    }

    setUserId(auth.user.id)

    const { data: admin } = await supabase
      .from('nvpl_admins')
      .select('user_id')
      .eq('user_id', auth.user.id)
      .maybeSingle()

    setIsAdmin(!!admin)

    await loadTickets()
    setLoading(false)
  }

  async function loadTickets() {
    const { data, error } = await supabase
      .from('nvpl_support_tickets')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) {
      setError(error.message)
      return
    }

    setTickets((data || []) as Ticket[])
  }

  async function loadMessages(ticket: Ticket) {
    setSelected(ticket)
    setMessages([])
    setError('')

    const { data, error } = await supabase
      .from('nvpl_support_messages')
      .select('*')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: true })

    if (error) {
      setError(error.message)
      return
    }

    setMessages((data || []) as SupportMessage[])
  }

  async function createTicket(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setNotice('')

    if (!subject.trim()) {
      setError('Enter a subject.')
      return
    }

    setSending(true)

    const { data, error } = await supabase
      .from('nvpl_support_tickets')
      .insert({
        user_id: userId,
        subject: subject.trim(),
        category,
        priority,
      })
      .select()
      .single()

    if (error) {
      setError(error.message)
      setSending(false)
      return
    }

    setSubject('')
    setNotice('Support ticket created.')
    await loadTickets()

    if (data) {
      await loadMessages(data as Ticket)
    }

    setSending(false)
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault()

    if (!selected || !reply.trim()) return

    setSending(true)
    setError('')
    setNotice('')

    const { error } = await supabase
      .from('nvpl_support_messages')
      .insert({
        ticket_id: selected.id,
        sender_id: userId,
        sender_role: isAdmin ? 'admin' : 'user',
        content: reply.trim(),
      })

    if (error) {
      setError(error.message)
      setSending(false)
      return
    }

    if (isAdmin) {
      await supabase
        .from('nvpl_support_tickets')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', selected.id)
    } else {
      await supabase
        .from('nvpl_support_tickets')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', selected.id)
    }

    setReply('')
    await loadMessages(selected)
    await loadTickets()
    setSending(false)
  }

  async function updateStatus(status: string) {
    if (!selected || !isAdmin) return

    const { error } = await supabase
      .from('nvpl_support_tickets')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selected.id)

    if (error) {
      setError(error.message)
      return
    }

    const updated = { ...selected, status }
    setSelected(updated)
    setNotice('Ticket status updated.')
    await loadTickets()
  }

  useEffect(() => {
    initialise()
  }, [])

  const openTickets = tickets.filter(t => t.status !== 'closed').length

  return (
    <main className="min-h-screen bg-[#080b12] text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        <header className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <p className="text-sm text-blue-400 font-semibold">NVPL SUPPORT</p>
            <h1 className="text-3xl font-bold">Support Centre</h1>
            <p className="text-gray-400 mt-1">
              {isAdmin
                ? 'Manage player support requests.'
                : 'Create a ticket and communicate privately with the support team.'}
            </p>
          </div>

          <button
            onClick={() => {
              loadTickets()
              if (selected) loadMessages(selected)
            }}
            className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg"
          >
            Refresh
          </button>
        </header>

        {error && (
          <div className="bg-red-950 border border-red-800 text-red-300 p-3 rounded-lg">
            {error}
          </div>
        )}

        {notice && (
          <div className="bg-green-950 border border-green-800 text-green-300 p-3 rounded-lg">
            {notice}
          </div>
        )}

        {loading ? (
          <p className="text-gray-400">Loading support...</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#111827] border border-gray-800 rounded-xl p-5">
                <p className="text-gray-400 text-sm">Total tickets</p>
                <p className="text-3xl font-bold mt-2">{tickets.length}</p>
              </div>

              <div className="bg-[#111827] border border-gray-800 rounded-xl p-5">
                <p className="text-gray-400 text-sm">Active tickets</p>
                <p className="text-3xl font-bold mt-2">{openTickets}</p>
              </div>

              <div className="bg-[#111827] border border-gray-800 rounded-xl p-5">
                <p className="text-gray-400 text-sm">Account type</p>
                <p className="text-2xl font-bold mt-2">
                  {isAdmin ? 'Support Admin' : 'Player'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              <section className="space-y-5">
                {!isAdmin && (
                  <form
                    onSubmit={createTicket}
                    className="bg-[#111827] border border-gray-800 rounded-xl p-5 space-y-3"
                  >
                    <h2 className="text-xl font-bold">Create a ticket</h2>

                    <input
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      placeholder="What do you need help with?"
                      maxLength={120}
                      className="w-full bg-[#080b12] border border-gray-700 rounded-lg p-3"
                    />

                    <select
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      className="w-full bg-[#080b12] border border-gray-700 rounded-lg p-3"
                    >
                      <option>General</option>
                      <option>Account</option>
                      <option>Club</option>
                      <option>Competition</option>
                      <option>Fixtures</option>
                      <option>Technical issue</option>
                      <option>Report</option>
                    </select>

                    <select
                      value={priority}
                      onChange={e => setPriority(e.target.value)}
                      className="w-full bg-[#080b12] border border-gray-700 rounded-lg p-3"
                    >
                      <option value="normal">Normal priority</option>
                      <option value="high">High priority</option>
                    </select>

                    <button
                      disabled={sending}
                      className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg p-3 font-semibold"
                    >
                      {sending ? 'Creating...' : 'Create ticket'}
                    </button>
                  </form>
                )}

                <div className="bg-[#111827] border border-gray-800 rounded-xl p-5">
                  <h2 className="text-xl font-bold mb-4">
                    {isAdmin ? 'All support tickets' : 'Your tickets'}
                  </h2>

                  <div className="space-y-2 max-h-[650px] overflow-y-auto">
                    {tickets.length === 0 && (
                      <p className="text-gray-500 text-sm">
                        No support tickets yet.
                      </p>
                    )}

                    {tickets.map(ticket => (
                      <button
                        key={ticket.id}
                        onClick={() => loadMessages(ticket)}
                        className={`w-full text-left p-3 rounded-lg border ${
                          selected?.id === ticket.id
                            ? 'bg-blue-950 border-blue-500'
                            : 'bg-[#080b12] border-gray-800 hover:border-gray-600'
                        }`}
                      >
                        <div className="flex justify-between gap-2">
                          <span className="font-semibold break-words">
                            {ticket.subject}
                          </span>
                          <span className={`text-xs ${
                            ticket.status === 'closed'
                              ? 'text-gray-500'
                              : 'text-green-400'
                          }`}>
                            {ticket.status}
                          </span>
                        </div>

                        <p className="text-xs text-gray-400 mt-2">
                          {ticket.category} · {ticket.priority} priority
                        </p>

                        {isAdmin && (
                          <p className="text-xs text-gray-500 mt-1">
                            Player: {ticket.user_id.slice(0, 8)}...
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="lg:col-span-2 bg-[#111827] border border-gray-800 rounded-xl p-5 min-h-[500px] flex flex-col">
                {!selected ? (
                  <div className="flex-1 flex items-center justify-center text-gray-500">
                    Select a ticket to view the conversation.
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap justify-between gap-3 border-b border-gray-800 pb-4">
                      <div>
                        <h2 className="text-xl font-bold">{selected.subject}</h2>
                        <p className="text-sm text-gray-400">
                          {selected.category} · {selected.priority} priority
                        </p>
                      </div>

                      {isAdmin && (
                        <select
                          value={selected.status}
                          onChange={e => updateStatus(e.target.value)}
                          className="bg-[#080b12] border border-gray-700 rounded-lg px-3 py-2"
                        >
                          <option value="open">Open</option>
                          <option value="in_progress">In progress</option>
                          <option value="closed">Closed</option>
                        </select>
                      )}
                    </div>

                    <div className="flex-1 space-y-3 py-5 max-h-[500px] overflow-y-auto">
                      {messages.length === 0 && (
                        <p className="text-gray-500 text-sm">
                          No messages yet. Send the first message below.
                        </p>
                      )}

                      {messages.map(message => {
                        const own = message.sender_id === userId

                        return (
                          <div
                            key={message.id}
                            className={`flex ${own ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className={`max-w-[85%] rounded-xl p-3 ${
                              own
                                ? 'bg-blue-700'
                                : 'bg-[#080b12] border border-gray-700'
                            }`}>
                              <p className="text-xs opacity-70 mb-1">
                                {message.sender_role === 'admin'
                                  ? 'NVPL Support'
                                  : own ? 'You' : 'Player'}
                              </p>
                              <p className="whitespace-pre-wrap break-words">
                                {message.content}
                              </p>
                              <p className="text-[10px] opacity-60 mt-2">
                                {new Date(message.created_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {selected.status !== 'closed' ? (
                      <form onSubmit={sendReply} className="flex gap-2 border-t border-gray-800 pt-4">
                        <input
                          value={reply}
                          onChange={e => setReply(e.target.value)}
                          placeholder="Write a reply..."
                          className="flex-1 min-w-0 bg-[#080b12] border border-gray-700 rounded-lg p-3"
                        />
                        <button
                          disabled={sending || !reply.trim()}
                          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-5 rounded-lg font-semibold"
                        >
                          Send
                        </button>
                      </form>
                    ) : (
                      <p className="text-gray-500 border-t border-gray-800 pt-4">
                        This ticket is closed.
                      </p>
                    )}
                  </>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
