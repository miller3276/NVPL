
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import NVPLBadges from '@/components/NVPLBadges'

type Team = {
  id: string
  name: string
  abbreviation: string
  region: string
  description: string | null
  badge_url: string | null
  created_at: string
}

type Member = {
  id: string
  player_id: string
  primary_position: string | null
  secondary_position: string | null
  squad_number: number | null
}

type Profile = {
  id: string
  username: string | null
  gamertag: string
  avatar_url: string | null
  country: string | null
}

export default function ClubPage() {
  const params = useParams()
  const id = params.id as string

  const [team, setTeam] = useState<Team | null>(null)
  const [members, setMembers] = useState<(Member & { profile: Profile | null })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) loadClub()
  }, [id])

  async function loadClub() {
    setLoading(true)

    const { data: teamData } = await supabase
      .from('teams')
      .select('id, name, abbreviation, region, description, badge_url, created_at')
      .eq('id', id)
      .maybeSingle()

    if (!teamData) {
      setTeam(null)
      setLoading(false)
      return
    }

    setTeam(teamData as Team)

    const { data: memberData } = await supabase
      .from('club_memberships')
      .select('id, player_id, primary_position, secondary_position, squad_number')
      .eq('team_id', id)
      .eq('status', 'active')

    const activeMembers = (memberData || []) as Member[]

    if (activeMembers.length > 0) {
      const { data: profiles } = await supabase
        .from('player_profiles')
        .select('id, username, gamertag, avatar_url, country')
        .in('id', activeMembers.map(member => member.player_id))

      setMembers(activeMembers.map(member => ({
        ...member,
        profile: (profiles || []).find(profile => profile.id === member.player_id) || null
      })).sort((a, b) => (a.squad_number ?? 100) - (b.squad_number ?? 100)))
    } else {
      setMembers([])
    }

    setLoading(false)
  }

  if (loading) {
    return <main className="min-h-screen bg-gray-950 text-white p-8">Loading club...</main>
  }

  if (!team) {
    return <main className="min-h-screen bg-gray-950 text-white p-8">Club not found.</main>
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-5xl mx-auto">

        <section className="bg-gray-900 border border-gray-800 rounded-2xl p-8 mb-8">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {team.badge_url ? (
              <img src={team.badge_url} alt={`${team.name} badge`} className="w-32 h-32 object-contain bg-gray-800 rounded-2xl p-3" />
            ) : (
              <div className="w-32 h-32 bg-gray-800 rounded-2xl flex items-center justify-center text-4xl font-bold">
                {team.abbreviation}
              </div>
            )}

            <div className="text-center sm:text-left">
              <p className="text-blue-400 font-semibold">{team.region}</p>
              <h1 className="text-4xl font-bold mt-1">{team.name}</h1>
              <p className="text-gray-400 mt-2">{team.abbreviation}</p>
              <p className="text-gray-500 text-sm mt-2">
                {members.length} active players
              </p>
            </div>
          </div>

          {team.description && (
            <p className="text-gray-300 mt-7 whitespace-pre-wrap">{team.description}</p>
          )}
        </section>

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-2xl font-bold">Squad</h2>
          <span className="text-gray-400 text-sm">{members.length} players</span>
        </div>

        {members.length === 0 ? (
          <div className="bg-gray-900 rounded-xl p-8 text-center text-gray-400">
            This club hasn't added any players yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {members.map(member => (
              <a
                key={member.id}
                href={member.profile?.username
                  ? `/player/${encodeURIComponent(member.profile.username)}`
                  : '#'}
                className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center gap-4 hover:border-blue-500 transition"
              >
                {member.profile?.avatar_url ? (
                  <img src={member.profile.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-gray-700 flex items-center justify-center font-bold">
                    {(member.profile?.username || member.profile?.gamertag || '?')[0].toUpperCase()}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="font-bold truncate">
                    {member.profile?.username
                      ? `@${member.profile.username}`
                      : member.profile?.gamertag || 'Player'}
                  </p>
                  <p className="text-sm text-gray-400">
                    {member.primary_position || 'Position not assigned'}
                    {member.secondary_position ? ` / ${member.secondary_position}` : ''}
                  </p>
                  <p className="text-xs text-gray-500">
                    {member.profile?.gamertag || ''}
                    {member.profile?.country ? ` · ${member.profile.country}` : ''}
                  </p>
                </div>

                <div className="text-2xl font-bold text-blue-400">
                  {member.squad_number ?? '—'}
                </div>
              </a>
            ))}
          </div>
        )}

        <div className="mt-8">
          <NVPLBadges teamId={team.id} />
        </div>

        <a href="/directory" className="inline-block mt-8 text-blue-400 hover:underline">
          Player directory →
        </a>
      </div>
    </main>
  )
}
