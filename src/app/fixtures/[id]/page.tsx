
'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Fixture = {
  id: string
  competition_id: string
  home_team_id: string
  away_team_id: string
  matchweek: number
  kickoff_at: string
  status: string
  home_score: number | null
  away_score: number | null
}

type Team = {
  id: string
  name: string
  abbreviation: string
  owner_id?: string
  ea_club_id?: number | null
  ea_club_name?: string | null
  ea_platform?: string | null
}

type Message = {
  id: string
  user_id: string
  username: string
  body: string
  created_at: string
}

type RescheduleRequest = {
  id: string
  requested_kickoff_at: string
  reason: string
  requester_name: string
  status: string
  review_note: string | null
  created_at: string
}

type EAClub = {
  goals: string
  goalsAgainst: string
  details?: {
    name?: string
    clubId?: number
  }
}

type EAMatch = {
  matchId: string
  timestamp: number
  clubs: Record<string, EAClub>
}

type EAResult = {
  id: string
  match_id: string
  ea_home_club_name: string
  ea_away_club_name: string
  home_score: number
  away_score: number
  created_at: string
  submitted_by: string
}

type LineupPlayer = {
  name: string
  position: string
  number: string
  team: 'home' | 'away'
}

type MatchReport = {
  formation: string
  lineup: LineupPlayer[]
  report_notes: string | null
}

const FORMATIONS = [
  '4-3-3',
  '4-2-3-1',
  '4-1-4-1',
  '4-4-2',
  '3-5-2',
  '3-4-3',
  '5-3-2',
  '5-4-1',
]

