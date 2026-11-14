
'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Props = {
  competitionId: string
  isAdmin: boolean
}

type MatchweekFixture = {
  id: string
  matchweek: number | null
  status: string | null
}

type MatchPlayerStat = {
  fixture_id: string
  player_id: string
  team_id: string
  goals: number | null
  assists: number | null
  shots: number | null
  shots_on_target: number | null
  saves: number | null
  clean_sheet: boolean | null
  passes_completed: number | null
  passes_attempted: number | null
  minutes_played: number | null
}

type PlayerProfile = {
  id: string
  username: string | null
  gamertag: string | null
  position: string | null
  avatar_url: string | null
}

type Team = {
  id: string
  name: string
  badge_url: string | null
}

type Candidate = {
  player_id: string
  team_id: string
  username: string
  position: string
  avatar_url: string | null
  team_name: string
  appearances: number
  goals: number
  assists: number
  shots: number
  shots_on_target: number
  saves: number
  clean_sheets: number
  passes_completed: number
  passes_attempted: number
  minutes_played: number
  rating: number
}

type SelectedPlayer = {
  player_id: string
  team_id: string
  slot: string
  rating: number
}

type SavedTeamOfWeek = {
  id: string
  formation: string
  starting_xi: SelectedPlayer[]
  substitutes: SelectedPlayer[]
  mvp_player_id: string | null
  status: string
}

const FORMATIONS: Record<string, {
  GK: number
  DEF: number
  MID: number
  FWD: number
}> = {
  '4-3-3': { GK: 1, DEF: 4, MID: 3, FWD: 3 },
  '4-2-3-1': { GK: 1, DEF: 4, MID: 5, FWD: 1 },
  '4-1-4-1': { GK: 1, DEF: 4, MID: 5, FWD: 1 },
  '3-5-2': { GK: 1, DEF: 3, MID: 5, FWD: 2 },
  '3-4-3': { GK: 1, DEF: 3, MID: 4, FWD: 3 },
  '5-3-2': { GK: 1, DEF: 5, MID: 3, FWD: 2 }
}

function positionGroup(position: string | null | undefined) {
  const value = (position || '').toUpperCase()

  if (
    value.includes('GK') ||
    value.includes('KEEPER') ||
    value === 'G'
  ) return 'GK'

  if (
    value.includes('CB') ||
    value.includes('LB') ||
    value.includes('RB') ||
    value.includes('DEF') ||
    value.includes('BACK')
  ) return 'DEF'

  if (
    value.includes('CDM') ||
    value.includes('CM') ||
    value.includes('CAM') ||
    value.includes('LM') ||
    value.includes('RM') ||
    value.includes('MID')
  ) return 'MID'

  if (
    value.includes('ST') ||
    value.includes('CF') ||
    value.includes('LW') ||
    value.includes('RW') ||
    value.includes('FWD') ||
    value.includes('ATT')
  ) return 'FWD'

  return 'MID'
}

function getRating(player: {
  goals: number
  assists: number
  shots: number
  shots_on_target: number
  saves: number
  clean_sheets: number
  passes_completed: number
  passes_attempted: number
  minutes_played: number
  position: string
}) {
  const group = positionGroup(player.position)

  const passAccuracy = player.passes_attempted > 0
    ? player.passes_completed / player.passes_attempted
    : 0

  let rating = 6

  rating += player.goals * (group === 'GK' || group === 'DEF' ? 1.4 : 1.1)
  rating += player.assists * 0.8
  rating += player.shots_on_target * 0.12

  if (group === 'GK') {
    rating += player.saves * 0.25
    rating += player.clean_sheets * 0.7
  }

  if (group === 'DEF') {
    rating += player.clean_sheets * 0.65
    rating += passAccuracy * 0.8
  }

  if (group === 'MID') {
    rating += passAccuracy * 1.1
    rating += player.passes_completed * 0.006
  }

  if (group === 'FWD') {
    rating += player.shots * 0.08
  }

  return Math.min(10, Math.max(1, Number(rating.toFixed(1))))
}

function makeSlots(formation: string): string[] {
  const counts = FORMATIONS[formation] || FORMATIONS['4-3-3']

  const slots = ['GK']

  for (let i = 1; i <= counts.DEF; i++) {
    slots.push(`DEF${i}`)
  }

  for (let i = 1; i <= counts.MID; i++) {
    slots.push(`MID${i}`)
  }

  for (let i = 1; i <= counts.FWD; i++) {
    slots.push(`FWD${i}`)
  }

  return slots
}

