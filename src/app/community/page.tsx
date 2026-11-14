
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Post = {
  id: string
  author_id: string
  author_username: string
  author_avatar: string | null
  content: string
  image_url: string | null
  pinned: boolean
  featured: boolean
  comments_locked: boolean
  created_at: string
}

type Comment = {
  id: string
  post_id: string
  author_id: string
  author_username: string
  content: string
  parent_comment_id: string | null
  created_at: string
}

type Like = {
  post_id: string
  user_id: string
}

export default function CommunityPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [likes, setLikes] = useState<Like[]>([])

  const [userId, setUserId] = useState('')
  const [username, setUsername] = useState('Member')

  const [newPost, setNewPost] = useState('')
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})

  const [reportedPosts, setReportedPosts] = useState<string[]>([])

  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function loadCommunity() {
    setLoading(true)
    setError('')

    const { data: authData } = await supabase.auth.getUser()
    const user = authData.user

    if (user) {
      setUserId(user.id)

      const fallbackUsername = user.email?.split('@')[0] || 'Member'
      setUsername(fallbackUsername)

      const { data: profile } = await supabase
        .from('player_profiles')
        .select('gamertag')
        .eq('user_id', user.id)
        .maybeSingle()

      if (profile?.gamertag) {
        setUsername(profile.gamertag)
      }
    } else {
      setUserId('')
      setUsername('Member')
    }

    const [postResult, commentResult, likeResult] =
      await Promise.all([
        supabase
          .from('nvpl_community_posts')
          .select('*')
          .order('pinned', { ascending: false })
          .order('created_at', { ascending: false }),

        supabase
          .from('nvpl_community_comments')
          .select('*')
          .order('created_at', { ascending: true }),

        supabase
          .from('nvpl_community_likes')
          .select('post_id, user_id'),
      ])

    if (postResult.error) {
      setError(postResult.error.message)
      setLoading(false)
      return
    }

    if (commentResult.error) {
      setError(commentResult.error.message)
      setLoading(false)
      return
    }

    if (likeResult.error) {
      setError(likeResult.error.message)
      setLoading(false)
      return
    }

    setPosts((postResult.data || []) as Post[])
    setComments((commentResult.data || []) as Comment[])
    setLikes((likeResult.data || []) as Like[])

    setLoading(false)
  }

  useEffect(() => {
    loadCommunity()
  }, [])

  async function createPost() {
    if (!userId) {
      setError('You must sign in to create a post.')
      return
    }

    if (!newPost.trim()) return

    setPosting(true)
    setError('')
    setSuccess('')

    const { error: insertError } = await supabase
      .from('nvpl_community_posts')
      .insert({
        author_id: userId,
        author_username: username,
        content: newPost.trim(),
      })

    if (insertError) {
      setError(insertError.message)
    } else {
      setNewPost('')
      setSuccess('Your post has been published!')
      await loadCommunity()
    }

    setPosting(false)
  }

  async function toggleLike(postId: string) {
    if (!userId) {
      setError('You must sign in to like posts.')
      return
    }

    setError('')

    const existingLike = likes.find(
      like => like.post_id === postId && like.user_id === userId
    )

    if (existingLike) {
      const { error: deleteError } = await supabase
        .from('nvpl_community_likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId)

      if (deleteError) {
        setError(deleteError.message)
        return
      }
    } else {
      const { error: insertError } = await supabase
        .from('nvpl_community_likes')
        .insert({
          post_id: postId,
          user_id: userId,
        })

      if (insertError) {
        setError(insertError.message)
        return
      }
    }

    const { data, error: fetchError } = await supabase
      .from('nvpl_community_likes')
      .select('post_id, user_id')

    if (fetchError) {
      setError(fetchError.message)
      return
    }

    setLikes((data || []) as Like[])
  }

  async function createComment(postId: string) {
    if (!userId) {
      setError('You must sign in to comment.')
      return
    }

    const content = commentInputs[postId]?.trim()

    if (!content) return

    setError('')

    const { error: insertError } = await supabase
      .from('nvpl_community_comments')
      .insert({
        post_id: postId,
        author_id: userId,
        author_username: username,
        content,
        parent_comment_id: null,
      })

    if (insertError) {
      setError(insertError.message)
      return
    }

    setCommentInputs(previous => ({
      ...previous,
      [postId]: '',
    }))

    const { data, error: fetchError } = await supabase
      .from('nvpl_community_comments')
      .select('*')
      .order('created_at', { ascending: true })

    if (fetchError) {
      setError(fetchError.message)
      return
    }

    setComments((data || []) as Comment[])
  }

  async function reportPost(postId: string) {
    if (!userId) {
      setError('You must sign in to report a post.')
      return
    }

    if (reportedPosts.includes(postId)) {
      return
    }

    const reason = window.prompt(
      'Why are you reporting this post? Please explain the issue.'
    )

    if (!reason?.trim()) return

    setError('')
    setSuccess('')

    const { error: reportError } = await supabase
      .from('nvpl_community_reports')
      .insert({
        post_id: postId,
        reporter_id: userId,
        reason: reason.trim(),
        status: 'open',
      })

    if (reportError) {
      setError(reportError.message)
      return
    }

    setReportedPosts(previous => [...previous, postId])
    setSuccess('Your report has been submitted for moderator review.')
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleString('en-AU', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <main className="min-h-screen bg-[#090d18] text-white">
      <div className="mx-auto max-w-4xl px-4 py-10">

        {/* HEADER */}
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-400">
            NVPL
          </p>

          <h1 className="mt-2 text-4xl font-bold">
            Community
          </h1>

          <p className="mt-2 text-gray-400">
            Connect with players, clubs and leagues across NVPL.
          </p>
        </div>

        {/* NOTIFICATIONS */}
        {error && (
          <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-300">
            {success}
          </div>
        )}

        {/* CREATE POST */}
        {userId ? (
          <section className="mb-8 rounded-2xl border border-white/10 bg-[#111827] p-5">
            <h2 className="mb-3 text-lg font-semibold">
              Create a post
            </h2>

            <textarea
              value={newPost}
              onChange={event => setNewPost(event.target.value)}
              placeholder="What's happening in the NVPL community?"
              rows={4}
              maxLength={2000}
              className="w-full resize-y rounded-xl border border-white/10 bg-[#090d18] p-4 text-sm outline-none focus:border-blue-500"
            />

            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                Posting as {username}
              </span>

              <button
                onClick={createPost}
                disabled={posting || !newPost.trim()}
                className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {posting ? 'Posting...' : 'Publish post'}
              </button>
            </div>
          </section>
        ) : (
          <div className="mb-8 rounded-xl border border-white/10 bg-[#111827] p-5 text-sm text-gray-300">
            Sign in to create posts, like posts and comment.
          </div>
        )}

        {/* FEED HEADER */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold">
            Latest posts
          </h2>

          <button
            onClick={loadCommunity}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            Refresh
          </button>
        </div>

        {/* FEED */}
        {loading ? (
          <div className="rounded-xl border border-white/10 bg-[#111827] p-10 text-center text-gray-400">
            Loading community...
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-[#111827] p-10 text-center">
            <h3 className="text-lg font-semibold">
              No posts yet
            </h3>

            <p className="mt-2 text-sm text-gray-400">
              Be the first to start a conversation.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {posts.map(post => {
              const postComments = comments.filter(
                comment => comment.post_id === post.id
              )

              const postLikes = likes.filter(
                like => like.post_id === post.id
              )

              const liked = likes.some(
                like =>
                  like.post_id === post.id &&
                  like.user_id === userId
              )

              return (
                <article
                  key={post.id}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-[#111827]"
                >
                  <div className="p-5">

                    {/* POST AUTHOR */}
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="font-semibold">
                          {post.author_username || 'Member'}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          {formatDate(post.created_at)}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        {post.pinned && (
                          <span className="rounded-full bg-yellow-500/15 px-3 py-1 text-xs text-yellow-400">
                            Pinned
                          </span>
                        )}

                        {post.featured && (
                          <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs text-blue-400">
                            Featured
                          </span>
                        )}
                      </div>
                    </div>

                    {/* POST CONTENT */}
                    <p className="whitespace-pre-wrap break-words text-sm leading-7 text-gray-200">
                      {post.content}
                    </p>

                    {post.image_url && (
                      <img
                        src={post.image_url}
                        alt="Community post"
                        className="mt-4 max-h-[450px] w-full rounded-xl object-cover"
                      />
                    )}

                    {/* POST ACTIONS */}
                    <div className="mt-5 flex flex-wrap items-center gap-5 border-b border-white/10 pb-4">

                      <button
                        onClick={() => toggleLike(post.id)}
                        className={`text-sm font-medium ${
                          liked ? 'text-blue-400' : 'text-gray-400'
                        }`}
                      >
                        {liked ? '♥ Liked' : '♡ Like'} · {postLikes.length}
                      </button>

                      <span className="text-sm text-gray-400">
                        {postComments.length} comments
                      </span>

                      {userId && (
                        <button
                          onClick={() => reportPost(post.id)}
                          disabled={reportedPosts.includes(post.id)}
                          className="text-sm text-red-400 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {reportedPosts.includes(post.id)
                            ? 'Reported'
                            : 'Report'}
                        </button>
                      )}
                    </div>

                    {/* COMMENTS */}
                    <div className="mt-4 space-y-3">
                      {postComments.map(comment => (
                        <div
                          key={comment.id}
                          className="rounded-xl bg-[#090d18] p-3"
                        >
                          <p className="text-sm font-semibold">
                            {comment.author_username || 'Member'}
                          </p>

                          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-300">
                            {comment.content}
                          </p>

                          <p className="mt-2 text-xs text-gray-600">
                            {formatDate(comment.created_at)}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* COMMENT INPUT */}
                    {post.comments_locked ? (
                      <p className="mt-4 text-xs text-gray-500">
                        Comments are locked on this post.
                      </p>
                    ) : userId ? (
                      <div className="mt-4 flex gap-2">
                        <input
                          value={commentInputs[post.id] || ''}
                          onChange={event =>
                            setCommentInputs(previous => ({
                              ...previous,
                              [post.id]: event.target.value,
                            }))
                          }
                          onKeyDown={event => {
                            if (event.key === 'Enter') {
                              createComment(post.id)
                            }
                          }}
                          placeholder="Write a comment..."
                          maxLength={1000}
                          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#090d18] px-4 py-3 text-sm outline-none focus:border-blue-500"
                        />

                        <button
                          onClick={() => createComment(post.id)}
                          disabled={!commentInputs[post.id]?.trim()}
                          className="rounded-xl bg-blue-600 px-4 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50"
                        >
                          Send
                        </button>
                      </div>
                    ) : (
                      <p className="mt-4 text-xs text-gray-500">
                        Sign in to comment.
                      </p>
                    )}

                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