function MatchThreadContent() {
  const params = useParams()
  const fixtureId = params.id as string

  const [fixture, setFixture] = useState<Fixture | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [competitionName, setCompetitionName] = useState('Competition')
  const [messages, setMessages] = useState<Message[]>([])
  const [requests, setRequests] = useState<RescheduleRequest[]>([])
  const [eaResult, setEaResult] = useState<EAResult | null>(null)

  const [isAdmin, setIsAdmin] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [canManageReport, setCanManageReport] = useState(false)

  const [messageText, setMessageText] = useState('')
  const [requestedDate, setRequestedDate] = useState('')
  const [reason, setReason] = useState('')
  const [reviewNote, setReviewNote] = useState('')

  const [eaMatches, setEaMatches] = useState<EAMatch[]>([])
  const [selectedMatchId, setSelectedMatchId] = useState('')
  const [searchingEA, setSearchingEA] = useState(false)
  const [submittingEA, setSubmittingEA] = useState(false)

  const [formation, setFormation] = useState('4-3-3')
  const [lineup, setLineup] = useState<LineupPlayer[]>([])
  const [reportNotes, setReportNotes] = useState('')
  const [savingReport, setSavingReport] = useState(false)

  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const homeTeam = teams.find(team => team.id === fixture?.home_team_id)
  const awayTeam = teams.find(team => team.id === fixture?.away_team_id)

  const selectedEAMatch = eaMatches.find(
    match => match.matchId === selectedMatchId
  )

  const selectedEAClubs = selectedEAMatch
    ? Object.entries(selectedEAMatch.clubs || {}).map(([id, club]) => ({
        id,
        name: club.details?.name || `EA Club ${id}`,
        goals: Number(club.goals),
        goalsAgainst: Number(club.goalsAgainst),
      }))
    : []

  const loadThread = useCallback(async () => {
    setError('')

    const [userResult, fixtureResult, adminResult] = await Promise.all([
      supabase.auth.getUser(),
      supabase
        .from('nvpl_fixtures')
        .select('id, competition_id, home_team_id, away_team_id, matchweek, kickoff_at, status, home_score, away_score')
        .eq('id', fixtureId)
        .single(),
      supabase.rpc('nvpl_can_manage_competitions'),
    ])

    const currentUser = userResult.data.user

    if (currentUser) {
      setUserId(currentUser.id)
    }

    const admin = adminResult.data === true
    setIsAdmin(admin)

    if (fixtureResult.error || !fixtureResult.data) {
      setError(fixtureResult.error?.message || 'Fixture not found.')
      setLoading(false)
      return
    }

    const currentFixture = fixtureResult.data as Fixture
    setFixture(currentFixture)

    const [
      teamResult,
      competitionResult,
      threadResult,
      eaResultQuery,
    ] = await Promise.all([
      supabase
        .from('teams')
        .select('id, name, abbreviation, owner_id, ea_club_id, ea_club_name, ea_platform')
        .in('id', [
          currentFixture.home_team_id,
          currentFixture.away_team_id,
        ]),
      supabase
        .from('competitions')
        .select('name')
        .eq('id', currentFixture.competition_id)
        .maybeSingle(),
      supabase
        .from('nvpl_match_threads')
        .select('id')
        .eq('fixture_id', fixtureId)
        .maybeSingle(),
      supabase
        .from('nvpl_fixture_ea_results')
        .select('id, match_id, ea_home_club_name, ea_away_club_name, home_score, away_score, created_at, submitted_by')
        .eq('fixture_id', fixtureId)
        .maybeSingle(),
    ])

    if (teamResult.error) {
      setError(teamResult.error.message)
    } else {
      const loadedTeams = (teamResult.data || []) as Team[]
      setTeams(loadedTeams)

      if (currentUser) {
        const teamIds = loadedTeams.map(team => team.id)

        const { data: staff } = await supabase
          .from('club_staff')
          .select('team_id')
          .eq('user_id', currentUser.id)
          .in('team_id', teamIds)

        const isOwner = loadedTeams.some(
          team => team.owner_id === currentUser.id
        )

        setCanManageReport(
          admin || isOwner || (staff?.length || 0) > 0
        )
      } else {
        setCanManageReport(false)
      }
    }

    if (competitionResult.data?.name) {
      setCompetitionName(competitionResult.data.name)
    }

    setEaResult(
      eaResultQuery.data
        ? (eaResultQuery.data as EAResult)
        : null
    )

    if (threadResult.error || !threadResult.data) {
      setError(
        threadResult.error?.message ||
        'The match thread has not been created.'
      )
      setLoading(false)
      return
    }

    const [messageResult, requestResult, reportResult] =
      await Promise.all([
        supabase
          .from('nvpl_match_messages')
          .select('id, user_id, username, body, created_at')
          .eq('thread_id', threadResult.data.id)
          .order('created_at', { ascending: true }),
        supabase
          .from('nvpl_reschedule_requests')
          .select('id, requested_kickoff_at, reason, requester_name, status, review_note, created_at')
          .eq('fixture_id', fixtureId)
          .order('created_at', { ascending: false }),
        supabase
          .from('nvpl_fixture_match_reports')
          .select('formation, lineup, report_notes')
          .eq('fixture_id', fixtureId)
          .maybeSingle(),
      ])

    if (messageResult.error) {
      setError(messageResult.error.message)
    } else {
      setMessages(messageResult.data || [])
    }

    if (requestResult.error) {
      setError(requestResult.error.message)
    } else {
      setRequests(requestResult.data || [])
    }

    if (reportResult.error) {
      setError(reportResult.error.message)
    } else if (reportResult.data) {
      const report = reportResult.data as MatchReport
      setFormation(report.formation || '4-3-3')
      setLineup(report.lineup || [])
      setReportNotes(report.report_notes || '')
    }

    setLoading(false)
  }, [fixtureId])

  useEffect(() => {
    loadThread()
  }, [loadThread])

  function teamName(id: string) {
    const team = teams.find(team => team.id === id)
    return team
      ? `${team.name} (${team.abbreviation})`
      : 'Unknown club'
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleString('en-AU', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  }

  function getMatchClubs(match: EAMatch) {
    return Object.entries(match.clubs || {}).map(([id, club]) => ({
      id,
      name: club.details?.name || `EA Club ${id}`,
      goals: Number(club.goals),
      goalsAgainst: Number(club.goalsAgainst),
    }))
  }

  async function searchEAMatches() {
    if (!homeTeam?.ea_club_id || !awayTeam?.ea_club_id) {
      setError(
        'Both teams must link their EA clubs in Team Settings first.'
      )
      return
    }

    if (
      !homeTeam.ea_platform ||
      homeTeam.ea_platform !== awayTeam.ea_platform
    ) {
      setError('Both teams must use the same EA platform.')
      return
    }

    setSearchingEA(true)
    setError('')
    setNotice('')
    setEaMatches([])
    setSelectedMatchId('')

    try {
      const query = new URLSearchParams({
        mode: 'fixtureMatches',
        homeClubId: String(homeTeam.ea_club_id),
        awayClubId: String(awayTeam.ea_club_id),
        platform: homeTeam.ea_platform,
      })

      const response = await fetch(`/api/eafc?${query}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Could not load EA matches.')
      }

      const matches = Array.isArray(data.matches)
        ? data.matches as EAMatch[]
        : []

      setEaMatches(matches)

      if (matches.length === 0) {
        setNotice(
          'No shared EA matches were found in the recent history of both clubs.'
        )
      } else {
        setSelectedMatchId(matches[0].matchId)
        setNotice(`Found ${matches.length} matching EA games.`)
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'EA search failed.'
      )
    } finally {
      setSearchingEA(false)
    }
  }

  async function submitEAResult() {
    if (!selectedEAMatch || selectedEAClubs.length !== 2) {
      setError('Select a valid EA match first.')
      return
    }

    const eaHome = selectedEAClubs.find(
      club => club.id === String(homeTeam?.ea_club_id)
    )

    const eaAway = selectedEAClubs.find(
      club => club.id === String(awayTeam?.ea_club_id)
    )

    if (!eaHome || !eaAway) {
      setError(
        'The selected match does not contain both linked EA clubs.'
      )
      return
    }

    if (
      !Number.isFinite(eaHome.goals) ||
      !Number.isFinite(eaAway.goals)
    ) {
      setError('The selected EA match does not contain a valid score.')
      return
    }

    const confirmed = window.confirm(
      `Submit this EA result?\n\n${teamName(fixture!.home_team_id)}: ${eaHome.goals}\n${teamName(fixture!.away_team_id)}: ${eaAway.goals}\n\nAdmins can review disputes.`
    )

    if (!confirmed) return

    setSubmittingEA(true)
    setError('')
    setNotice('')

    const { error } = await supabase.rpc(
      'nvpl_submit_ea_fixture_result',
      {
        p_fixture_id: fixtureId,
        p_match_id: selectedEAMatch.matchId,
        p_ea_home_club_id: eaHome.id,
        p_ea_away_club_id: eaAway.id,
        p_ea_home_club_name: eaHome.name,
        p_ea_away_club_name: eaAway.name,
        p_home_score: eaHome.goals,
        p_away_score: eaAway.goals,
        p_raw_match: selectedEAMatch,
      }
    )

    if (error) {
      setError(error.message)
    } else {
      setNotice(
        'EA result submitted. Your existing result workflow has been updated.'
      )
      setEaMatches([])
      setSelectedMatchId('')
      await loadThread()
    }

    setSubmittingEA(false)
  }

  function addPlayer(team: 'home' | 'away') {
    setLineup(current => [
      ...current,
      {
        name: '',
        position: '',
        number: '',
        team,
      },
    ])
  }

  function updatePlayer(
    index: number,
    field: keyof LineupPlayer,
    value: string
  ) {
    setLineup(current =>
      current.map((player, i) =>
        i === index
          ? { ...player, [field]: value }
          : player
      )
    )
  }

  function removePlayer(index: number) {
    setLineup(current =>
      current.filter((_, i) => i !== index)
    )
  }

  async function saveReport() {
    if (!canManageReport) {
      setError('You do not have permission to edit this report.')
      return
    }

    setSavingReport(true)
    setError('')
    setNotice('')

    const { error } = await supabase.rpc(
      'nvpl_save_fixture_match_report',
      {
        p_fixture_id: fixtureId,
        p_formation: formation,
        p_lineup: lineup,
        p_player_stats: [],
        p_report_notes: reportNotes.trim() || null,
      }
    )

    if (error) {
      setError(error.message)
    } else {
      setNotice('Match report saved successfully.')
    }

    setSavingReport(false)
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!messageText.trim()) return

    setSending(true)
    setError('')
    setNotice('')

    const { error } = await supabase.rpc(
      'nvpl_send_match_message',
      {
        p_fixture_id: fixtureId,
        p_body: messageText.trim(),
      }
    )

    if (error) {
      setError(error.message)
    } else {
      setMessageText('')
      await loadThread()
    }

    setSending(false)
  }

  async function requestReschedule(e: React.FormEvent) {
    e.preventDefault()

    if (!requestedDate) {
      setError('Choose a proposed kickoff time.')
      return
    }

    setRequesting(true)
    setError('')
    setNotice('')

    const { error } = await supabase.rpc(
      'nvpl_request_fixture_reschedule',
      {
        p_fixture_id: fixtureId,
        p_requested_kickoff_at: new Date(requestedDate).toISOString(),
        p_reason: reason.trim(),
      }
    )

    if (error) {
      setError(error.message)
    } else {
      setRequestedDate('')
      setReason('')
      setNotice('Reschedule request submitted for admin review.')
      await loadThread()
    }

    setRequesting(false)
  }

  async function reviewRequest(
    requestId: string,
    approved: boolean
  ) {
    setReviewing(true)
    setError('')
    setNotice('')

    const { error } = await supabase.rpc(
      'nvpl_review_reschedule_request',
      {
        p_request_id: requestId,
        p_approved: approved,
        p_review_note: reviewNote.trim(),
      }
    )

    if (error) {
      setError(error.message)
    } else {
      setReviewNote('')
      setNotice(
        approved
          ? 'Reschedule approved. The official kickoff has been updated.'
          : 'Reschedule request rejected.'
      )
      await loadThread()
    }

    setReviewing(false)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#080b14] p-8 text-white">
        <p className="text-gray-400">Loading match thread...</p>
      </main>
    )
  }

  if (!fixture) {
    return (
      <main className="min-h-screen bg-[#080b14] p-8 text-white">
        <p className="text-red-400">{error || 'Fixture not found.'}</p>
        <Link href="/fixtures" className="mt-4 inline-block text-blue-400">
          Back to fixtures
        </Link>
      </main>
    )
  }

  const pendingRequest = requests.some(
    request => request.status === 'pending'
  )

  return (
    <main className="min-h-screen bg-[#080b14] px-5 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/fixtures"
          className="text-sm text-gray-400 hover:text-white"
        >
          ← Back to fixtures
        </Link>

        <div className="mb-6 mt-8">
          <p className="text-sm font-semibold tracking-[0.2em] text-blue-400">
            {competitionName}
          </p>
          <h1 className="mt-2 text-3xl font-bold">Match thread</h1>
          <p className="mt-1 text-sm text-gray-400">
            Matchweek {fixture.matchweek}
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {notice && (
          <div className="mb-5 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-300">
            {notice}
          </div>
        )}

        {/* OFFICIAL FIXTURE */}
        <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <div className="mb-4 text-xs uppercase tracking-wider text-blue-400">
            Official scheduled kickoff
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="text-right">
              <p className="text-lg font-bold">
                {teamName(fixture.home_team_id)}
              </p>
              <p className="text-xs text-gray-500">Home</p>
            </div>

            <div className="rounded-xl bg-black/30 px-4 py-3 text-center">
              {fixture.status === 'completed' &&
              fixture.home_score !== null &&
              fixture.away_score !== null ? (
                <p className="text-2xl font-bold">
                  {fixture.home_score} - {fixture.away_score}
                </p>
              ) : (
                <p className="font-bold text-gray-400">VS</p>
              )}
            </div>

            <div>
              <p className="text-lg font-bold">
                {teamName(fixture.away_team_id)}
              </p>
              <p className="text-xs text-gray-500">Away</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap justify-between gap-3 border-t border-white/10 pt-4">
            <div>
              <p className="text-xs text-gray-500">Official kickoff</p>
              <p className="font-semibold">
                {formatDate(fixture.kickoff_at)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Fixture status</p>
              <p className="text-sm font-semibold uppercase">
                {fixture.status}
              </p>
            </div>
          </div>
        </section>

        {/* EA FC MATCH INTEGRATION */}
        <section className="mb-6 rounded-2xl border border-blue-500/20 bg-blue-500/[0.05] p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                EA FC integration
              </p>
              <h2 className="mt-1 text-xl font-bold">EA match connection</h2>
            </div>

            {eaResult && (
              <span className="rounded-full border border-green-500/20 bg-green-500/15 px-3 py-1 text-xs font-semibold text-green-400">
                Result submitted
              </span>
            )}
          </div>

          {eaResult ? (
            <div className="rounded-xl border border-white/10 bg-black/30 p-5">
              <p className="mb-3 text-xs text-gray-500">
                Linked EA match · ID {eaResult.match_id}
              </p>

              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className="text-right">
                  <p className="font-semibold">
                    {teamName(fixture.home_team_id)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {eaResult.ea_home_club_name}
                  </p>
                </div>

                <p className="text-2xl font-bold tabular-nums">
                  {eaResult.home_score} - {eaResult.away_score}
                </p>

                <div>
                  <p className="font-semibold">
                    {teamName(fixture.away_team_id)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {eaResult.ea_away_club_name}
                  </p>
                </div>
              </div>

              <p className="mt-4 text-xs text-gray-500">
                Submitted {formatDate(eaResult.created_at)}.
                Admins can review disputes.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-5 grid gap-3 sm:grid-cols-2">
                {[homeTeam, awayTeam].map((team, index) => (
                  <div
                    key={team?.id || index}
                    className="rounded-xl border border-white/10 bg-black/20 p-4"
                  >
                    <p className="text-xs text-gray-500">
                      {index === 0 ? 'HOME TEAM' : 'AWAY TEAM'}
                    </p>
                    <p className="mt-1 font-semibold">
                      {team?.name || 'Unknown team'}
                    </p>
                    <p className="mt-1 text-sm text-gray-400">
                      {team?.ea_club_name || 'EA club not linked'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {team?.ea_club_id
                        ? `EA ID: ${team.ea_club_id}`
                        : 'No linked EA ID'}
                    </p>
                  </div>
                ))}
              </div>

              {fixture.status === 'completed' ? (
                <p className="text-sm text-gray-400">
                  This fixture is completed and does not have an EA result linked.
                </p>
              ) : (
                <>
                  <p className="mb-4 text-sm text-gray-400">
                    NVPL will compare the recent match history of both linked EA clubs
                    to find games involving both teams.
                  </p>

                  <button
                    type="button"
                    onClick={searchEAMatches}
                    disabled={searchingEA || !canManageReport}
                    className="w-full rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50"
                  >
                    {searchingEA
                      ? 'Searching both EA clubs...'
                      : 'Find matching EA games'}
                  </button>

                  {!canManageReport && (
                    <p className="mt-2 text-xs text-gray-500">
                      Team managers or admins can search and submit EA results.
                    </p>
                  )}

                  {eaMatches.length > 0 && (
                    <div className="mt-6 space-y-3 border-t border-white/10 pt-5">
                      <h3 className="font-semibold">Matching EA games</h3>

                      {eaMatches.map(match => {
                        const clubs = getMatchClubs(match)
                        const home = clubs.find(
                          club => club.id === String(homeTeam?.ea_club_id)
                        )
                        const away = clubs.find(
                          club => club.id === String(awayTeam?.ea_club_id)
                        )

                        if (!home || !away) return null

                        return (
                          <label
                            key={match.matchId}
                            className={`block cursor-pointer rounded-xl border p-4 ${
                              selectedMatchId === match.matchId
                                ? 'border-blue-500 bg-blue-500/10'
                                : 'border-white/10 bg-black/20'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="radio"
                                name="ea-match"
                                checked={selectedMatchId === match.matchId}
                                onChange={() =>
                                  setSelectedMatchId(match.matchId)
                                }
                              />

                              <div className="grid flex-1 grid-cols-[1fr_auto_1fr] items-center gap-2">
                                <p className="text-sm font-semibold">
                                  {home.name}
                                </p>
                                <p className="text-lg font-bold tabular-nums">
                                  {home.goals} - {away.goals}
                                </p>
                                <p className="text-right text-sm font-semibold">
                                  {away.name}
                                </p>
                              </div>
                            </div>

                            <p className="ml-6 mt-2 text-xs text-gray-500">
                              Match ID: {match.matchId}
                              {match.timestamp
                                ? ` · ${formatDate(new Date(match.timestamp * 1000).toISOString())}`
                                : ''}
                            </p>
                          </label>
                        )
                      })}

                      <button
                        type="button"
                        onClick={submitEAResult}
                        disabled={!selectedEAMatch || submittingEA || !canManageReport}
                        className="w-full rounded-lg bg-green-600 px-5 py-3 text-sm font-semibold hover:bg-green-500 disabled:opacity-50"
                      >
                        {submittingEA
                          ? 'Submitting result...'
                          : 'Confirm and submit EA result'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </section>

        {/* FORMATION AND LINEUP REPORT */}
        <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">
              Match report
            </p>
            <h2 className="mt-1 text-xl font-bold">Formation & lineup</h2>
            <p className="mt-1 text-sm text-gray-400">
              Record the formation and players for both teams.
            </p>
          </div>

          <label className="block text-sm text-gray-300">
            Formation
            <select
              value={formation}
              onChange={e => setFormation(e.target.value)}
              disabled={!canManageReport}
              className="mt-2 w-full rounded-lg border border-white/10 bg-[#101827] p-3 text-white"
            >
              {FORMATIONS.map(value => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          {(['home', 'away'] as const).map(side => (
            <div key={side} className="mt-6 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-semibold">
                  {side === 'home'
                    ? teamName(fixture.home_team_id)
                    : teamName(fixture.away_team_id)}
                </h3>

                <button
                  type="button"
                  onClick={() => addPlayer(side)}
                  disabled={!canManageReport}
                  className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20 disabled:opacity-50"
                >
                  + Add player
                </button>
              </div>

              {lineup.filter(player => player.team === side).length === 0 && (
                <p className="rounded-lg bg-black/20 p-3 text-sm text-gray-500">
                  No players added yet.
                </p>
              )}

              {lineup.map((player, index) => {
                if (player.team !== side) return null

                return (
                  <div
                    key={`${side}-${index}`}
                    className="grid gap-2 rounded-lg border border-white/10 bg-black/20 p-3 sm:grid-cols-[1fr_110px_75px_auto]"
                  >
                    <input
                      value={player.name}
                      onChange={e =>
                        updatePlayer(index, 'name', e.target.value)
                      }
                      disabled={!canManageReport}
                      placeholder="Player name"
                      className="min-w-0 rounded-lg bg-white/5 p-2 text-sm"
                    />

                    <input
                      value={player.position}
                      onChange={e =>
                        updatePlayer(index, 'position', e.target.value)
                      }
                      disabled={!canManageReport}
                      placeholder="Position"
                      className="rounded-lg bg-white/5 p-2 text-sm"
                    />

                    <input
                      value={player.number}
                      onChange={e =>
                        updatePlayer(index, 'number', e.target.value)
                      }
                      disabled={!canManageReport}
                      placeholder="Number"
                      className="rounded-lg bg-white/5 p-2 text-sm"
                    />

                    <button
                      type="button"
                      onClick={() => removePlayer(index)}
                      disabled={!canManageReport}
                      className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                )
              })}
            </div>
          ))}

          <label className="mt-6 block text-sm text-gray-300">
            Match notes
            <textarea
              value={reportNotes}
              onChange={e => setReportNotes(e.target.value)}
              disabled={!canManageReport}
              maxLength={3000}
              rows={4}
              placeholder="Add notes about the match..."
              className="mt-2 w-full rounded-lg border border-white/10 bg-[#101827] p-3 text-white"
            />
          </label>

          <button
            type="button"
            onClick={saveReport}
            disabled={!canManageReport || savingReport}
            className="mt-5 w-full rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50"
          >
            {savingReport ? 'Saving report...' : 'Save match report'}
          </button>
        </section>

        {/* RESCHEDULE FORM */}
        {fixture.status === 'scheduled' && (
          <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-xl font-bold">Request a reschedule</h2>
            <p className="mb-5 mt-1 text-sm text-gray-400">
              The current kickoff remains official until an NVPL admin approves a change.
            </p>

            {pendingRequest ? (
              <p className="text-sm text-yellow-300">
                A reschedule request is already awaiting admin review.
              </p>
            ) : (
              <form onSubmit={requestReschedule} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm text-gray-300">
                    Proposed new kickoff
                  </label>
                  <input
                    type="datetime-local"
                    value={requestedDate}
                    onChange={e => setRequestedDate(e.target.value)}
                    required
                    className="w-full rounded-lg border border-white/10 bg-[#101827] p-3 text-white"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-gray-300">
                    Reason for request
                  </label>
                  <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    maxLength={1000}
                    rows={3}
                    placeholder="Explain why the fixture needs to be moved..."
                    className="w-full rounded-lg border border-white/10 bg-[#101827] p-3 text-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={requesting}
                  className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50"
                >
                  {requesting ? 'Submitting...' : 'Submit reschedule request'}
                </button>
              </form>
            )}
          </section>
        )}

        {/* RESCHEDULE REQUESTS */}
        <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="mb-4 text-xl font-bold">Reschedule requests</h2>

          {requests.length === 0 ? (
            <p className="text-sm text-gray-500">
              No reschedule requests have been made.
            </p>
          ) : (
            <div className="space-y-4">
              {requests.map(request => (
                <div
                  key={request.id}
                  className="rounded-xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <p className="font-semibold">
                      Requested by {request.requester_name}
                    </p>
                    <span className={`text-xs font-bold uppercase ${
                      request.status === 'approved'
                        ? 'text-green-400'
                        : request.status === 'rejected'
                          ? 'text-red-400'
                          : 'text-yellow-400'
                    }`}>
                      {request.status}
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-gray-300">
                    Proposed kickoff: {formatDate(request.requested_kickoff_at)}
                  </p>

                  {request.reason && (
                    <p className="mt-2 text-sm text-gray-400">
                      Reason: {request.reason}
                    </p>
                  )}

                  {request.review_note && (
                    <p className="mt-2 text-sm text-gray-400">
                      Admin note: {request.review_note}
                    </p>
                  )}

                  {isAdmin && request.status === 'pending' && (
                    <div className="mt-4 border-t border-white/10 pt-4">
                      <textarea
                        value={reviewNote}
                        onChange={e => setReviewNote(e.target.value)}
                        rows={2}
                        placeholder="Optional admin review note..."
                        className="mb-3 w-full rounded-lg border border-white/10 bg-[#101827] p-3 text-sm text-white"
                      />

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={reviewing}
                          onClick={() => reviewRequest(request.id, true)}
                          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold hover:bg-green-500 disabled:opacity-50"
                        >
                          Approve
                        </button>

                        <button
                          type="button"
                          disabled={reviewing}
                          onClick={() => reviewRequest(request.id, false)}
                          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-500 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* MANAGER DISCUSSION */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-xl font-bold">Manager discussion</h2>
          <p className="mb-5 mt-1 text-sm text-gray-400">
            Keep all match arrangements and communication in this thread.
          </p>

          {messages.length === 0 ? (
            <div className="rounded-xl bg-black/20 p-6 text-center text-sm text-gray-500">
              No messages yet. Start the discussion.
            </div>
          ) : (
            <div className="mb-6 space-y-4">
              {messages.map(message => (
                <div
                  key={message.id}
                  className={`rounded-xl border p-4 ${
                    message.user_id === userId
                      ? 'border-blue-500/20 bg-blue-600/15'
                      : 'border-white/5 bg-black/20'
                  }`}
                >
                  <div className="mb-2 flex flex-wrap justify-between gap-2">
                    <p className="text-sm font-semibold">
                      {message.username}
                      {message.user_id === userId && (
                        <span className="ml-2 font-normal text-blue-400">
                          You
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(message.created_at)}
                    </p>
                  </div>
                  <p className="break-words whitespace-pre-wrap text-sm text-gray-200">
                    {message.body}
                  </p>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={sendMessage} className="space-y-3">
            <textarea
              value={messageText}
              onChange={e => setMessageText(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Write a message to the opposing manager..."
              className="w-full rounded-lg border border-white/10 bg-[#101827] p-3 text-white"
            />

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500">
                {messageText.length}/2000
              </p>
              <button
                type="submit"
                disabled={sending || !messageText.trim()}
                className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50"
              >
                {sending ? 'Sending...' : 'Send message'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  )
}

export default function MatchThreadPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#080b14] p-8 text-white">
          <p className="text-gray-400">Loading match thread...</p>
        </main>
      }
    >
      <MatchThreadContent />
    </Suspense>
  )
}