function slotLabel(slot: string) {
  if (slot.startsWith('GK')) return 'Goalkeeper'
  if (slot.startsWith('DEF')) return 'Defender'
  if (slot.startsWith('MID')) return 'Midfielder'
  if (slot.startsWith('FWD')) return 'Forward'
  return slot
}

function emptySelection(slot: string): SelectedPlayer {
  return {
    player_id: '',
    team_id: '',
    slot,
    rating: 0
  }
}

export default function CompetitionTeamOfWeek({
  competitionId,
  isAdmin
}: Props) {
  const [matchweeks, setMatchweeks] = useState<number[]>([])
  const [selectedWeek, setSelectedWeek] = useState<number | ''>('')

  const [formation, setFormation] = useState('4-3-3')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [startingXI, setStartingXI] = useState<SelectedPlayer[]>([])
  const [substitutes, setSubstitutes] = useState<SelectedPlayer[]>([])

  const [mvpPlayerId, setMvpPlayerId] = useState('')
  const [savedId, setSavedId] = useState('')
  const [savedStatus, setSavedStatus] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const loadMatchweeks = useCallback(async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from('nvpl_fixtures')
      .select('id, matchweek, status')
      .eq('competition_id', competitionId)

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    const fixtures = (data || []) as MatchweekFixture[]

    const completedWeeks = [
      ...new Set(
        fixtures
          .filter((fixture: MatchweekFixture) =>
            ['completed', 'finished', 'played'].includes(
              (fixture.status || '').toLowerCase()
            )
          )
          .map((fixture: MatchweekFixture) => fixture.matchweek)
          .filter((week): week is number => week !== null)
      )
    ].sort((a, b) => b - a)

    setMatchweeks(completedWeeks)

    if (completedWeeks.length > 0) {
      setSelectedWeek(completedWeeks[0])
    } else {
      setSelectedWeek('')
      setLoading(false)
    }
  }, [competitionId])

  const loadWeek = useCallback(async () => {
    if (selectedWeek === '') return

    setLoading(true)
    setMessage('')

    const { data: fixtureData, error: fixtureError } = await supabase
      .from('nvpl_fixtures')
      .select('id, matchweek, status')
      .eq('competition_id', competitionId)
      .eq('matchweek', selectedWeek)

    if (fixtureError) {
      setMessage(fixtureError.message)
      setLoading(false)
      return
    }

    const weekFixtures = ((fixtureData || []) as MatchweekFixture[])
      .filter((fixture: MatchweekFixture) =>
        ['completed', 'finished', 'played'].includes(
          (fixture.status || '').toLowerCase()
        )
      )

    const fixtureIds = weekFixtures.map(fixture => fixture.id)

    if (fixtureIds.length === 0) {
      setCandidates([])
      setStartingXI([])
      setSubstitutes([])
      setLoading(false)
      return
    }

    const { data: statsData, error: statsError } = await supabase
      .from('nvpl_match_player_stats')
      .select(
        'fixture_id, player_id, team_id, goals, assists, shots, shots_on_target, saves, clean_sheet, passes_completed, passes_attempted, minutes_played'
      )
      .in('fixture_id', fixtureIds)

    if (statsError) {
      setMessage(statsError.message)
      setLoading(false)
      return
    }

    const stats = (statsData || []) as MatchPlayerStat[]

    const playerIds = [...new Set(stats.map(stat => stat.player_id))]
    const teamIds = [...new Set(stats.map(stat => stat.team_id))]

    if (playerIds.length === 0) {
      setCandidates([])
      setStartingXI([])
      setSubstitutes([])
      setLoading(false)
      return
    }

    const [{ data: profileData, error: profileError }, { data: teamData }] =
      await Promise.all([
        supabase
          .from('player_profiles')
          .select('id, username, gamertag, position, avatar_url')
          .in('id', playerIds),
        supabase
          .from('teams')
          .select('id, name, badge_url')
          .in('id', teamIds)
      ])

    if (profileError) {
      setMessage(profileError.message)
      setLoading(false)
      return
    }

    const profiles = (profileData || []) as PlayerProfile[]
    const teams = (teamData || []) as Team[]

    const aggregated = new Map<string, Candidate>()

    for (const stat of stats) {
      const profile = profiles.find(player => player.id === stat.player_id)
      if (!profile) continue

      const key = `${stat.player_id}-${stat.team_id}`

      if (!aggregated.has(key)) {
        const team = teams.find(item => item.id === stat.team_id)

        aggregated.set(key, {
          player_id: stat.player_id,
          team_id: stat.team_id,
          username: profile.username || profile.gamertag || 'Unknown player',
          position: profile.position || 'MID',
          avatar_url: profile.avatar_url,
          team_name: team?.name || 'Unknown club',
          appearances: 0,
          goals: 0,
          assists: 0,
          shots: 0,
          shots_on_target: 0,
          saves: 0,
          clean_sheets: 0,
          passes_completed: 0,
          passes_attempted: 0,
          minutes_played: 0,
          rating: 0
        })
      }

      const player = aggregated.get(key)!

      player.appearances += 1
      player.goals += stat.goals || 0
      player.assists += stat.assists || 0
      player.shots += stat.shots || 0
      player.shots_on_target += stat.shots_on_target || 0
      player.saves += stat.saves || 0
      player.clean_sheets += stat.clean_sheet ? 1 : 0
      player.passes_completed += stat.passes_completed || 0
      player.passes_attempted += stat.passes_attempted || 0
      player.minutes_played += stat.minutes_played || 0
    }

    const rankedCandidates = [...aggregated.values()]
      .filter(player => player.minutes_played >= 30)
      .map(player => ({
        ...player,
        rating: getRating(player)
      }))
      .sort((a, b) => b.rating - a.rating)

    setCandidates(rankedCandidates)

    // Load any saved team for this competition and matchweek.
    const { data: savedData, error: savedError } = await supabase
      .from('nvpl_competition_team_of_week')
      .select(
        'id, formation, starting_xi, substitutes, mvp_player_id, status'
      )
      .eq('competition_id', competitionId)
      .eq('matchweek', selectedWeek)
      .maybeSingle()

    if (savedError) {
      setMessage(savedError.message)
    }

    if (savedData) {
      const saved = savedData as SavedTeamOfWeek

      setSavedId(saved.id)
      setSavedStatus(saved.status)
      setFormation(saved.formation || '4-3-3')
      setStartingXI(Array.isArray(saved.starting_xi) ? saved.starting_xi : [])
      setSubstitutes(Array.isArray(saved.substitutes) ? saved.substitutes : [])
      setMvpPlayerId(saved.mvp_player_id || '')
    } else {
      setSavedId('')
      setSavedStatus('')
      setFormation('4-3-3')
      setStartingXI([])
      setSubstitutes([])
      setMvpPlayerId('')
    }

    setLoading(false)
  }, [competitionId, selectedWeek])

  useEffect(() => {
    loadMatchweeks()
  }, [loadMatchweeks])

  useEffect(() => {
    if (selectedWeek !== '') {
      loadWeek()
    }
  }, [selectedWeek, loadWeek])

  function autoGenerate() {
    if (candidates.length === 0) {
      setMessage('No eligible player statistics are available for this matchweek.')
      return
    }

    const slots = makeSlots(formation)
    const used = new Set<string>()
    const newXI: SelectedPlayer[] = []

    for (const slot of slots) {
      const group = slot.slice(0, 3)

      let player = candidates.find(candidate =>
        !used.has(candidate.player_id) &&
        positionGroup(candidate.position) === group
      )

      if (!player) {
        player = candidates.find(candidate =>
          !used.has(candidate.player_id)
        )
      }

      if (player) {
        used.add(player.player_id)

        newXI.push({
          player_id: player.player_id,
          team_id: player.team_id,
          slot,
          rating: player.rating
        })
      } else {
        newXI.push(emptySelection(slot))
      }
    }

    const newSubs = candidates
      .filter(candidate => !used.has(candidate.player_id))
      .slice(0, 7)
      .map((candidate, index) => ({
        player_id: candidate.player_id,
        team_id: candidate.team_id,
        slot: `SUB${index + 1}`,
        rating: candidate.rating
      }))

    setStartingXI(newXI)
    setSubstitutes(newSubs)
    setMvpPlayerId(newXI.find(player => player.player_id)?.player_id || '')
    setMessage('Team automatically selected using match performances.')
  }

  function changeStarter(slot: string, playerId: string) {
    const candidate = candidates.find(player => player.player_id === playerId)

    const currentStarter = startingXI.find(player => player.slot === slot)

    const selectedSub = substitutes.find(
      player => player.player_id === playerId
    )

    const updatedXI = startingXI.map(player => {
      if (player.slot !== slot) return player

      if (!candidate) return emptySelection(slot)

      return {
        player_id: candidate.player_id,
        team_id: candidate.team_id,
        slot,
        rating: candidate.rating
      }
    })

    let updatedSubs = [...substitutes]

    if (selectedSub) {
      updatedSubs = updatedSubs.filter(
        player => player.player_id !== playerId
      )

      if (currentStarter?.player_id) {
        updatedSubs.push({
          ...currentStarter,
          slot: `SUB${updatedSubs.length + 1}`
        })
      }
    } else if (currentStarter?.player_id) {
      updatedSubs = updatedSubs.filter(
        player => player.player_id !== currentStarter.player_id
      )
    }

    updatedSubs = updatedSubs.slice(0, 7).map((player, index) => ({
      ...player,
      slot: `SUB${index + 1}`
    }))

    setStartingXI(updatedXI)
    setSubstitutes(updatedSubs)
  }

  function changeSub(index: number, playerId: string) {
    const candidate = candidates.find(player => player.player_id === playerId)
    if (!candidate) return

    const updated = [...substitutes]

    updated[index] = {
      player_id: candidate.player_id,
      team_id: candidate.team_id,
      slot: `SUB${index + 1}`,
      rating: candidate.rating
    }

    setSubstitutes(updated)
  }

  function availablePlayers(currentPlayerId: string) {
    const selectedIds = new Set([
      ...startingXI.map(player => player.player_id),
      ...substitutes.map(player => player.player_id)
    ])

    return candidates.filter(candidate =>
      candidate.player_id === currentPlayerId ||
      !selectedIds.has(candidate.player_id)
    )
  }

  async function saveTeam(status: 'draft' | 'published') {
    if (!isAdmin) return

    if (selectedWeek === '') {
      setMessage('Select a matchweek first.')
      return
    }

    const filledXI = startingXI.filter(player => player.player_id)

    if (filledXI.length !== 11) {
      setMessage('Select all 11 starting players before saving.')
      return
    }

    setSaving(true)
    setMessage('')

    const { data: authData } = await supabase.auth.getUser()

    const payload = {
      competition_id: competitionId,
      matchweek: selectedWeek,
      formation,
      starting_xi: startingXI,
      substitutes: substitutes.filter(player => player.player_id),
      mvp_player_id: mvpPlayerId || null,
      status,
      published_at: status === 'published' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
      created_by: authData.user?.id || null
    }

    const { data, error } = await supabase
      .from('nvpl_competition_team_of_week')
      .upsert(payload, {
        onConflict: 'competition_id,matchweek'
      })
      .select('id')
      .single()

    if (error) {
      setMessage(error.message)
    } else {
      setSavedId(data.id)
      setSavedStatus(status)
      setMessage(
        status === 'published'
          ? 'Team of the Week published successfully.'
          : 'Team of the Week saved as a draft.'
      )
    }

    setSaving(false)
  }

  async function unpublishTeam() {
    if (!isAdmin || !savedId) return

    setSaving(true)
    setMessage('')

    const { error } = await supabase
      .from('nvpl_competition_team_of_week')
      .update({
        status: 'draft',
        published_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', savedId)

    if (error) {
      setMessage(error.message)
    } else {
      setSavedStatus('draft')
      setMessage('Team of the Week changed back to draft.')
    }

    setSaving(false)
  }

  function playerForSelection(selection: SelectedPlayer) {
    return candidates.find(
      candidate => candidate.player_id === selection.player_id
    )
  }

  if (loading) {
    return (
      <div className="mt-8 bg-gray-900 border border-gray-800 rounded-xl p-8 text-gray-400">
        Loading Team of the Week...
      </div>
    )
  }

  return (
    <section className="mt-8 space-y-6">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h2 className="text-3xl font-black">Team of the Week</h2>
          <p className="text-gray-400 mt-2">
            The best performers from each completed matchweek.
          </p>
        </div>

        {savedStatus && (
          <span className={`px-4 py-2 rounded-lg text-sm font-bold ${
            savedStatus === 'published'
              ? 'bg-green-900 text-green-300'
              : 'bg-yellow-900 text-yellow-300'
          }`}>
            {savedStatus === 'published' ? 'Published' : 'Draft'}
          </span>
        )}
      </div>

      {message && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-sm">
          {message}
        </div>
      )}

      {matchweeks.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
          <h3 className="text-xl font-bold">No completed matchweeks</h3>
          <p className="text-gray-400 mt-2">
            Team of the Week will become available after match statistics are recorded.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-sm text-gray-400 mb-2">
                Select matchweek
              </label>
              <select
                value={selectedWeek}
                onChange={event => setSelectedWeek(Number(event.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3"
              >
                {matchweeks.map(week => (
                  <option key={week} value={week}>
                    Matchweek {week}
                  </option>
                ))}
              </select>
            </div>

            {isAdmin && (
              <div className="flex-1 min-w-[180px]">
                <label className="block text-sm text-gray-400 mb-2">
                  Formation
                </label>
                <select
                  value={formation}
                  onChange={event => setFormation(event.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3"
                >
                  {Object.keys(FORMATIONS).map(item => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {isAdmin && (
            <div className="flex flex-wrap gap-3">
              <button
                onClick={autoGenerate}
                disabled={candidates.length === 0}
                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 px-5 py-3 rounded-lg font-bold"
              >
                Auto-pick Team of the Week
              </button>

              <button
                onClick={() => saveTeam('draft')}
                disabled={saving || startingXI.filter(player => player.player_id).length !== 11}
                className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-5 py-3 rounded-lg font-bold"
              >
                {saving ? 'Saving...' : 'Save draft'}
              </button>

              <button
                onClick={() => saveTeam('published')}
                disabled={saving || startingXI.filter(player => player.player_id).length !== 11}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 px-5 py-3 rounded-lg font-bold"
              >
                {saving ? 'Saving...' : 'Publish Team of the Week'}
              </button>

              {savedStatus === 'published' && (
                <button
                  onClick={unpublishTeam}
                  disabled={saving}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-50 px-5 py-3 rounded-lg font-bold"
                >
                  Unpublish
                </button>
              )}
            </div>
          )}

          {/* Starting XI pitch */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 md:p-6">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="text-xl font-bold">Starting XI</h3>
                <p className="text-sm text-gray-400 mt-1">{formation}</p>
              </div>
              <span className="text-sm text-gray-400">
                {startingXI.filter(player => player.player_id).length}/11 selected
              </span>
            </div>

            <div className="relative rounded-xl overflow-hidden border-2 border-green-700 bg-gradient-to-b from-green-800 to-green-950 p-4 md:p-7">
              <div className="absolute inset-0 opacity-30 pointer-events-none">
                <div className="absolute inset-3 border border-white rounded-lg" />
                <div className="absolute top-1/2 left-0 right-0 border-t border-white" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 border border-white rounded-full" />
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-32 h-12 border border-white rounded-b-lg" />
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-32 h-12 border border-white rounded-t-lg" />
              </div>

              <div className="relative z-10 space-y-5">
                {['FWD', 'MID', 'DEF', 'GK'].map(group => {
                  const groupPlayers = startingXI.filter(player =>
                    player.slot.startsWith(group)
                  )

                  if (groupPlayers.length === 0) return null

                  return (
                    <div
                      key={group}
                      className="flex justify-center items-start gap-2 md:gap-5"
                    >
                      {groupPlayers.map(selection => {
                        const player = playerForSelection(selection)

                        return (
                          <div
                            key={selection.slot}
                            className="w-1/4 max-w-32 min-w-0 text-center"
                          >
                            <div className="mx-auto w-11 h-11 md:w-14 md:h-14 rounded-full bg-gray-950 border-2 border-white flex items-center justify-center overflow-hidden">
                              {player?.avatar_url ? (
                                <img
                                  src={player.avatar_url}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="font-black text-sm">
                                  {player?.username?.slice(0, 2).toUpperCase() || '?'}
                                </span>
                              )}
                            </div>

                            <div className="mt-2 bg-gray-950/90 rounded-md px-2 py-2">
                              <p className="text-xs font-bold truncate">
                                {player?.username || 'Empty slot'}
                              </p>
                              <p className="text-xs text-green-300">
                                {player ? player.rating.toFixed(1) : slotLabel(selection.slot)}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Editable starting XI */}
          {isAdmin && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-xl font-bold mb-4">Edit starting XI</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {startingXI.map(selection => (
                  <div key={selection.slot}>
                    <label className="block text-sm text-gray-400 mb-2">
                      {slotLabel(selection.slot)} {selection.slot.replace(/^[A-Z]+/, '')}
                    </label>
                    <select
                      value={selection.player_id}
                      onChange={event =>
                        changeStarter(selection.slot, event.target.value)
                      }
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3"
                    >
                      <option value="">Select player</option>
                      {availablePlayers(selection.player_id).map(player => (
                        <option key={player.player_id} value={player.player_id}>
                          {player.username} · {player.team_name} · {player.rating.toFixed(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Substitutes */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-xl font-bold">Substitutes</h3>
            <p className="text-gray-400 text-sm mt-1">
              Up to seven additional players.
            </p>

            {substitutes.length === 0 ? (
              <p className="text-gray-500 mt-4">No substitutes selected.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5">
                {substitutes.map((selection, index) => {
                  const player = playerForSelection(selection)

                  return (
                    <div
                      key={selection.slot}
                      className="bg-gray-800 rounded-lg p-4 flex items-center gap-3"
                    >
                      {player?.avatar_url ? (
                        <img
                          src={player.avatar_url}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center font-bold">
                          {player?.username?.slice(0, 2).toUpperCase() || '?'}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        {isAdmin ? (
                          <select
                            value={selection.player_id}
                            onChange={event => changeSub(index, event.target.value)}
                            className="w-full bg-gray-700 rounded-lg p-2 text-sm"
                          >
                            {availablePlayers(selection.player_id).map(option => (
                              <option key={option.player_id} value={option.player_id}>
                                {option.username} · {option.team_name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <p className="font-semibold truncate">
                            {player?.username || 'Player'}
                          </p>
                        )}

                        <p className="text-xs text-gray-400 mt-1">
                          {player?.team_name || 'Club'} · {player?.position || 'Player'}
                        </p>
                      </div>

                      <span className="font-bold text-blue-400">
                        {player?.rating.toFixed(1) || '—'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* MVP */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-xl font-bold">Player of the Week / MVP</h3>

            {isAdmin ? (
              <select
                value={mvpPlayerId}
                onChange={event => setMvpPlayerId(event.target.value)}
                className="w-full mt-4 bg-gray-800 border border-gray-700 rounded-lg p-3"
              >
                <option value="">Select MVP</option>
                {startingXI
                  .filter(player => player.player_id)
                  .map(selection => {
                    const player = playerForSelection(selection)

                    return (
                      <option
                        key={selection.player_id}
                        value={selection.player_id}
                      >
                        {player?.username || 'Player'} · {player?.rating.toFixed(1)}
                      </option>
                    )
                  })}
              </select>
            ) : (
              <p className="text-gray-300 mt-3">
                {candidates.find(player => player.player_id === mvpPlayerId)?.username ||
                  'MVP not announced'}
              </p>
            )}
          </div>

          {/* Performance rankings */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-xl font-bold">Performance rankings</h3>
            <p className="text-sm text-gray-400 mt-1">
              Players are ranked using their recorded match statistics.
            </p>

            {candidates.length === 0 ? (
              <p className="text-gray-400 mt-4">
                No eligible player performances found. Players need at least 30 recorded minutes.
              </p>
            ) : (
              <div className="overflow-x-auto mt-5">
                <table className="w-full text-sm text-left min-w-[600px]">
                  <thead className="text-gray-400 border-b border-gray-700">
                    <tr>
                      <th className="py-3 px-2">#</th>
                      <th className="py-3 px-2">Player</th>
                      <th className="py-3 px-2">Club</th>
                      <th className="py-3 px-2">Position</th>
                      <th className="py-3 px-2">Goals</th>
                      <th className="py-3 px-2">Assists</th>
                      <th className="py-3 px-2">Minutes</th>
                      <th className="py-3 px-2">Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((player, index) => (
                      <tr
                        key={`${player.player_id}-${player.team_id}`}
                        className="border-b border-gray-800"
                      >
                        <td className="py-3 px-2 font-bold">{index + 1}</td>
                        <td className="py-3 px-2 font-semibold">{player.username}</td>
                        <td className="py-3 px-2">{player.team_name}</td>
                        <td className="py-3 px-2">{player.position}</td>
                        <td className="py-3 px-2">{player.goals}</td>
                        <td className="py-3 px-2">{player.assists}</td>
                        <td className="py-3 px-2">{player.minutes_played}</td>
                        <td className="py-3 px-2 font-black text-blue-400">
                          {player.rating.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}
