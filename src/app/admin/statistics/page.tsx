
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Fixture = {
  id: string
  competition_id: string
  home_team_id: string
  away_team_id: string
  status: string
}

type Team = {
  id: string
  name: string
}

type Player = {
  id: string
  username: string
  gamertag: string
}

type PlayerStat = {
  id: string
  fixture_id: string
  player_id: string
  team_id: string
  goals: number
  assists: number
  shots: number
  shots_on_target: number
  saves: number
  clean_sheet: boolean
  passes_completed: number
  passes_attempted: number
  minutes_played: number
  updated_at: string
}

type TeamStat = {
  id: string
  fixture_id: string
  team_id: string
  possession: number
  shots: number
  shots_on_target: number
  corners: number
  fouls: number
  passes_completed: number
  passes_attempted: number
}

export default function AdminStatisticsPage() {
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [playerStats, setPlayerStats] = useState<PlayerStat[]>([])
  const [teamStats, setTeamStats] = useState<TeamStat[]>([])

  const [fixtureId, setFixtureId] = useState('')
  const [teamId, setTeamId] = useState('')
  const [playerId, setPlayerId] = useState('')

  const [goals, setGoals] = useState('0')
  const [assists, setAssists] = useState('0')
  const [shots, setShots] = useState('0')
  const [shotsOnTarget, setShotsOnTarget] = useState('0')
  const [saves, setSaves] = useState('0')
  const [cleanSheet, setCleanSheet] = useState(false)
  const [passesCompleted, setPassesCompleted] = useState('0')
  const [passesAttempted, setPassesAttempted] = useState('0')
  const [minutesPlayed, setMinutesPlayed] = useState('90')

  const [teamStatId, setTeamStatId] = useState<string | null>(null)
  const [possession, setPossession] = useState('50')
  const [teamShots, setTeamShots] = useState('0')
  const [teamShotsOnTarget, setTeamShotsOnTarget] = useState('0')
  const [corners, setCorners] = useState('0')
  const [fouls, setFouls] = useState('0')
  const [teamPassesCompleted, setTeamPassesCompleted] = useState('0')
  const [teamPassesAttempted, setTeamPassesAttempted] = useState('0')

  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<'players' | 'teams'>('players')

  useEffect(() => {
    loadPage()
  }, [])

  async function loadPage() {
    setLoading(true)

    const [fixtureResult, teamResult, playerResult, playerStatsResult, teamStatsResult] =
      await Promise.all([
        supabase.from('nvpl_fixtures')
          .select('id,competition_id,home_team_id,away_team_id,status')
          .order('created_at', { ascending: false }),

        supabase.from('teams')
          .select('id,name')
          .order('name'),

        supabase.from('player_profiles')
          .select('id,username,gamertag')
          .order('username'),

        supabase.from('nvpl_match_player_stats')
          .select('*')
          .order('updated_at', { ascending: false }),

        supabase.from('nvpl_match_team_stats')
          .select('*')
          .order('updated_at', { ascending: false })
      ])

    const error =
      fixtureResult.error ||
      teamResult.error ||
      playerResult.error ||
      playerStatsResult.error ||
      teamStatsResult.error

    if (error) {
      setMessage(`Could not load data: ${error.message}`)
      setLoading(false)
      return
    }

    setFixtures(fixtureResult.data || [])
    setTeams(teamResult.data || [])
    setPlayers(playerResult.data || [])
    setPlayerStats(playerStatsResult.data || [])
    setTeamStats(teamStatsResult.data || [])

    setLoading(false)
  }

  const selectedFixture = fixtures.find(f => f.id === fixtureId)

  const availableTeams = selectedFixture
    ? teams.filter(t =>
        t.id === selectedFixture.home_team_id ||
        t.id === selectedFixture.away_team_id
      )
    : []

  const filteredPlayerStats = fixtureId
    ? playerStats.filter(s => s.fixture_id === fixtureId)
    : playerStats

  const filteredTeamStats = fixtureId
    ? teamStats.filter(s => s.fixture_id === fixtureId)
    : teamStats

  function getTeamName(id: string) {
    return teams.find(t => t.id === id)?.name || 'Unknown team'
  }

  function getPlayerName(id: string) {
    const player = players.find(p => p.id === id)
    return player
      ? `${player.gamertag || player.username} (@${player.username})`
      : 'Unknown player'
  }

  function getFixtureName(id: string) {
    const fixture = fixtures.find(f => f.id === id)
    if (!fixture) return 'Unknown fixture'

    return `${getTeamName(fixture.home_team_id)} vs ${getTeamName(fixture.away_team_id)}`
  }

  function resetPlayerForm() {
    setEditingPlayerId(null)
    setFixtureId('')
    setTeamId('')
    setPlayerId('')
    setGoals('0')
    setAssists('0')
    setShots('0')
    setShotsOnTarget('0')
    setSaves('0')
    setCleanSheet(false)
    setPassesCompleted('0')
    setPassesAttempted('0')
    setMinutesPlayed('90')
  }

  function editPlayer(stat: PlayerStat) {
    setActiveTab('players')
    setEditingPlayerId(stat.id)
    setFixtureId(stat.fixture_id)
    setTeamId(stat.team_id)
    setPlayerId(stat.player_id)
    setGoals(String(stat.goals))
    setAssists(String(stat.assists))
    setShots(String(stat.shots))
    setShotsOnTarget(String(stat.shots_on_target))
    setSaves(String(stat.saves))
    setCleanSheet(stat.clean_sheet)
    setPassesCompleted(String(stat.passes_completed))
    setPassesAttempted(String(stat.passes_attempted))
    setMinutesPlayed(String(stat.minutes_played))
    setMessage('Editing player performance.')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function savePlayerStats() {
    if (!fixtureId || !teamId || !playerId) {
      setMessage('Choose a fixture, team and player.')
      return
    }

    const values = [
      goals, assists, shots, shotsOnTarget, saves,
      passesCompleted, passesAttempted, minutesPlayed
    ].map(Number)

    if (values.some(v => !Number.isInteger(v) || v < 0)) {
      setMessage('Statistics must be non-negative whole numbers.')
      return
    }

    if (Number(minutesPlayed) > 130) {
      setMessage('Minutes played cannot exceed 130.')
      return
    }

    if (Number(shotsOnTarget) > Number(shots)) {
      setMessage('Shots on target cannot exceed shots.')
      return
    }

    if (Number(passesCompleted) > Number(passesAttempted)) {
      setMessage('Completed passes cannot exceed attempted passes.')
      return
    }

    setBusy(true)
    setMessage('Saving player statistics...')

    const { error } = await supabase.rpc('nvpl_save_player_match_stats', {
      p_fixture_id: fixtureId,
      p_player_id: playerId,
      p_team_id: teamId,
      p_goals: Number(goals),
      p_assists: Number(assists),
      p_shots: Number(shots),
      p_shots_on_target: Number(shotsOnTarget),
      p_saves: Number(saves),
      p_clean_sheet: cleanSheet,
      p_passes_completed: Number(passesCompleted),
      p_passes_attempted: Number(passesAttempted),
      p_minutes_played: Number(minutesPlayed)
    })

    setBusy(false)

    if (error) {
      setMessage(`Player save failed: ${error.message}`)
      return
    }

    setMessage('Player statistics saved successfully.')
    resetPlayerForm()
    await loadPage()
  }

  function resetTeamForm() {
    setTeamStatId(null)
    setFixtureId('')
    setTeamId('')
    setPossession('50')
    setTeamShots('0')
    setTeamShotsOnTarget('0')
    setCorners('0')
    setFouls('0')
    setTeamPassesCompleted('0')
    setTeamPassesAttempted('0')
  }

  function editTeam(stat: TeamStat) {
    setActiveTab('teams')
    setTeamStatId(stat.id)
    setFixtureId(stat.fixture_id)
    setTeamId(stat.team_id)
    setPossession(String(stat.possession))
    setTeamShots(String(stat.shots))
    setTeamShotsOnTarget(String(stat.shots_on_target))
    setCorners(String(stat.corners))
    setFouls(String(stat.fouls))
    setTeamPassesCompleted(String(stat.passes_completed))
    setTeamPassesAttempted(String(stat.passes_attempted))
    setMessage('Editing team performance.')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function saveTeamStats() {
    if (!fixtureId || !teamId) {
      setMessage('Choose a fixture and team.')
      return
    }

    const values = [
      possession, teamShots, teamShotsOnTarget,
      corners, fouls, teamPassesCompleted, teamPassesAttempted
    ].map(Number)

    if (values.some(v => !Number.isInteger(v) || v < 0)) {
      setMessage('Statistics must be non-negative whole numbers.')
      return
    }

    if (Number(possession) > 100) {
      setMessage('Possession must be between 0 and 100.')
      return
    }

    if (Number(teamShotsOnTarget) > Number(teamShots)) {
      setMessage('Shots on target cannot exceed total shots.')
      return
    }

    if (Number(teamPassesCompleted) > Number(teamPassesAttempted)) {
      setMessage('Completed passes cannot exceed attempted passes.')
      return
    }

    setBusy(true)
    setMessage('Saving team statistics...')

    const valuesToSave = {
      fixture_id: fixtureId,
      team_id: teamId,
      possession: Number(possession),
      shots: Number(teamShots),
      shots_on_target: Number(teamShotsOnTarget),
      corners: Number(corners),
      fouls: Number(fouls),
      passes_completed: Number(teamPassesCompleted),
      passes_attempted: Number(teamPassesAttempted),
      updated_at: new Date().toISOString()
    }

    let error

    if (teamStatId) {
      const result = await supabase
        .from('nvpl_match_team_stats')
        .update(valuesToSave)
        .eq('id', teamStatId)

      error = result.error
    } else {
      const existing = await supabase
        .from('nvpl_match_team_stats')
        .select('id')
        .eq('fixture_id', fixtureId)
        .eq('team_id', teamId)
        .maybeSingle()

      if (existing.error) {
        setBusy(false)
        setMessage(`Could not check existing statistics: ${existing.error.message}`)
        return
      }

      if (existing.data) {
        const result = await supabase
          .from('nvpl_match_team_stats')
          .update(valuesToSave)
          .eq('id', existing.data.id)

        error = result.error
      } else {
        const result = await supabase
          .from('nvpl_match_team_stats')
          .insert(valuesToSave)

        error = result.error
      }
    }

    setBusy(false)

    if (error) {
      setMessage(`Team save failed: ${error.message}`)
      return
    }

    setMessage('Team statistics saved successfully.')
    resetTeamForm()
    await loadPage()
  }

  const inputClass =
    'w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-white'

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-6xl space-y-6">

        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black">Statistics Manager</h1>
            <p className="text-slate-400">
              Manage player and team match performances.
            </p>
          </div>

          <button
            onClick={loadPage}
            disabled={loading || busy}
            className="rounded-lg border border-slate-700 px-4 py-2 hover:bg-slate-800 disabled:opacity-50"
          >
            Refresh data
          </button>
        </header>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              setActiveTab('players')
              setMessage('')
            }}
            className={`rounded-lg px-5 py-3 font-bold ${activeTab === 'players' ? 'bg-blue-600' : 'bg-slate-800'}`}
          >
            Player statistics
          </button>

          <button
            onClick={() => {
              setActiveTab('teams')
              setMessage('')
            }}
            className={`rounded-lg px-5 py-3 font-bold ${activeTab === 'teams' ? 'bg-blue-600' : 'bg-slate-800'}`}
          >
            Team statistics
          </button>
        </div>

        {activeTab === 'players' ? (
          <>
            <section className="space-y-4 rounded-xl bg-slate-900 p-5">
              <div className="flex flex-wrap justify-between gap-3">
                <h2 className="text-xl font-bold">
                  {editingPlayerId ? 'Edit player performance' : 'Record player performance'}
                </h2>
                {editingPlayerId && (
                  <button onClick={resetPlayerForm} className="text-sm text-blue-400">
                    Cancel editing
                  </button>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm">Fixture</label>
                <select className={inputClass} value={fixtureId} onChange={e => {
                  setFixtureId(e.target.value)
                  setTeamId('')
                  setEditingPlayerId(null)
                }}>
                  <option value="">Choose fixture</option>
                  {fixtures.map(f => (
                    <option key={f.id} value={f.id}>
                      {getFixtureName(f.id)} — {f.status}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm">Team</label>
                <select className={inputClass} value={teamId} onChange={e => setTeamId(e.target.value)} disabled={!fixtureId}>
                  <option value="">Choose team</option>
                  {availableTeams.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm">Player</label>
                <select className={inputClass} value={playerId} onChange={e => setPlayerId(e.target.value)}>
                  <option value="">Choose player</option>
                  {players.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.gamertag || p.username} (@{p.username})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  ['Goals', goals, setGoals],
                  ['Assists', assists, setAssists],
                  ['Shots', shots, setShots],
                  ['Shots on target', shotsOnTarget, setShotsOnTarget],
                  ['Goalkeeper saves', saves, setSaves],
                  ['Passes completed', passesCompleted, setPassesCompleted],
                  ['Passes attempted', passesAttempted, setPassesAttempted],
                  ['Minutes played', minutesPlayed, setMinutesPlayed]
                ].map(([label, value, setter]) => (
                  <label key={label as string} className="block">
                    <span className="mb-2 block text-sm text-slate-300">{label as string}</span>
                    <input
                      type="number"
                      min="0"
                      max={label === 'Minutes played' ? 130 : undefined}
                      className={inputClass}
                      value={value as string}
                      onChange={e => (setter as (v: string) => void)(e.target.value)}
                    />
                  </label>
                ))}
              </div>

              <label className="flex items-center gap-3">
                <input type="checkbox" checked={cleanSheet} onChange={e => setCleanSheet(e.target.checked)} />
                Clean sheet
              </label>

              <button onClick={savePlayerStats} disabled={busy || loading} className="w-full rounded-lg bg-blue-600 p-3 font-bold disabled:opacity-50">
                {busy ? 'Saving...' : editingPlayerId ? 'Update player statistics' : 'Save player statistics'}
              </button>
            </section>

            <section className="space-y-4 rounded-xl bg-slate-900 p-5">
              <h2 className="text-xl font-bold">Recorded player performances</h2>
              <select className={inputClass} value={fixtureId} onChange={e => {
                setFixtureId(e.target.value)
                setTeamId('')
              }}>
                <option value="">All fixtures</option>
                {fixtures.map(f => <option key={f.id} value={f.id}>{getFixtureName(f.id)}</option>)}
              </select>

              {loading ? <p>Loading...</p> : filteredPlayerStats.length === 0 ? (
                <p className="text-slate-400">No player performances recorded.</p>
              ) : filteredPlayerStats.map(stat => (
                <article key={stat.id} className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <h3 className="font-bold">{getPlayerName(stat.player_id)}</h3>
                      <p className="text-sm text-slate-400">{getFixtureName(stat.fixture_id)}</p>
                      <p className="text-sm text-slate-400">{getTeamName(stat.team_id)}</p>
                    </div>
                    <button onClick={() => editPlayer(stat)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold">
                      Edit
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                    <p>Goals: <b>{stat.goals}</b></p>
                    <p>Assists: <b>{stat.assists}</b></p>
                    <p>Shots: <b>{stat.shots}</b></p>
                    <p>On target: <b>{stat.shots_on_target}</b></p>
                    <p>Saves: <b>{stat.saves}</b></p>
                    <p>Passes: <b>{stat.passes_completed}/{stat.passes_attempted}</b></p>
                    <p>Minutes: <b>{stat.minutes_played}</b></p>
                    <p>Clean sheet: <b>{stat.clean_sheet ? 'Yes' : 'No'}</b></p>
                  </div>
                </article>
              ))}
            </section>
          </>
        ) : (
          <>
            <section className="space-y-4 rounded-xl bg-slate-900 p-5">
              <div className="flex flex-wrap justify-between gap-3">
                <h2 className="text-xl font-bold">
                  {teamStatId ? 'Edit team performance' : 'Record team performance'}
                </h2>
                {teamStatId && (
                  <button onClick={resetTeamForm} className="text-sm text-blue-400">
                    Cancel editing
                  </button>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm">Fixture</label>
                <select className={inputClass} value={fixtureId} onChange={e => {
                  setFixtureId(e.target.value)
                  setTeamId('')
                  setTeamStatId(null)
                }}>
                  <option value="">Choose fixture</option>
                  {fixtures.map(f => (
                    <option key={f.id} value={f.id}>{getFixtureName(f.id)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm">Team</label>
                <select className={inputClass} value={teamId} onChange={e => setTeamId(e.target.value)} disabled={!fixtureId}>
                  <option value="">Choose team</option>
                  {availableTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  ['Possession (%)', possession, setPossession],
                  ['Shots', teamShots, setTeamShots],
                  ['Shots on target', teamShotsOnTarget, setTeamShotsOnTarget],
                  ['Corners', corners, setCorners],
                  ['Fouls', fouls, setFouls],
                  ['Passes completed', teamPassesCompleted, setTeamPassesCompleted],
                  ['Passes attempted', teamPassesAttempted, setTeamPassesAttempted]
                ].map(([label, value, setter]) => (
                  <label key={label as string} className="block">
                    <span className="mb-2 block text-sm text-slate-300">{label as string}</span>
                    <input
                      type="number"
                      min="0"
                      max={label === 'Possession (%)' ? 100 : undefined}
                      className={inputClass}
                      value={value as string}
                      onChange={e => (setter as (v: string) => void)(e.target.value)}
                    />
                  </label>
                ))}
              </div>

              <button onClick={saveTeamStats} disabled={busy || loading} className="w-full rounded-lg bg-blue-600 p-3 font-bold disabled:opacity-50">
                {busy ? 'Saving...' : teamStatId ? 'Update team statistics' : 'Save team statistics'}
              </button>
            </section>

            <section className="space-y-4 rounded-xl bg-slate-900 p-5">
              <h2 className="text-xl font-bold">Recorded team performances</h2>
              <select className={inputClass} value={fixtureId} onChange={e => setFixtureId(e.target.value)}>
                <option value="">All fixtures</option>
                {fixtures.map(f => <option key={f.id} value={f.id}>{getFixtureName(f.id)}</option>)}
              </select>

              {loading ? <p>Loading...</p> : filteredTeamStats.length === 0 ? (
                <p className="text-slate-400">No team performances recorded.</p>
              ) : filteredTeamStats.map(stat => (
                <article key={stat.id} className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <h3 className="font-bold">{getTeamName(stat.team_id)}</h3>
                      <p className="text-sm text-slate-400">{getFixtureName(stat.fixture_id)}</p>
                    </div>
                    <button onClick={() => editTeam(stat)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold">
                      Edit
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                    <p>Possession: <b>{stat.possession}%</b></p>
                    <p>Shots: <b>{stat.shots}</b></p>
                    <p>On target: <b>{stat.shots_on_target}</b></p>
                    <p>Corners: <b>{stat.corners}</b></p>
                    <p>Fouls: <b>{stat.fouls}</b></p>
                    <p>Passes: <b>{stat.passes_completed}/{stat.passes_attempted}</b></p>
                  </div>
                </article>
              ))}
            </section>
          </>
        )}

        {message && (
          <p className="rounded-lg border border-slate-700 bg-slate-900 p-4 text-sm text-amber-300">
            {message}
          </p>
        )}
      </div>
    </main>
  )
}
