
'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Player = {
  id: string
  user_id: string
  username: string
  gamertag: string
  bio: string | null
  country: string | null
  region: string
  avatar_url: string | null
  market_value_millions: number
  is_ranked: boolean
}

type Club = {
  name: string
  abbreviation: string
  region: string
  primary_position: string | null
  secondary_position: string | null
  squad_number: number | null
}

function PlayerPageContent() {
  const params = useParams<{ username: string }>()
  const router = useRouter()
  const username = params.username

  const [player, setPlayer] = useState<Player | null>(null)
  const [club, setClub] = useState<Club | null>(null)
  const [loading, setLoading] = useState(true)
  const [messaging, setMessaging] = useState(false)
  const [currentUserId, setCurrentUserId] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadPlayer() {
      if (!username) return

      const { data: { user } } = await supabase.auth.getUser()
      if (user) setCurrentUserId(user.id)

      const { data, error: playerError } = await supabase
        .from('player_profiles')
        .select('id, user_id, username, gamertag, bio, country, region, avatar_url, market_value_millions, is_ranked')
        .eq('username', username.toLowerCase())
        .maybeSingle()

      if (playerError) {
        setError(playerError.message)
        setLoading(false)
        return
      }

      if (!data) {
        setError('Player not found.')
        setLoading(false)
        return
      }

      setPlayer(data as Player)

      const { data: membership, error: membershipError } = await supabase
        .from('club_memberships')
        .select('team_id, primary_position, secondary_position, squad_number')
        .eq('player_id', data.id)
        .eq('status', 'active')
        .maybeSingle()

      if (membershipError) {
        setError(membershipError.message)
      } else if (membership) {
        const { data: team } = await supabase
          .from('teams')
          .select('name, abbreviation, region')
          .eq('id', membership.team_id)
          .maybeSingle()

        if (team) {
          setClub({
            ...team,
            primary_position: membership.primary_position,
            secondary_position: membership.secondary_position,
            squad_number: membership.squad_number
          })
        }
      }

      setLoading(false)
    }

    loadPlayer()
  }, [username])

  async function startConversation() {
    if (!player || !currentUserId || messaging) return

    setMessaging(true)
    setError('')

    const [participantOne, participantTwo] =
      [currentUserId, player.user_id].sort()

    const { data: existing, error: lookupError } = await supabase
      .from('nvpl_conversations')
      .select('id')
      .eq('participant_one', participantOne)
      .eq('participant_two', participantTwo)
      .maybeSingle()

    if (lookupError) {
      setError(lookupError.message)
      setMessaging(false)
      return
    }

    if (existing) {
      router.push(`/messages/${existing.id}`)
      return
    }

    const { data: created, error: createError } = await supabase
      .from('nvpl_conversations')
      .insert({
        participant_one: participantOne,
        participant_two: participantTwo
      })
      .select('id')
      .single()

    if (createError) {
      const { data: found } = await supabase
        .from('nvpl_conversations')
        .select('id')
        .eq('participant_one', participantOne)
        .eq('participant_two', participantTwo)
        .maybeSingle()

      if (found) {
        router.push(`/messages/${found.id}`)
      } else {
        setError(createError.message)
        setMessaging(false)
      }

      return
    }

    router.push(`/messages/${created.id}`)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#080d18] text-white p-8">
        Loading player profile...
      </main>
    )
  }

  if (error && !player) {
    return (
      <main className="min-h-screen bg-[#080d18] text-white p-8">
        <Link href="/directory" className="text-blue-400">
          ← Back to Player Directory
        </Link>
        <h1 className="text-3xl font-bold mt-8">Player not found</h1>
        <p className="text-gray-400 mt-2">{error}</p>
      </main>
    )
  }

  if (!player) return null

  const isOwnProfile = currentUserId === player.user_id

  return (
    <main className="min-h-screen bg-[#080d18] text-white p-6">
      <div className="max-w-4xl mx-auto">
        <Link href="/directory" className="text-blue-400 hover:text-blue-300">
          ← Back to Player Directory
        </Link>

        <section className="bg-[#111c30] border border-[#263957] rounded-2xl p-8 mt-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {player.avatar_url ? (
              <img
                src={player.avatar_url}
                alt={`${player.username}'s profile`}
                className="w-32 h-32 rounded-full object-cover border-2 border-blue-500"
              />
            ) : (
              <div className="w-32 h-32 rounded-full bg-[#263957] flex items-center justify-center text-5xl font-bold">
                {player.username.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="text-center sm:text-left flex-1">
              <p className="text-blue-400 text-sm font-bold tracking-widest">
                NVPL PLAYER
              </p>
              <h1 className="text-4xl font-bold mt-2">@{player.username}</h1>
              <p className="text-gray-400 mt-2">{player.gamertag}</p>

              <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-4">
                <span className="bg-blue-600/20 text-blue-300 px-3 py-1 rounded-full text-sm">
                  {player.region}
                </span>

                {player.country && (
                  <span className="bg-[#263957] text-gray-300 px-3 py-1 rounded-full text-sm">
                    {player.country}
                  </span>
                )}

                {player.is_ranked && (
                  <span className="bg-emerald-600/20 text-emerald-300 px-3 py-1 rounded-full text-sm">
                    Ranked
                  </span>
                )}
              </div>

              {!isOwnProfile && currentUserId && (
                <button
                  onClick={startConversation}
                  disabled={messaging}
                  className="mt-5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-6 py-3 rounded-xl font-bold transition"
                >
                  {messaging ? 'Opening conversation...' : '✉ SEND MESSAGE'}
                </button>
              )}

              {error && (
                <p className="text-red-400 text-sm mt-3">{error}</p>
              )}
            </div>
          </div>

          <div className="border-t border-gray-700 mt-8 pt-6">
            <h2 className="text-lg font-bold">About</h2>
            <p className="text-gray-300 mt-3 whitespace-pre-wrap">
              {player.bio || 'This player has not added a bio yet.'}
            </p>
          </div>
        </section>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-6">
          <section className="bg-[#111c30] border border-[#263957] rounded-xl p-6">
            <p className="text-gray-400 text-sm">Current Club</p>

            {club ? (
              <>
                <h2 className="text-2xl font-bold mt-2">{club.name}</h2>
                <p className="text-blue-400 mt-1">
                  {club.abbreviation} · {club.region}
                </p>

                {club.squad_number !== null && (
                  <p className="text-gray-300 mt-4">
                    Squad number: {club.squad_number}
                  </p>
                )}

                {club.primary_position && (
                  <p className="text-gray-300 mt-1">
                    Position: {club.primary_position}
                  </p>
                )}

                {club.secondary_position && (
                  <p className="text-gray-400 mt-1">
                    Secondary: {club.secondary_position}
                  </p>
                )}
              </>
            ) : (
              <h2 className="text-xl font-bold mt-2">Free Agent</h2>
            )}
          </section>

          <section className="bg-[#111c30] border border-[#263957] rounded-xl p-6">
            <p className="text-gray-400 text-sm">Player Market Value</p>
            <h2 className="text-3xl font-bold text-blue-400 mt-3">
              ${Number(player.market_value_millions || 3).toFixed(2)}M
            </h2>
            <p className="text-gray-400 text-sm mt-2">
              {player.is_ranked ? 'Ranked player' : 'Unranked player'}
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}

export default function PlayerPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#080d18] text-white p-8">
          Loading player profile...
        </main>
      }
    >
      <PlayerPageContent />
    </Suspense>
  )
}
