
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      if (isRegistering) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        })

        if (error) throw error

        if (data.session) {
          router.replace('/dashboard')
          router.refresh()
        } else {
          setMessage('Account created! Check your email to confirm your account.')
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error

        setMessage('Login successful! Redirecting...')

        router.replace('/dashboard')
        router.refresh()
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Something went wrong. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#080d18] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111a2b] p-8">
        <Link href="/" className="text-blue-400 font-bold text-sm">
          ← Back to NVPL
        </Link>

        <h1 className="mt-8 text-3xl font-black">
          {isRegistering ? 'Create your account' : 'Welcome back'}
        </h1>

        <p className="mt-2 text-gray-400">
          {isRegistering
            ? 'Join the National Virtual Pro League.'
            : 'Log in to your NVPL account.'}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block text-sm">Email address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#080d18] p-3 outline-none focus:border-blue-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#080d18] p-3 outline-none focus:border-blue-500"
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 p-3 font-bold hover:bg-blue-500 disabled:opacity-50"
          >
            {loading
              ? 'Please wait...'
              : isRegistering
                ? 'Create account'
                : 'Log in'}
          </button>
        </form>

        {message && (
          <p className="mt-5 text-sm text-blue-300">
            {message}
          </p>
        )}

        <button
          type="button"
          onClick={() => {
            setIsRegistering(!isRegistering)
            setMessage('')
          }}
          className="mt-6 w-full text-sm text-gray-400 hover:text-white"
        >
          {isRegistering
            ? 'Already have an account? Log in'
            : "Don't have an account? Register"}
        </button>
      </div>
    </main>
  )
}
