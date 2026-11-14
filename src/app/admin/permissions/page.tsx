
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Permissions = {
  superAdmin: boolean
  competition: boolean
  moderation: boolean
  support: boolean
  general: boolean
  admin: boolean
}

const permissionList = [
  {
    name: 'Full website control',
    description: 'Manage all NVPL systems and administrators.',
    key: 'superAdmin' as const,
  },
  {
    name: 'Competition management',
    description: 'Manage competitions, fixtures and results.',
    key: 'competition' as const,
  },
  {
    name: 'Community moderation',
    description: 'Manage reports and community moderation.',
    key: 'moderation' as const,
  },
  {
    name: 'Support management',
    description: 'Manage support tickets and support operations.',
    key: 'support' as const,
  },
  {
    name: 'General administration',
    description: 'Access general administration tools.',
    key: 'general' as const,
  },
]

export default function AdminPermissionsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [permissions, setPermissions] = useState<Permissions>({
    superAdmin: false,
    competition: false,
    moderation: false,
    support: false,
    general: false,
    admin: false,
  })
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadPermissions() {
      const { data: authData, error: authError } =
        await supabase.auth.getUser()

      if (authError || !authData.user) {
        router.replace('/login')
        return
      }

      const checks = await Promise.all([
        supabase.rpc('is_nvpl_admin'),
        supabase.rpc('is_nvpl_super_admin'),
        supabase.rpc('nvpl_can_manage_competitions'),
        supabase.rpc('nvpl_can_moderate_community'),
        supabase.rpc('nvpl_can_manage_support'),
        supabase.rpc('nvpl_is_general_admin'),
      ])

      const failed = checks.find(result => result.error)

      if (failed) {
        setError(failed.error?.message || 'Could not load permissions.')
        setLoading(false)
        return
      }

      const [
        admin,
        superAdmin,
        competition,
        moderation,
        support,
        general,
      ] = checks.map(result => result.data === true)

      setAllowed(admin)

      setPermissions({
        admin,
        superAdmin,
        competition,
        moderation,
        support,
        general,
      })

      setLoading(false)
    }

    loadPermissions()
  }, [router])

  if (loading) {
    return (
      <main className="min-h-screen bg-[#080b12] text-white p-8">
        Loading permissions...
      </main>
    )
  }

  if (!allowed) {
    return (
      <main className="min-h-screen bg-[#080b12] text-white p-8">
        <h1 className="text-2xl font-bold">Access denied</h1>
        <p className="text-gray-400 mt-2">
          This page is restricted to NVPL administrators.
        </p>
        <Link href="/" className="text-blue-400 inline-block mt-5">
          Return home
        </Link>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#080b12] text-white p-6 md:p-10">
      <div className="max-w-5xl mx-auto">

        <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
          <div>
            <p className="text-sm text-blue-400 font-semibold">
              NVPL CONTROL PANEL
            </p>
            <h1 className="text-3xl font-bold mt-1">
              Role Permissions
            </h1>
            <p className="text-gray-400 mt-2">
              View the permissions assigned to your account.
            </p>
          </div>

          <Link
            href="/admin"
            className="bg-gray-800 hover:bg-gray-700 rounded-lg px-4 py-2"
          >
            Back to Dashboard
          </Link>
        </div>

        {error && (
          <div className="bg-red-950/40 border border-red-800 text-red-300 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        <section className="bg-[#111827] border border-gray-800 rounded-xl p-5 mb-6">
          <p className="text-sm text-gray-400">Account access</p>
          <h2 className="text-2xl font-bold mt-1">
            {permissions.superAdmin
              ? 'Super Admin'
              : 'NVPL Administrator'}
          </h2>
          <p className="text-gray-400 text-sm mt-2">
            Your current database permission checks are shown below.
          </p>
        </section>

        <div className="space-y-4">
          {permissionList.map(item => {
            const active = permissions[item.key]

            return (
              <div
                key={item.key}
                className="bg-[#111827] border border-gray-800 rounded-xl p-5 flex items-center justify-between gap-4"
              >
                <div>
                  <h3 className="font-semibold">{item.name}</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    {item.description}
                  </p>
                </div>

                <span
                  className={`shrink-0 text-xs font-semibold px-3 py-2 rounded-lg ${
                    active
                      ? 'bg-green-900/40 text-green-300'
                      : 'bg-gray-800 text-gray-400'
                  }`}
                >
                  {active ? 'Granted' : 'Not granted'}
                </span>
              </div>
            )
          })}
        </div>

        <p className="text-xs text-gray-500 mt-6">
          These checks report your assigned role permissions.
          Individual website pages and database policies still need
          to enforce the appropriate checks before access is fully
          restricted.
        </p>
      </div>
    </main>
  )
}
