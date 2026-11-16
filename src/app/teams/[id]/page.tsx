'use client'

import { Suspense, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Team = {
  id: string
  name: string
  abbreviation: string
  region: string
  description: string | null
  badge_url: string | null
  founded_at: string | null
  owner_id: string
  ea_club_name: string | null
  ea_club_id: string | null
  ea_platform: string | null
}

type Member = {
  id: string
  gamertag: string
  position: string | null
  avatar_url: string | null
  primary_position: string | null
  squad_number: number | null
}

type Staff = {
  user_id: string
  role: string
}

function TeamProfileContent() {
  const params = useParams()
  const teamId = String(params.id)

  const [team, setTeam] = useState<Team | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadProfile() {
      setLoading(true)
      setError('')

      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select(`
          id,
          name,
          abbreviation,
          region,
          description,
          badge_url,
          founded_at,
          owner_id,
          ea_club_name,
          ea_club_id,
          ea_platform
        `)
        .eq('id', teamId)
        .single()

      if (teamError || !teamData) {
        setError('Could not find this club.')
        setLoading(false)
        return
      }

      setTeam(teamData as Team)

      const { data: membershipData, error: membershipError } =
        await supabase
          .from('club_memberships')
          .select(`
            player_id,
            primary_position,
            squad_number,
            player_profiles (
              id,
              gamertag,
              position,
              avatar_url
            )
          `)
          .eq('team_id', teamId)
          .is('left_at', null)

      if (!membershipError && membershipData) {
        const loadedMembers = membershipData
          .map((membership: any) => {
            const player = Array.isArray(membership.player_profiles)
              ? membership.player_profiles[0]
              : membership.player_profiles

            if (!player) return null

            return {
              id: player.id,
              gamertag: player.gamertag,
              position: player.position,
              avatar_url: player.avatar_url,
              primary_position: membership.primary_position,
              squad_number: membership.squad_number,
            }
          })
          .filter(Boolean) as Member[]

        setMembers(loadedMembers)
      }

      const { data: staffData } = await supabase
        .from('club_staff')
        .select('user_id, role')
        .eq('team_id', teamId)

      setStaff((staffData || []) as Staff[])
      setLoading(false)
    }

    loadProfile()
  }, [teamId])

  if (loading) {
    return (
      <main className="min-h-screen bg-[#080b12] p-8 text-white">
        Loading club profile...
      </main>
    )
  }

  if (!team) {
    return (
      <main className="min-h-screen bg-[#080b12] p-8 text-white">
        {error || 'Club not found.'}
        <div className="mt-4">
          <Link href="/clubs" className="text-blue-400">
            Back to Clubs
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#080b12] px-4 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/clubs"
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          ← Back to Club Directory
        </Link>

        <section className="mt-7 overflow-hidden rounded-2xl border border-white/10 bg-[#101722]">
          <div className="h-2 bg-blue-600" />

          <div className="p-6 md:p-9">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#080b12]">
                {team.badge_url ? (
                  <img
                    src={team.badge_url}
                    alt={`${team.name} badge`}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="text-3xl font-black text-blue-400">
                    {team.abbreviation}
                  </span>
                )}
              </div>

              <div className="flex-1">
                <p className="text-sm font-bold uppercase tracking-widest text-blue-400">
                  NVPL Registered Club
                </p>

                <h1 className="mt-2 text-3xl font-black md:text-4xl">
                  {team.name}
                </h1>

                <p className="mt-2 text-sm text-gray-400">
                  {team.abbreviation} · {team.region}
                </p>

                {team.founded_at && (
                  <p className="mt-2 text-xs text-gray-500">
                    Founded {new Date(team.founded_at).toLocaleDateString()}
                  </p>
                )}
              </div>

              <Link
                href={`/teams/${team.id}/settings`}
                className="rounded-lg border border-white/10 px-4 py-3 text-center text-sm font-semibold transition hover:bg-white/5"
              >
                Team Settings
              </Link>
            </div>

            {team.description && (
              <div className="mt-8 border-t border-white/10 pt-6">
                <h2 className="font-bold">About the Club</h2>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-400">
                  {team.description}
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="mt-7 rounded-2xl border border-white/10 bg-[#101722] p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Club Roster</h2>
              <p className="mt-1 text-sm text-gray-400">
                Current registered players
              </p>
            </div>

            <span className="rounded-full bg-blue-500/10 px-3 py-1 text-sm font-semibold text-blue-400">
              {members.length} Players
            </span>
          </div>

          {members.length === 0 ? (
            <p className="mt-6 text-sm text-gray-500">
              No active players are currently registered.
            </p>
          ) : (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {members.map(player => (
                <Link
                  key={player.id}
                  href={`/player/${player.id}`}
                  className="flex items-center gap-4 rounded-xl border border-white/10 bg-[#080b12] p-4 transition hover:border-blue-500/50"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#182438]">
                    {player.avatar_url ? (
                      <img
                        src={player.avatar_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="font-bold text-blue-400">
                        {player.gamertag.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{player.gamertag}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {player.primary_position || player.position || 'Position not set'}
                      {player.squad_number !== null
                        ? ` · #${player.squad_number}`
                        : ''}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="mt-7 grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-[#101722] p-6">
            <h2 className="text-lg font-bold">EA FC Connection</h2>

            {team.ea_club_id ? (
              <>
                <p className="mt-4 font-semibold text-green-400">
                  EA Club Connected
                </p>
                <p className="mt-2 text-sm text-gray-400">
                  {team.ea_club_name}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Platform: {team.ea_platform}
                </p>
              </>
            ) : (
              <p className="mt-4 text-sm text-gray-500">
                This club has not connected an EA FC club yet.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#101722] p-6">
            <h2 className="text-lg font-bold">Club Staff</h2>

            {staff.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500">
                No additional staff registered.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {staff.map(member => (
                  <div
                    key={member.user_id}
                    className="flex items-center justify-between rounded-lg bg-[#080b12] p-3"
                  >
                    <span className="text-sm text-gray-300">
                      {member.role}
                    </span>
                    <span className="text-xs text-gray-500">
                      Club Staff
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

export default function TeamProfilePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#080b12] p-8 text-white">
          Loading club profile...
        </main>
      }
    >
      <TeamProfileContent />
    </Suspense>
  )
}