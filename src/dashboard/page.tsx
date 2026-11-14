
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function DashboardPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function checkUser() {
      const { data } = await supabase.auth.getSession()

      if (!mounted) return

      if (!data.session) {
        router.replace('/login')
      } else {
        setEmail(data.session.user.email ?? '')
        setLoading(false)
      }
    }

    checkUser()

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) {
          router.replace('/login')
        } else if (mounted) {
          setEmail(session.user.email ?? '')
          setLoading(false)
        }
      }
    )

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [router])

  async function logout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#080d18] text-white flex items-center justify-center">
        Loading NVPL...
      </main>
    )
  }

  const sections = [
    { name: 'My Team', description: 'Manage your squad and players', icon: '⚽' },
    { name: 'Competitions', description: 'Explore regional leagues', icon: '🏆' },
    { name: 'Fixtures', description: 'Upcoming matches and results', icon: '📅' },
    { name: 'Standings', description: 'View league tables', icon: '📊' },
    { name: 'Statistics', description: 'Player and team performance', icon: '📈' },
  ]

  return (
    <main className="min-h-screen bg-[#080d18] text-white">
      <nav className="border-b border-white/10 bg-[#111a2b] px-6 py-5 flex justify-between items-center">
        <Link href="/" className="text-2xl font-black">
          NVPL<span className="text-blue-500">.</span>
        </Link>
        <button onClick={logout} className="text-sm text-gray-300 hover:text-white">
          Log out
        </button>
      </nav>

      <div className="max-w-6xl mx-auto p-6 md:p-10">
        <p className="text-blue-400 text-sm font-bold tracking-widest">
          MEMBER AREA
        </p>

        <h1 className="text-4xl font-black mt-3">
          Welcome to NVPL.
        </h1>

        <p className="text-gray-400 mt-2">
          Signed in as {email}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10">
          {['OCEANIA', 'EUROPE', 'NORTH AMERICA'].map((region) => (
            <div key={region} className="bg-[#111a2b] border border-white/10 rounded-xl p-6">
              <p className="text-blue-400 text-xs font-bold">{region}</p>
              <h2 className="text-xl font-bold mt-3">Coming soon</h2>
              <p className="text-gray-500 text-sm mt-2">Regional competitions</p>
            </div>
          ))}
        </div>

        <h2 className="text-2xl font-bold mt-12 mb-5">League Hub</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {sections.map((section) => (
            <div key={section.name} className="bg-[#111a2b] border border-white/10 rounded-xl p-6">
              <span className="text-3xl">{section.icon}</span>
              <h3 className="text-xl font-bold mt-4">{section.name}</h3>
              <p className="text-gray-400 text-sm mt-2">{section.description}</p>
              <p className="text-blue-400 text-xs font-bold mt-5">COMING SOON</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
