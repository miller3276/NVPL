
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Post = {
  id: string
  author_id: string
  author_username: string
  content: string
  image_url: string | null
  pinned: boolean
  featured: boolean
  comments_locked: boolean
  created_at: string
}

type Report = {
  id: string
  post_id: string
  reporter_id: string
  reason: string
  status: string
  created_at: string
}

type Suspension = {
  user_id: string
  reason: string | null
  suspended_by: string | null
  created_at: string
}

type Tab = 'posts' | 'reports' | 'suspensions'

export default function CommunityManagementPage() {
  const [tab, setTab] = useState<Tab>('posts')
  const [posts, setPosts] = useState<Post[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [suspensions, setSuspensions] = useState<Suspension[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [userId, setUserId] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    checkAccess()
  }, [])

  async function checkAccess() {
    setLoading(true)
    setError('')

    const { data: authData, error: authError } =
      await supabase.auth.getUser()

    if (authError || !authData.user) {
      window.location.href = '/login'
      return
    }

    const { data: allowed, error: permissionError } =
      await supabase.rpc('nvpl_can_moderate_community')

    if (permissionError || !allowed) {
      setError('You do not have permission to manage the community.')
      setLoading(false)
      return
    }

    await loadData()
  }

  async function loadData() {
    setLoading(true)
    setError('')

    const [postsResult, reportsResult, suspensionsResult] =
      await Promise.all([
        supabase
          .from('nvpl_community_posts')
          .select('*')
          .order('created_at', { ascending: false }),

        supabase
          .from('nvpl_community_reports')
          .select('*')
          .order('created_at', { ascending: false }),

        supabase
          .from('nvpl_community_suspensions')
          .select('*')
          .order('created_at', { ascending: false }),
      ])

    if (postsResult.error) {
      setError('Posts: ' + postsResult.error.message)
    } else {
      setPosts(postsResult.data || [])
    }

    if (reportsResult.error) {
      setError('Reports: ' + reportsResult.error.message)
    } else {
      setReports(reportsResult.data || [])
    }

    if (suspensionsResult.error) {
      setError('Suspensions: ' + suspensionsResult.error.message)
    } else {
      setSuspensions(suspensionsResult.data || [])
    }

    setLoading(false)
  }

  async function updatePost(
    postId: string,
    changes: Partial<Post>
  ) {
    setError('')
    setMessage('')

    const { error } = await supabase
      .from('nvpl_community_posts')
      .update(changes)
      .eq('id', postId)

    if (error) {
      setError(error.message)
      return
    }

    setMessage('Post updated successfully.')
    await loadData()
  }

  async function deletePost(postId: string) {
    if (!window.confirm('Permanently delete this post?')) return

    setError('')
    setMessage('')

    const { error } = await supabase
      .from('nvpl_community_posts')
      .delete()
      .eq('id', postId)

    if (error) {
      setError(error.message)
      return
    }

    setMessage('Post deleted.')
    await loadData()
  }

  async function updateReport(reportId: string, status: string) {
    setError('')
    setMessage('')

    const { error } = await supabase
      .from('nvpl_community_reports')
      .update({ status })
      .eq('id', reportId)

    if (error) {
      setError(error.message)
      return
    }

    setMessage('Report status updated.')
    await loadData()
  }

  async function suspendUser() {
    const cleanId = userId.trim()

    if (!cleanId) {
      setError('Enter the player user UUID.')
      return
    }

    if (!reason.trim()) {
      setError('Enter a reason for the suspension.')
      return
    }

    setSaving(true)
    setError('')
    setMessage('')

    const { data: existing, error: checkError } = await supabase
      .from('nvpl_community_suspensions')
      .select('user_id')
      .eq('user_id', cleanId)
      .maybeSingle()

    if (checkError) {
      setError(checkError.message)
      setSaving(false)
      return
    }

    if (existing) {
      setError('This user already has a suspension.')
      setSaving(false)
      return
    }

    const { data: authData } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('nvpl_community_suspensions')
      .insert({
        user_id: cleanId,
        reason: reason.trim(),
        suspended_by: authData.user?.id,
      })

    if (error) {
      setError(error.message)
      setSaving(false)
      return
    }

    setUserId('')
    setReason('')
    setMessage('User suspension added.')
    setSaving(false)
    await loadData()
  }

  async function unsuspendUser(id: string) {
    if (!window.confirm('Remove this user suspension?')) return

    setError('')
    setMessage('')

    const { error } = await supabase
      .from('nvpl_community_suspensions')
      .delete()
      .eq('user_id', id)

    if (error) {
      setError(error.message)
      return
    }

    setMessage('User suspension removed.')
    await loadData()
  }

  const filteredPosts = posts.filter(post =>
    `${post.author_username} ${post.content}`
      .toLowerCase()
      .includes(search.toLowerCase())
  )

  const filteredReports = reports.filter(report =>
    `${report.reason} ${report.status} ${report.post_id}`
      .toLowerCase()
      .includes(search.toLowerCase())
  )

  const filteredSuspensions = suspensions.filter(item =>
    `${item.user_id} ${item.reason || ''}`
      .toLowerCase()
      .includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <main className="min-h-screen bg-[#080b14] text-white p-8">
        Loading community management...
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#080b14] text-white p-6 md:p-10">
      <div className="max-w-7xl mx-auto">

        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <p className="text-sm text-blue-400 font-semibold">
              NVPL ADMINISTRATION
            </p>
            <h1 className="text-3xl font-bold mt-1">
              Community Management
            </h1>
            <p className="text-gray-400 mt-2">
              Manage posts, reports and community suspensions.
            </p>
          </div>

          <button
            onClick={loadData}
            className="bg-blue-600 hover:bg-blue-500 px-5 py-3 rounded-xl font-semibold"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-4 rounded-xl mb-5">
            {error}
          </div>
        )}

        {message && (
          <div className="bg-green-500/10 border border-green-500/30 text-green-300 p-4 rounded-xl mb-5">
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-7">
          <div className="bg-[#111827] border border-white/10 rounded-2xl p-5">
            <p className="text-gray-400 text-sm">Total posts</p>
            <p className="text-3xl font-bold mt-2">{posts.length}</p>
          </div>

          <div className="bg-[#111827] border border-white/10 rounded-2xl p-5">
            <p className="text-gray-400 text-sm">Open reports</p>
            <p className="text-3xl font-bold mt-2">
              {reports.filter(r => r.status === 'open').length}
            </p>
          </div>

          <div className="bg-[#111827] border border-white/10 rounded-2xl p-5">
            <p className="text-gray-400 text-sm">Suspended users</p>
            <p className="text-3xl font-bold mt-2">
              {suspensions.length}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {([
            ['posts', 'Posts'],
            ['reports', 'Reports'],
            ['suspensions', 'Suspensions'],
          ] as [Tab, string][]).map(([value, label]) => (
            <button
              key={value}
              onClick={() => {
                setTab(value)
                setSearch('')
              }}
              className={`px-5 py-3 rounded-xl font-semibold ${
                tab === value
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#111827] text-gray-300 border border-white/10'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search..."
          className="w-full bg-[#111827] border border-white/10 rounded-xl px-4 py-3 mb-6 outline-none focus:border-blue-500"
        />

        {tab === 'posts' && (
          <div className="space-y-4">
            {filteredPosts.map(post => (
              <div
                key={post.id}
                className="bg-[#111827] border border-white/10 rounded-2xl p-5"
              >
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-lg">
                      {post.author_username}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(post.created_at).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 break-all">
                      Author ID: {post.author_id}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    {post.pinned && (
                      <span className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full">
                        Pinned
                      </span>
                    )}
                    {post.featured && (
                      <span className="bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full">
                        Featured
                      </span>
                    )}
                    {post.comments_locked && (
                      <span className="bg-yellow-500/20 text-yellow-300 px-3 py-1 rounded-full">
                        Comments locked
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-gray-200 whitespace-pre-wrap mt-4">
                  {post.content}
                </p>

                {post.image_url && (
                  <a
                    href={post.image_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 underline text-sm block mt-3"
                  >
                    View attached image
                  </a>
                )}

                <div className="flex flex-wrap gap-2 mt-5">
                  <button
                    onClick={() =>
                      updatePost(post.id, { pinned: !post.pinned })
                    }
                    className="bg-blue-600/20 text-blue-300 px-3 py-2 rounded-lg text-sm"
                  >
                    {post.pinned ? 'Unpin' : 'Pin'}
                  </button>

                  <button
                    onClick={() =>
                      updatePost(post.id, { featured: !post.featured })
                    }
                    className="bg-purple-600/20 text-purple-300 px-3 py-2 rounded-lg text-sm"
                  >
                    {post.featured ? 'Unfeature' : 'Feature'}
                  </button>

                  <button
                    onClick={() =>
                      updatePost(post.id, {
                        comments_locked: !post.comments_locked,
                      })
                    }
                    className="bg-yellow-600/20 text-yellow-300 px-3 py-2 rounded-lg text-sm"
                  >
                    {post.comments_locked
                      ? 'Unlock comments'
                      : 'Lock comments'}
                  </button>

                  <button
                    onClick={() => deletePost(post.id)}
                    className="bg-red-600/20 text-red-300 px-3 py-2 rounded-lg text-sm"
                  >
                    Delete post
                  </button>
                </div>
              </div>
            ))}

            {filteredPosts.length === 0 && (
              <p className="text-gray-500 py-8 text-center">
                No posts found.
              </p>
            )}
          </div>
        )}

        {tab === 'reports' && (
          <div className="space-y-4">
            {filteredReports.map(report => (
              <div
                key={report.id}
                className="bg-[#111827] border border-white/10 rounded-2xl p-5"
              >
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <p className="font-bold">
                      Report #{report.id.slice(0, 8)}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      {new Date(report.created_at).toLocaleString()}
                    </p>
                  </div>

                  <span className="text-sm bg-white/10 px-3 py-1 rounded-full h-fit">
                    {report.status}
                  </span>
                </div>

                <p className="mt-4 text-gray-200">
                  <strong>Reason:</strong> {report.reason}
                </p>

                <p className="text-sm text-gray-500 mt-2 break-all">
                  Post ID: {report.post_id}
                </p>

                <p className="text-sm text-gray-500 mt-1 break-all">
                  Reporter ID: {report.reporter_id}
                </p>

                <div className="flex flex-wrap gap-2 mt-5">
                  <button
                    onClick={() => {
                      setTab('posts')
                      setSearch(report.post_id)
                    }}
                    className="bg-blue-600/20 text-blue-300 px-3 py-2 rounded-lg text-sm"
                  >
                    View posts
                  </button>

                  <button
                    onClick={() => updateReport(report.id, 'resolved')}
                    className="bg-green-600/20 text-green-300 px-3 py-2 rounded-lg text-sm"
                  >
                    Resolve
                  </button>

                  <button
                    onClick={() => updateReport(report.id, 'dismissed')}
                    className="bg-gray-600/30 text-gray-300 px-3 py-2 rounded-lg text-sm"
                  >
                    Dismiss
                  </button>

                  <button
                    onClick={() => updateReport(report.id, 'open')}
                    className="bg-yellow-600/20 text-yellow-300 px-3 py-2 rounded-lg text-sm"
                  >
                    Reopen
                  </button>
                </div>
              </div>
            ))}

            {filteredReports.length === 0 && (
              <p className="text-gray-500 py-8 text-center">
                No reports found.
              </p>
            )}
          </div>
        )}

        {tab === 'suspensions' && (
          <div className="space-y-6">

            <div className="bg-[#111827] border border-white/10 rounded-2xl p-5">
              <h2 className="text-xl font-bold mb-4">
                Suspend a user
              </h2>

              <label className="block text-sm text-gray-400 mb-2">
                Player user UUID
              </label>
              <input
                value={userId}
                onChange={e => setUserId(e.target.value)}
                placeholder="Enter the user's Supabase UUID"
                className="w-full bg-[#080b14] border border-white/10 rounded-xl px-4 py-3 mb-4 outline-none focus:border-blue-500"
              />

              <label className="block text-sm text-gray-400 mb-2">
                Reason
              </label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Explain the reason for this suspension..."
                rows={3}
                className="w-full bg-[#080b14] border border-white/10 rounded-xl px-4 py-3 mb-4 outline-none focus:border-blue-500"
              />

              <button
                onClick={suspendUser}
                disabled={saving}
                className="bg-red-600 hover:bg-red-500 disabled:opacity-50 px-5 py-3 rounded-xl font-semibold"
              >
                {saving ? 'Suspending...' : 'Suspend user'}
              </button>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-bold">
                Current suspensions
              </h2>

              {filteredSuspensions.map(item => (
                <div
                  key={item.user_id}
                  className="bg-[#111827] border border-white/10 rounded-2xl p-5"
                >
                  <p className="font-semibold break-all">
                    User: {item.user_id}
                  </p>

                  <p className="text-gray-400 mt-2">
                    Reason: {item.reason || 'No reason supplied'}
                  </p>

                  <p className="text-xs text-gray-500 mt-2">
                    Suspended: {new Date(item.created_at).toLocaleString()}
                  </p>

                  <button
                    onClick={() => unsuspendUser(item.user_id)}
                    className="mt-4 bg-green-600/20 text-green-300 px-4 py-2 rounded-lg text-sm"
                  >
                    Remove suspension
                  </button>
                </div>
              ))}

              {filteredSuspensions.length === 0 && (
                <p className="text-gray-500 py-6 text-center">
                  No suspensions found.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="mt-10 border-t border-white/10 pt-5">
          <a
            href="/admin"
            className="text-blue-400 hover:text-blue-300"
          >
            ← Back to Admin Dashboard
          </a>
        </div>
      </div>
    </main>
  )
}
