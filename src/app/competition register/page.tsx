
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

type Competition = {
  id: string
  name: string
  region: string
  season: string
  division: string
  status: string
  start_date: string | null
  end_date: string | null
}

type Registration = {
  id: string
  competition_id: string
  team_id: string
  status: string
  created_at: string
}

export default function CompetitionRegisterPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [selectedTeams, setSelectedTeams] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  async function loadData() {
    setLoading(true)
    setMessage('')

    const { data: authData, error: authError } = await supabase.auth.getUser()

    if (authError || !authData.user) {
      setMessage('Please log in to manage club registrations.')
      setLoading(false)
      return
    }

    const [teamResult, competitionResult] = await Promise.all([
      supabase
        .from('teams')
        .select('id, name, abbreviation, region')
        .eq('owner_id', authData.user.id)
        .order('name'),
      supabase
        .from('competitions')
        .select('id, name, region, season, division, status, start_date, end_date')
        .eq('status', 'upcoming')
        .order('start_date', { ascending: true })
    ])

    if (teamResult.error) {
      setMessage(teamResult.error.message)
      setLoading(false)
      return
    }

    if (competitionResult.error) {
      setMessage(competitionResult.error.message)
      setLoading(false)
      return
    }

    const myTeams = teamResult.data || []
    setTeams(myTeams)
    setCompetitions(competitionResult.data || [])

    if (myTeams.length > 0) {
      const { data: registrationData, error: registrationError } =
        await supabase
          .from('competition_team_registrations')
          .select('id, competition_id, team_id, status, created_at')
          .in('team_id', myTeams.map(team => team.id))
          .order('created_at', { ascending: false })

      if (registrationError) {
        setMessage(registrationError.message)
      } else {
        setRegistrations(registrationData || [])
      }
    } else {
      setRegistrations([])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  async function registerTeam(competitionId: string) {
    const teamId = selectedTeams[competitionId]

    if (!teamId) {
      setMessage('Select a club first.')
      return
    }

    setBusy(competitionId)
    setMessage('')

    const { error } = await supabase.rpc('register_club_for_competition', {
      p_competition_id: competitionId,
      p_team_id: teamId
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Club successfully registered.')
      await loadData()
    }

    setBusy(null)
  }

  async function withdrawRegistration(registrationId: string) {
    setBusy(registrationId)
    setMessage('')

    const { error } = await supabase.rpc('withdraw_club_from_competition', {
      p_registration_id: registrationId
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Club registration withdrawn.')
      await loadData()
    }

    setBusy(null)
  }

  function getRegistration(competitionId: string, teamId: string) {
    return registrations.find(
      registration =>
        registration.competition_id === competitionId &&
        registration.team_id === teamId
    )
  }

  function formatDate(date: string | null) {
    if (!date) return 'Not announced'
    return new Date(`${date}T00:00:00`).toLocaleDateString('en-AU')
  }

  return (
    <main className="min-h-screen bg-[#080b14] text-white px-5 py-10">
      <div className="max-w-6xl mx-auto">
        <Link
          href="/dashboard"
          className="text-sm text-gray-400 hover:text-white"
        >
          ← Back to dashboard
        </Link>

        <div className="mt-8 mb-8">
          <p className="text-sm font-semibold tracking-[0.25em] text-blue-400">
            NVPL COMPETITIONS
          </p>
          <h1 className="text-4xl font-bold mt-2">
            Club registrations
          </h1>
          <p className="text-gray-400 mt-2">
            Enter your club into an upcoming NVPL competition.
          </p>
        </div>

        {message && (
          <div className="mb-6 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-sm">
            {message}
          </div>
        )}

        {loading ? (
          <p className="text-gray-400">Loading registrations...</p>
        ) : (
          <>
            <section className="mb-10">
              <h2 className="text-2xl font-bold mb-4">
                Your club registrations
              </h2>

              {registrations.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-gray-400">
                  You haven't registered any clubs yet.
                </div>
              ) : (
                <div className="grid gap-3">
                  {registrations.map(registration => {
                    const team = teams.find(t => t.id === registration.team_id)
                    const competition = competitions.find(
                      c => c.id === registration.competition_id
                    )

                    return (
                      <div
                        key={registration.id}
                        className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 flex flex-wrap items-center justify-between gap-4"
                      >
                        <div>
                          <h3 className="font-bold">
                            {team?.name || 'Club'}
                          </h3>
                          <p className="text-sm text-gray-400">
                            {competition?.name || 'Competition'} · {team?.region || ''}
                          </p>
                          <p className="text-xs mt-2 text-gray-500">
                            Status: {registration.status}
                          </p>
                        </div>

                        {registration.status === 'registered' && (
                          <button
                            onClick={() => withdrawRegistration(registration.id)}
                            disabled={busy === registration.id}
                            className="rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                          >
                            {busy === registration.id ? 'Please wait...' : 'Withdraw'}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">
                Upcoming competitions
              </h2>

              {competitions.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-gray-400">
                  There are currently no upcoming competitions.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {competitions.map(competition => {
                    const eligibleTeams = teams.filter(
                      team => team.region === competition.region
                    )

                    return (
                      <div
                        key={competition.id}
                        className="rounded-2xl border border-white/10 bg-white/[0.04] p-6"
                      >
                        <div className="flex justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-widest text-blue-400">
                              {competition.region}
                            </p>
                            <h3 className="text-xl font-bold mt-2">
                              {competition.name}
                            </h3>
                            <p className="text-sm text-gray-400 mt-1">
                              {competition.division} · {competition.season}
                            </p>
                          </div>
                          <span className="text-xs text-green-400">
                            Upcoming
                          </span>
                        </div>

                        <div className="mt-5 text-sm text-gray-400 space-y-1">
                          <p>Starts: {formatDate(competition.start_date)}</p>
                          <p>Ends: {formatDate(competition.end_date)}</p>
                        </div>

                        <div className="mt-5">
                          {eligibleTeams.length === 0 ? (
                            <p className="text-sm text-gray-500">
                              You don't own a club in this competition's region.
                            </p>
                          ) : (
                            <>
                              <label className="block text-sm text-gray-300 mb-2">
                                Select your club
                              </label>

                              <select
                                value={selectedTeams[competition.id] || ''}
                                onChange={event =>
                                  setSelectedTeams(previous => ({
                                    ...previous,
                                    [competition.id]: event.target.value
                                  }))
                                }
                                className="w-full rounded-lg border border-white/10 bg-[#111827] p-3 text-white"
                              >
                                <option value="">Choose a club</option>
                                {eligibleTeams.map(team => (
                                  <option key={team.id} value={team.id}>
                                    {team.name} ({team.abbreviation})
                                  </option>
                                ))}
                              </select>

                              <button
                                onClick={() => registerTeam(competition.id)}
                                disabled={busy === competition.id}
                                className="mt-3 w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-500 disabled:opacity-50"
                              >
                                {busy === competition.id
                                  ? 'Registering...'
                                  : 'Register club'}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  )
}
