
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type AdminRole =
  | 'super_admin'
  | 'competition_admin'
  | 'moderator'
  | 'support_admin'
  | 'admin'

type AdminUser = {
  user_id: string
  email: string
  created_at: string
  admin_role: AdminRole | null
}

const roles: { value: AdminRole; label: string }[] = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'competition_admin', label: 'Competition Admin' },
  { value: 'moderator', label: 'Moderator' },
  { value: 'support_admin', label: 'Support Admin' },
  { value: 'admin', label: 'General Admin' },
]

export default function AdminManagementPage() {
  const router = useRouter()

  const [users, setUsers] = useState<AdminUser[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState('')
  const [allowed, setAllowed] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function loadUsers(searchTerm = '') {
    setSearching(true)
    setError('')
    setNotice('')

    const { data, error } = await supabase.rpc(
      'nvpl_admin_list_users',
      { p_search: searchTerm.trim() || null }
    )

    if (error) {
      setError(error.message)
      setUsers([])
    } else {
      setUsers((data ?? []) as AdminUser[])
    }

    setSearching(false)
    setLoading(false)
  }

  useEffect(() => {
    async function initialise() {
      const { data: authData, error: authError } =
        await supabase.auth.getUser()

      if (authError || !authData.user) {
        router.replace('/login')
        return
      }

      setCurrentUserId(authData.user.id)

      const { data, error } = await supabase.rpc(
        'is_nvpl_super_admin'
      )

      if (error || data !== true) {
        setAllowed(false)
        setLoading(false)
        return
      }

      setAllowed(true)
      await loadUsers()
    }

    initialise()
  }, [router])

  async function changeRole(userId: string, role: AdminRole) {
    if (userId === currentUserId) return

    setSaving(userId)
    setError('')
    setNotice('')

    const { error } = await supabase.rpc(
      'nvpl_admin_set_role',
      {
        p_user_id: userId,
        p_role: role,
      }
    )

    if (error) {
      setError(error.message)
    } else {
      setNotice('Administrator role updated successfully.')
      await loadUsers(search)
    }

    setSaving(null)
  }

  async function removeAdmin(user: AdminUser) {
    if (user.user_id === currentUserId) return

    const confirmed = window.confirm(
      `Remove administrator access from ${user.email}?`
    )

    if (!confirmed) return

    setSaving(user.user_id)
    setError('')
    setNotice('')

    const { error } = await supabase.rpc(
      'nvpl_admin_remove',
      { p_user_id: user.user_id }
    )

    if (error) {
      setError(error.message)
    } else {
      setNotice('Administrator access removed.')
      await loadUsers(search)
    }

    setSaving(null)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#080b12] text-white p-8">
        Loading admin management...
      </main>
    )
  }

  if (!allowed) {
    return (
      <main className="min-h-screen bg-[#080b12] text-white p-8">
        <h1 className="text-2xl font-bold">Access denied</h1>
        <p className="mt-2 text-gray-400">
          You need Super Admin access to manage administrators.
        </p>
        <Link href="/admin" className="text-blue-400 mt-6 inline-block">
          Back to dashboard
        </Link>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#080b12] text-white p-6 md:p-10">
      <div className="max-w-7xl mx-auto">

        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <p className="text-sm text-blue-400 font-semibold">
              NVPL CONTROL PANEL
            </p>
            <h1 className="text-3xl font-bold mt-1">
              Admin Management
            </h1>
            <p className="text-gray-400 mt-2">
              Manage registered users and administrator permissions.
            </p>
          </div>

          <Link
            href="/admin"
            className="rounded-lg bg-gray-800 hover:bg-gray-700 px-4 py-2 text-sm"
          >
            Back to Dashboard
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-[#111827] border border-gray-800 rounded-xl p-5">
            <p className="text-gray-400 text-sm">Registered users</p>
            <p className="text-3xl font-bold mt-2">{users.length}</p>
            <p className="text-xs text-gray-500 mt-1">
              Maximum 100 results displayed
            </p>
          </div>

          <div className="bg-[#111827] border border-gray-800 rounded-xl p-5">
            <p className="text-gray-400 text-sm">Administrators shown</p>
            <p className="text-3xl font-bold mt-2">
              {users.filter(user => user.admin_role).length}
            </p>
          </div>

          <div className="bg-[#111827] border border-gray-800 rounded-xl p-5">
            <p className="text-gray-400 text-sm">Available roles</p>
            <p className="text-3xl font-bold mt-2">{roles.length}</p>
          </div>
        </div>

        <section className="bg-[#111827] border border-gray-800 rounded-xl p-5 mb-6">
          <h2 className="text-lg font-semibold mb-4">
            Find registered users
          </h2>

          <form
            onSubmit={event => {
              event.preventDefault()
              loadUsers(search)
            }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search by email or user ID..."
              className="flex-1 bg-[#080b12] border border-gray-700 rounded-lg px-4 py-3 outline-none focus:border-blue-500"
            />

            <button
              type="submit"
              disabled={searching}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg px-6 py-3 font-semibold"
            >
              {searching ? 'Searching...' : 'Search users'}
            </button>

            <button
              type="button"
              onClick={() => {
                setSearch('')
                loadUsers('')
              }}
              className="bg-gray-700 hover:bg-gray-600 rounded-lg px-5 py-3"
            >
              Clear
            </button>
          </form>
        </section>

        {error && (
          <div className="bg-red-950/50 border border-red-800 text-red-300 rounded-lg p-4 mb-5">
            {error}
          </div>
        )}

        {notice && (
          <div className="bg-green-950/40 border border-green-800 text-green-300 rounded-lg p-4 mb-5">
            {notice}
          </div>
        )}

        <section className="bg-[#111827] border border-gray-800 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-gray-800">
            <h2 className="text-lg font-semibold">User accounts</h2>
            <p className="text-sm text-gray-400 mt-1">
              Promote users, change roles or remove administrator access.
            </p>
          </div>

          {users.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              No users found.
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {users.map(user => (
                <div
                  key={user.user_id}
                  className="p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-5"
                >
                  <div className="min-w-0">
                    <p className="font-semibold break-all">
                      {user.email || 'No email available'}
                    </p>

                    <p className="text-xs text-gray-500 mt-1 break-all">
                      ID: {user.user_id}
                    </p>

                    <p className="text-xs text-gray-500 mt-1">
                      Registered:{' '}
                      {new Date(user.created_at).toLocaleDateString()}
                    </p>

                    {user.user_id === currentUserId && (
                      <span className="inline-block mt-2 text-xs text-blue-400">
                        Your account
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                    <div className="min-w-48">
                      <p className="text-xs text-gray-400 mb-1">
                        Administrator role
                      </p>

                      <select
                        value={user.admin_role ?? ''}
                        disabled={
                          saving === user.user_id ||
                          user.user_id === currentUserId
                        }
                        onChange={event =>
                          changeRole(
                            user.user_id,
                            event.target.value as AdminRole
                          )
                        }
                        className="w-full bg-[#080b12] border border-gray-700 rounded-lg px-3 py-2 disabled:opacity-50"
                      >
                        <option value="" disabled>
                          Not an administrator
                        </option>

                        {roles.map(role => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-end">
                      <button
                        type="button"
                        disabled={
                          !user.admin_role ||
                          saving === user.user_id ||
                          user.user_id === currentUserId
                        }
                        onClick={() => removeAdmin(user)}
                        className="bg-red-600/20 border border-red-800 text-red-300 hover:bg-red-600/30 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg px-4 py-2"
                      >
                        {saving === user.user_id
                          ? 'Saving...'
                          : 'Remove admin'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <p className="text-xs text-gray-500 mt-5">
          Only Super Admins can use this page. Your own administrator
          role cannot be changed here. The database also prevents
          removal of the last Super Admin.
        </p>
      </div>
    </main>
  )
}
