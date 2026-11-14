
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Team = {
  id: string
  name: string
  abbreviation: string
  region: string
}

type Player = {
  id: string
  username: string
  gamertag: string
  country: string | null
  region: string
  avatar_url: string | null
}

export default function TransfersPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeam, setSelectedTeam] = useState('')
  const [search, setSearch] = useState('')
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [sendingId, setSendingId] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function loadTeams() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        window.location.href = '/login'
        return
      }

      const { data, error } = await supabase
        .from('teams')
        .select('id, name, abbreviation, region')
        .eq('owner_id', user.id)
        .order('name')

      if (error) {
        setMessage(error.message)
      } else {
        setTeams(data || [])
        if (data?.length) setSelectedTeam(data[0].id)
      }

      setLoading(false)
    }

    loadTeams()
  }, [])

  async function searchPlayers(e: React.FormEvent) {
    e.preventDefault()

    const term = search.trim().replace(/^@/, '')

    if (term.length < 2) {
      setMessage('Enter at least 2 characters to search.')
      return
    }

    setSearching(true)
    setMessage('')
    setPlayers([])

    const { data, error } = await supabase
      .from('player_profiles')
      .select('id, username, gamertag, country, region, avatar_url')
      .ilike('username', `%${term}%`)
      .not('username', 'is', null)
      .limit(20)

    if (error) {
      setMessage(error.message)
    } else {
      setPlayers((data || []) as Player[])

      if (!data?.length) {
        setMessage('No players found. Try another username.')
      }
    }

    setSearching(false)
  }

  async function sendInvitation(playerId: string) {
    if (!selectedTeam) {
      setMessage('Select a club first.')
      return
    }

    setSendingId(playerId)
    setMessage('')

    const { error } = await supabase.rpc('send_club_invitation', {
      p_team_id: selectedTeam,
      p_player_id: playerId
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Club invitation sent successfully!')
    }

    setSendingId('')
  }

  const activeTeam = teams.find(team => team.id === selectedTeam)

  const matchingPlayers = players.filter(player =>
    !activeTeam || player.region === activeTeam.region
  )

  if (loading) {
    return (
      <main className="min-h-screen bg-[#080d18] text-white p-8">
        Loading transfers...
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#080d18] text-white p-6">
      <div className="max-w-5xl mx-auto">

        <Link href="/dashboard" className="text-blue-400 hover:text-blue-300">
          ← Back to Dashboard
        </Link>

        <div className="mt-8 mb-8">
          <p className="text-blue-400 font-bold tracking-widest text-sm">
            NVPL CLUB MANAGEMENT
          </p>
          <h1 className="text-4xl font-bold mt-2">Player Transfers</h1>
          <p className="text-gray-400 mt-2">
            Find players and invite them to your club.
          </p>
        </div>

        {message && (
          <div className="bg-[#17243a] border border-[#263957] p-4 rounded-lg mb-6">
            {message}
          </div>
        )}

        {teams.length === 0 ? (
          <div className="bg-[#111c30] border border-[#263957] rounded-xl p-8">
            <h2 className="text-xl font-bold">No clubs available</h2>
            <p className="text-gray-400 mt-2">
              You need to create a club before sending player invitations.
            </p>
            <Link href="/teams" className="inline-block mt-5 text-blue-400">
              Go to Club Management →
            </Link>
          </div>
        ) : (
          <>
            <section className="bg-[#111c30] border border-[#263957] rounded-xl p-6 mb-6">
              <h2 className="text-xl font-bold mb-4">Select Your Club</h2>

              <select
                value={selectedTeam}
                onChange={e => {
                  setSelectedTeam(e.target.value)
                  setPlayers([])
                  setMessage('')
                }}
                className="w-full bg-[#080d18] border border-gray-700 rounded-lg p-4"
              >
                {teams.map(team => (
                  <option key={team.id} value={team.id}>
                    {team.name} ({team.abbreviation}) — {team.region}
                  </option>
                ))}
              </select>
            </section>

            <section className="bg-[#111c30] border border-[#263957] rounded-xl p-6 mb-6">
              <h2 className="text-xl font-bold mb-2">Find a Player</h2>
              <p className="text-gray-400 text-sm mb-5">
                Search using their unique NVPL username, not their EA FC gamertag.
              </p>

              <form onSubmit={searchPlayers} className="flex flex-col sm:flex-row gap-3">
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Enter NVPL username..."
                  className="flex-1 bg-[#080d18] border border-gray-700 rounded-lg p-4 outline-none focus:border-blue-500"
                />

                <button
                  type="submit"
                  disabled={searching}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg px-8 py-4 font-bold"
                >
                  {searching ? 'Searching...' : 'Search Players'}
                </button>
              </form>
            </section>

            {players.length > 0 && (
              <section>
                <h2 className="text-xl font-bold mb-4">
                  Search Results ({matchingPlayers.length})
                </h2>

                {matchingPlayers.length === 0 ? (
                  <div className="bg-[#111c30] border border-[#263957] rounded-xl p-6">
                    No players from the {activeTeam?.region} region matched your search.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {matchingPlayers.map(player => (
                      <div
                        key={player.id}
                        className="bg-[#111c30] border border-[#263957] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-5"
                      >
                        <div className="flex items-center gap-4">
                          {player.avatar_url ? (
                            <img
                              src={player.avatar_url}
                              alt=""
                              className="w-16 h-16 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-[#263957] flex items-center justify-center text-2xl font-bold">
                              {player.username.charAt(0).toUpperCase()}
                            </div>
                          )}

                          <div>
                            <h3 className="font-bold text-lg">
                              @{player.username}
                            </h3>
                            <p className="text-gray-400 text-sm">
                              EA FC: {player.gamertag}
                            </p>
                            <p className="text-gray-500 text-sm">
                              {player.country || 'Country not set'} · {player.region}
                            </p>
                            <Link
                              href={`/player/${encodeURIComponent(player.username)}`}
                              className="text-blue-400 text-sm"
                            >
                              View Profile
                            </Link>
                          </div>
                        </div>

                        <button
                          onClick={() => sendInvitation(player.id)}
                          disabled={!!sendingId}
                          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg px-6 py-3 font-bold"
                        >
                          {sendingId === player.id ? 'Sending...' : 'Send Invitation'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  )
}
