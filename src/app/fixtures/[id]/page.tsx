
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

  const [messageText, setMessageText] = useState('')
  const [requestedDate, setRequestedDate] = useState('')
  const [reason, setReason] = useState('')
  const [reviewNote, setReviewNote] = useState('')

  const [eaClubName, setEaClubName] = useState('')
  const [eaPlatform, setEaPlatform] = useState('common-gen5')
  const [eaMatches, setEaMatches] = useState<EAMatch[]>([])
  const [selectedMatchId, setSelectedMatchId] = useState('')
  const [selectedEaHomeId, setSelectedEaHomeId] = useState('')
  const [searchingEA, setSearchingEA] = useState(false)
  const [submittingEA, setSubmittingEA] = useState(false)

  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadThread = useCallback(async () => {
    setError('')

    const [userResult, fixtureResult, adminResult] = await Promise.all([
      supabase.auth.getUser(),
      supabase
        .from('nvpl_fixtures')
        .select('id, competition_id, home_team_id, away_team_id, matchweek, kickoff_at, status, home_score, away_score')
        .eq('id', fixtureId)
        .single(),
      supabase.rpc('nvpl_can_manage_competitions')
    ])

    if (userResult.data.user) {
      setUserId(userResult.data.user.id)
    }

    setIsAdmin(adminResult.data === true)

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
      eaResultQuery
    ] = await Promise.all([
      supabase
        .from('teams')
        .select('id, name, abbreviation')
        .in('id', [currentFixture.home_team_id, currentFixture.away_team_id]),
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
        .maybeSingle()
    ])

    if (teamResult.error) {
      setError(teamResult.error.message)
    } else {
      setTeams(teamResult.data || [])
    }

    if (competitionResult.data?.name) {
      setCompetitionName(competitionResult.data.name)
    }

    if (eaResultQuery.data) {
      setEaResult(eaResultQuery.data as EAResult)
    } else {
      setEaResult(null)
    }

    if (threadResult.error || !threadResult.data) {
      setError(threadResult.error?.message || 'The match thread has not been created.')
      setLoading(false)
      return
    }

    const [messageResult, requestResult] = await Promise.all([
      supabase
        .from('nvpl_match_messages')
        .select('id, user_id, username, body, created_at')
        .eq('thread_id', threadResult.data.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('nvpl_reschedule_requests')
        .select('id, requested_kickoff_at, reason, requester_name, status, review_note, created_at')
        .eq('fixture_id', fixtureId)
        .order('created_at', { ascending: false })
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

    setLoading(false)
  }, [fixtureId])

  useEffect(() => {
    loadThread()
  }, [loadThread])

  function teamName(id: string) {
    const team = teams.find(team => team.id === id)
    return team ? `${team.name} (${team.abbreviation})` : 'Unknown club'
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleString('en-AU', {
      dateStyle: 'medium',
      timeStyle: 'short'
    })
  }

  function getMatchClubs(match: EAMatch) {
    return Object.entries(match.clubs || {}).map(([id, club]) => ({
      id,
      name: club.details?.name || `EA Club ${id}`,
      goals: Number(club.goals),
      goalsAgainst: Number(club.goalsAgainst)
    }))
  }

  const selectedEAMatch = eaMatches.find(
    match => match.matchId === selectedMatchId
  )

  const selectedEAClubs = selectedEAMatch
    ? getMatchClubs(selectedEAMatch)
    : []

  async function searchEAMatches(e: React.FormEvent) {
    e.preventDefault()

    if (!eaClubName.trim()) {
      setError('Enter your EA club name.')
      return
    }

    setSearchingEA(true)
    setError('')
    setNotice('')
    setEaMatches([])
    setSelectedMatchId('')
    setSelectedEaHomeId('')

    try {
      const response = await fetch(
        `/api/eafc?name=${encodeURIComponent(eaClubName.trim())}&platform=${encodeURIComponent(eaPlatform)}`
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Could not load EA matches.')
      }

      const matches = Array.isArray(data.matches)
        ? data.matches as EAMatch[]
        : []

      if (matches.length === 0) {
        throw new Error('No recent EA matches were found for that club.')
      }

      setEaMatches(matches)
      setSelectedMatchId(matches[0].matchId)

      const firstMatchClubs = getMatchClubs(matches[0])
      if (firstMatchClubs.length > 0) {
        setSelectedEaHomeId(firstMatchClubs[0].id)
      }

      setNotice(`Loaded ${matches.length} recent EA matches.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'EA search failed.')
    } finally {
      setSearchingEA(false)
    }
  }

  async function submitEAResult() {
    if (!selectedEAMatch || selectedEAClubs.length !== 2) {
      setError('Select a valid EA match first.')
      return
    }

    if (!selectedEaHomeId) {
      setError('Choose which EA club represents the NVPL home team.')
      return
    }

    const eaHome = selectedEAClubs.find(
      club => club.id === selectedEaHomeId
    )

    const eaAway = selectedEAClubs.find(
      club => club.id !== selectedEaHomeId
    )

    if (
      !eaHome ||
      !eaAway ||
      !Number.isFinite(eaHome.goals) ||
      !Number.isFinite(eaAway.goals)
    ) {
      setError('The selected EA match does not contain a valid score.')
      return
    }

    const confirmed = window.confirm(
      `Submit this result?\n\n${teamName(fixture!.home_team_id)}: ${eaHome.goals}\n${teamName(fixture!.away_team_id)}: ${eaAway.goals}\n\nAdmins can review any disputes.`
    )

    if (!confirmed) return

    setSubmittingEA(true)
    setError('')
    setNotice('')

    const { error } = await supabase.rpc('nvpl_submit_ea_fixture_result', {
      p_fixture_id: fixtureId,
      p_match_id: selectedEAMatch.matchId,
      p_ea_home_club_id: eaHome.id,
      p_ea_away_club_id: eaAway.id,
      p_ea_home_club_name: eaHome.name,
      p_ea_away_club_name: eaAway.name,
      p_home_score: eaHome.goals,
      p_away_score: eaAway.goals,
      p_raw_match: selectedEAMatch
    })

    if (error) {
      setError(error.message)
    } else {
      setNotice('EA result submitted and the fixture score has been updated.')
      setEaMatches([])
      setSelectedMatchId('')
      await loadThread()
    }

    setSubmittingEA(false)
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!messageText.trim()) return

    setSending(true)
    setError('')
    setNotice('')

    const { error } = await supabase.rpc('nvpl_send_match_message', {
      p_fixture_id: fixtureId,
      p_body: messageText.trim()
    })

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

    const { error } = await supabase.rpc('nvpl_request_fixture_reschedule', {
      p_fixture_id: fixtureId,
      p_requested_kickoff_at: new Date(requestedDate).toISOString(),
      p_reason: reason.trim()
    })

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

  async function reviewRequest(requestId: string, approved: boolean) {
    setReviewing(true)
    setError('')
    setNotice('')

    const { error } = await supabase.rpc('nvpl_review_reschedule_request', {
      p_request_id: requestId,
      p_approved: approved,
      p_review_note: reviewNote.trim()
    })

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
      <main className="min-h-screen bg-[#080b14] text-white p-8">
        <p className="text-gray-400">Loading match thread...</p>
      </main>
    )
  }

  if (!fixture) {
    return (
      <main className="min-h-screen bg-[#080b14] text-white p-8">
        <p className="text-red-400">{error || 'Fixture not found.'}</p>
        <Link href="/fixtures" className="text-blue-400 mt-4 inline-block">
          Back to fixtures
        </Link>
      </main>
    )
  }

  const pendingRequest = requests.some(request => request.status === 'pending')

  return (
    <main className="min-h-screen bg-[#080b14] text-white px-5 py-10">
      <div className="max-w-4xl mx-auto">
        <Link href="/fixtures" className="text-sm text-gray-400 hover:text-white">
          ← Back to fixtures
        </Link>

        <div className="mt-8 mb-6">
          <p className="text-sm tracking-[0.2em] text-blue-400 font-semibold">
            {competitionName}
          </p>
          <h1 className="text-3xl font-bold mt-2">Match thread</h1>
          <p className="text-sm text-gray-400 mt-1">
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

        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 mb-6">
          <div className="text-xs uppercase tracking-wider text-blue-400 mb-4">
            Official scheduled kickoff
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="text-right">
              <p className="font-bold text-lg">{teamName(fixture.home_team_id)}</p>
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
              <p className="font-bold text-lg">{teamName(fixture.away_team_id)}</p>
              <p className="text-xs text-gray-500">Away</p>
            </div>
          </div>

          <div className="mt-6 border-t border-white/10 pt-4 flex flex-wrap justify-between gap-3">
            <div>
              <p className="text-xs text-gray-500">Official kickoff</p>
              <p className="font-semibold">{formatDate(fixture.kickoff_at)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Fixture status</p>
              <p className="font-semibold uppercase text-sm">{fixture.status}</p>
            </div>
          </div>
        </section>

        {/* EA FC RESULT LINKING */}
        <section className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.05] p-6 mb-6">
          <div className="flex flex-wrap justify-between gap-3 items-center mb-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-blue-400 font-semibold">
                EA FC integration
              </p>
              <h2 className="text-xl font-bold mt-1">Link EA match</h2>
            </div>

            {eaResult && (
              <span className="rounded-full bg-green-500/15 border border-green-500/20 px-3 py-1 text-xs font-semibold text-green-400">
                Result submitted
              </span>
            )}
          </div>

          {eaResult ? (
            <div className="rounded-xl bg-black/30 border border-white/10 p-5">
              <p className="text-xs text-gray-500 mb-3">
                Linked EA match · ID {eaResult.match_id}
              </p>

              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className="text-right">
                  <p className="font-semibold">{teamName(fixture.home_team_id)}</p>
                  <p className="text-xs text-gray-400">{eaResult.ea_home_club_name}</p>
                </div>

                <p className="text-2xl font-bold tabular-nums">
                  {eaResult.home_score} - {eaResult.away_score}
                </p>

                <div>
                  <p className="font-semibold">{teamName(fixture.away_team_id)}</p>
                  <p className="text-xs text-gray-400">{eaResult.ea_away_club_name}</p>
                </div>
              </div>

              <p className="text-xs text-gray-500 mt-4">
                Submitted {formatDate(eaResult.created_at)}. Admins can review any disputes.
              </p>
            </div>
          ) : fixture.status === 'completed' ? (
            <p className="text-sm text-gray-400">
              This fixture is already marked as completed. An EA match has not been linked.
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-400 mb-5">
                Search using either team's EA club name, select the correct match,
                then submit the score for this NVPL fixture.
              </p>

              <form onSubmit={searchEAMatches} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-2">
                    EA club name
                  </label>
                  <input
                    value={eaClubName}
                    onChange={e => setEaClubName(e.target.value)}
                    maxLength={60}
                    placeholder="Enter your EA Pro Clubs name..."
                    className="w-full rounded-lg border border-white/10 bg-[#101827] p-3 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-2">
                    EA platform
                  </label>
                  <select
                    value={eaPlatform}
                    onChange={e => setEaPlatform(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-[#101827] p-3 text-white"
                  >
                    <option value="common-gen5">PlayStation 5 / Xbox Series X|S</option>
                    <option value="nx">Nintendo Switch</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={searchingEA || !eaClubName.trim()}
                  className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-5 py-3 text-sm font-semibold"
                >
                  {searchingEA ? 'Searching EA...' : 'Load recent EA matches'}
                </button>
              </form>

              {eaMatches.length > 0 && (
                <div className="mt-6 border-t border-white/10 pt-5">
                  <h3 className="font-semibold mb-3">Select the correct match</h3>

                  <div className="space-y-3">
                    {eaMatches.map(match => {
                      const clubs = getMatchClubs(match)

                      return (
                        <label
                          key={match.matchId}
                          className={`block rounded-xl border p-4 cursor-pointer ${
                            selectedMatchId === match.matchId
                              ? 'border-blue-500 bg-blue-500/10'
                              : 'border-white/10 bg-black/20'
                          }`}
                        >
                          <div className="flex gap-3 items-start">
                            <input
                              type="radio"
                              name="ea-match"
                              value={match.matchId}
                              checked={selectedMatchId === match.matchId}
                              onChange={() => {
                                setSelectedMatchId(match.matchId)
                                const firstClub = getMatchClubs(match)[0]
                                setSelectedEaHomeId(firstClub?.id || '')
                              }}
                              className="mt-1"
                            />

                            <div className="flex-1">
                              <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                                <p className="font-semibold text-sm">
                                  {clubs[0]?.name || 'Unknown club'}
                                </p>
                                <p className="font-bold text-lg tabular-nums">
                                  {clubs[0]?.goals ?? '?'} - {clubs[1]?.goals ?? '?'}
                                </p>
                                <p className="font-semibold text-sm text-right">
                                  {clubs[1]?.name || 'Unknown club'}
                                </p>
                              </div>

                              <p className="text-xs text-gray-500 mt-2">
                                Match ID: {match.matchId}
                                {match.timestamp
                                  ? ` · ${formatDate(new Date(match.timestamp * 1000).toISOString())}`
                                  : ''}
                              </p>
                            </div>
                          </div>
                        </label>
                      )
                    })}
                  </div>

                  {selectedEAMatch && selectedEAClubs.length === 2 && (
                    <div className="mt-5 rounded-xl bg-black/20 p-4">
                      <label className="block text-sm text-gray-300 mb-2">
                        Which EA club represents the NVPL home team?
                      </label>

                      <select
                        value={selectedEaHomeId}
                        onChange={e => setSelectedEaHomeId(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-[#101827] p-3 text-white"
                      >
                        {selectedEAClubs.map(club => (
                          <option key={club.id} value={club.id}>
                            {club.name}
                          </option>
                        ))}
                      </select>

                      <div className="mt-4 text-xs text-gray-400">
                        The other EA club will be assigned to the NVPL away team.
                      </div>

                      <button
                        type="button"
                        onClick={submitEAResult}
                        disabled={submittingEA}
                        className="mt-5 w-full rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 px-5 py-3 text-sm font-semibold"
                      >
                        {submittingEA ? 'Submitting result...' : 'Confirm and submit EA result'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </section>

        {fixture.status === 'scheduled' && (
          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 mb-6">
            <h2 className="text-xl font-bold">Request a reschedule</h2>
            <p className="text-sm text-gray-400 mt-1 mb-5">
              The current kickoff remains official until an NVPL admin approves a change.
            </p>

            {pendingRequest ? (
              <p className="text-yellow-300 text-sm">
                A reschedule request is already awaiting admin review.
              </p>
            ) : (
              <form onSubmit={requestReschedule} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-2">
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
                  <label className="block text-sm text-gray-300 mb-2">
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
                  className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-5 py-3 text-sm font-semibold"
                >
                  {requesting ? 'Submitting...' : 'Submit reschedule request'}
                </button>
              </form>
            )}
          </section>
        )}

        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Reschedule requests</h2>

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
                    <span className={`text-xs uppercase font-bold ${
                      request.status === 'approved'
                        ? 'text-green-400'
                        : request.status === 'rejected'
                          ? 'text-red-400'
                          : 'text-yellow-400'
                    }`}>
                      {request.status}
                    </span>
                  </div>

                  <p className="text-sm text-gray-300 mt-3">
                    Proposed kickoff: {formatDate(request.requested_kickoff_at)}
                  </p>

                  {request.reason && (
                    <p className="text-sm text-gray-400 mt-2">
                      Reason: {request.reason}
                    </p>
                  )}

                  {request.review_note && (
                    <p className="text-sm text-gray-400 mt-2">
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
                        className="w-full rounded-lg border border-white/10 bg-[#101827] p-3 text-white text-sm mb-3"
                      />

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={reviewing}
                          onClick={() => reviewRequest(request.id, true)}
                          className="rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 px-4 py-2 text-sm font-semibold"
                        >
                          Approve
                        </button>

                        <button
                          type="button"
                          disabled={reviewing}
                          onClick={() => reviewRequest(request.id, false)}
                          className="rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 px-4 py-2 text-sm font-semibold"
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

        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-xl font-bold">Manager discussion</h2>
          <p className="text-sm text-gray-400 mt-1 mb-5">
            Keep all match arrangements and communication in this thread.
          </p>

          {messages.length === 0 ? (
            <div className="rounded-xl bg-black/20 p-6 text-center text-sm text-gray-500">
              No messages yet. Start the discussion.
            </div>
          ) : (
            <div className="space-y-4 mb-6">
              {messages.map(message => (
                <div
                  key={message.id}
                  className={`rounded-xl p-4 ${
                    message.user_id === userId
                      ? 'bg-blue-600/15 border border-blue-500/20'
                      : 'bg-black/20 border border-white/5'
                  }`}
                >
                  <div className="flex flex-wrap justify-between gap-2 mb-2">
                    <p className="font-semibold text-sm">
                      {message.username}
                      {message.user_id === userId && (
                        <span className="text-blue-400 font-normal ml-2">You</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(message.created_at)}
                    </p>
                  </div>
                  <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">
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

            <div className="flex justify-between items-center gap-3">
              <p className="text-xs text-gray-500">
                {messageText.length}/2000
              </p>
              <button
                type="submit"
                disabled={sending || !messageText.trim()}
                className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-5 py-3 text-sm font-semibold"
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
        <main className="min-h-screen bg-[#080b14] text-white p-8">
          <p className="text-gray-400">Loading match thread...</p>
        </main>
      }
    >
      <MatchThreadContent />
    </Suspense>
  )
}
