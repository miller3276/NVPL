
'use client'

import { Suspense, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Competition = {
  id: string
  name: string
  region: string
  season: string
  division: string
  description: string | null
  status: string
  start_date: string | null
  end_date: string | null
  registrations_open: boolean
  image_url: string | null
}

type Team = {
  id: string
  name: string
  abbreviation: string | null
  badge_url: string | null
}

type Player = {
  id: string
  username: string | null
  gamertag: string
  position: string | null
  avatar_url: string | null
}

type Registration = {
  id: string
  team_id: string
  player_id: string
  status: string
}

type Standing = {
  team_id: string
  team_name: string
  abbreviation: string | null
  played: number
  wins: number
  draws: number
  losses: number
  goal_difference: number
  points: number
}

type Fixture = {
  id: string
  home_team_id: string
  away_team_id: string
  matchweek: number | null
  kickoff_at: string
  status: string
  home_score: number | null
  away_score: number | null
}

type TopScorer = {
  player_id: string
  username: string | null
  gamertag: string | null
  team_name: string | null
  goals: number
  assists: number
  appearances: number
}

type CompetitionRule = {
  id: string
  competition_id: string
  title: string
  content: string
  display_order: number
}

function CompetitionPageContent() {
  const params = useParams()
  const id = params.id as string

  const [competition, setCompetition] = useState<Competition | null>(null)
  const [registeredTeams, setRegisteredTeams] = useState<Team[]>([])
  const [myTeams, setMyTeams] = useState<Team[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [profiles, setProfiles] = useState<Player[]>([])

  const [standings, setStandings] = useState<Standing[]>([])
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [topScorers, setTopScorers] = useState<TopScorer[]>([])
  const [fixtureTeams, setFixtureTeams] = useState<Team[]>([])

  const [rules, setRules] = useState<CompetitionRule[]>([])
  const [activeTab, setActiveTab] = useState('overview')
  const [ruleTitle, setRuleTitle] = useState('')
  const [ruleContent, setRuleContent] = useState('')
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)

  const [userId, setUserId] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (id) loadPage()
  }, [id])

  async function loadPage() {
    setLoading(true)
    setMessage('')

    const { data: authData } = await supabase.auth.getUser()
    const user = authData.user

    setUserId(user?.id || '')

    const { data: competitionData, error: competitionError } = await supabase
      .from('competitions')
      .select('id, name, region, season, division, description, status, start_date, end_date, registrations_open, image_url')
      .eq('id', id)
      .maybeSingle()

    if (competitionError || !competitionData) {
      setCompetition(null)
      setLoading(false)
      return
    }

    setCompetition(competitionData as Competition)

    if (user) {
      const { data: adminData } = await supabase.rpc('nvpl_can_manage_competitions')
      setIsAdmin(adminData === true)

      const { data: staffData } = await supabase
        .from('club_staff')
        .select('team_id, role')
        .eq('user_id', user.id)

      const managedIds = (staffData || [])
        .filter((staff: { team_id: string; role: string }) =>
          ['manager', 'owner', 'admin', 'club_manager'].includes(
            (staff.role || '').toLowerCase()
          )
        )
        .map((staff: { team_id: string }) => staff.team_id)

      if (managedIds.length) {
        const { data: myTeamData } = await supabase
          .from('teams')
          .select('id, name, abbreviation, badge_url')
          .in('id', managedIds)

        setMyTeams((myTeamData || []) as Team[])
      } else {
        setMyTeams([])
      }
    } else {
      setIsAdmin(false)
      setMyTeams([])
    }

    const { data: ruleData } = await supabase
      .from('nvpl_competition_rules')
      .select('id, competition_id, title, content, display_order')
      .eq('competition_id', id)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true })

    setRules((ruleData || []) as CompetitionRule[])

    const { data: teamRegistrations } = await supabase
      .from('competition_team_registrations')
      .select('team_id')
      .eq('competition_id', id)
      .eq('status', 'registered')

    const teamIds = (teamRegistrations || []).map(
      (registration: { team_id: string }) => registration.team_id
    )

    if (teamIds.length) {
      const { data: teamData } = await supabase
        .from('teams')
        .select('id, name, abbreviation, badge_url')
        .in('id', teamIds)
        .order('name')

      setRegisteredTeams((teamData || []) as Team[])
    } else {
      setRegisteredTeams([])
    }

    if (user) {
      const { data: registrationData } = await supabase
        .from('competition_registrations')
        .select('id, team_id, player_id, status')
        .eq('competition_id', id)
        .eq('status', 'registered')

      const rows = (registrationData || []) as Registration[]
      setRegistrations(rows)

      const playerIds = [...new Set(rows.map(row => row.player_id))]

      if (playerIds.length) {
        const { data: profileData } = await supabase
          .from('player_profiles')
          .select('id, username, gamertag, position, avatar_url')
          .in('id', playerIds)

        setProfiles((profileData || []) as Player[])
      } else {
        setProfiles([])
      }
    } else {
      setRegistrations([])
      setProfiles([])
    }

    const { data: standingData } = await supabase
      .from('nvpl_league_standings')
      .select('team_id, team_name, abbreviation, played, wins, draws, losses, goal_difference, points')
      .eq('competition_id', id)
      .order('points', { ascending: false })
      .order('goal_difference', { ascending: false })
      .limit(5)

    setStandings((standingData || []) as Standing[])

    const { data: fixtureData } = await supabase
      .from('nvpl_fixtures')
      .select('id, home_team_id, away_team_id, matchweek, kickoff_at, status, home_score, away_score')
      .eq('competition_id', id)
      .order('kickoff_at', { ascending: false })
      .limit(20)

    const fixtureRows = (fixtureData || []) as Fixture[]
    setFixtures(fixtureRows)

    const fixtureTeamIds = [
      ...new Set(
        fixtureRows.flatMap(fixture => [
          fixture.home_team_id,
          fixture.away_team_id
        ])
      )
    ]

    if (fixtureTeamIds.length) {
      const { data: fixtureTeamData } = await supabase
        .from('teams')
        .select('id, name, abbreviation, badge_url')
        .in('id', fixtureTeamIds)

      setFixtureTeams((fixtureTeamData || []) as Team[])
    } else {
      setFixtureTeams([])
    }

    const { data: scorerData } = await supabase
      .from('nvpl_competition_player_statistics')
      .select('player_id, username, gamertag, team_name, goals, assists, appearances')
      .eq('competition_id', id)
      .order('goals', { ascending: false })
      .order('assists', { ascending: false })
      .limit(5)

    setTopScorers((scorerData || []) as TopScorer[])

    setLoading(false)
  }

  async function saveRule() {
    if (!competition || !ruleTitle.trim() || !ruleContent.trim()) {
      setMessage('Enter a rule title and description.')
      return
    }

    setSaving(true)
    setMessage('')

    if (editingRuleId) {
      const { error } = await supabase
        .from('nvpl_competition_rules')
        .update({
          title: ruleTitle.trim(),
          content: ruleContent.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', editingRuleId)
        .eq('competition_id', competition.id)

      if (error) {
        setMessage(error.message)
      } else {
        setMessage('Rule section updated.')
        setRuleTitle('')
        setRuleContent('')
        setEditingRuleId(null)
        await loadPage()
      }
    } else {
      const { error } = await supabase
        .from('nvpl_competition_rules')
        .insert({
          competition_id: competition.id,
          title: ruleTitle.trim(),
          content: ruleContent.trim(),
          display_order: rules.length,
          created_by: userId
        })

      if (error) {
        setMessage(error.message)
      } else {
        setMessage('Rule section created.')
        setRuleTitle('')
        setRuleContent('')
        await loadPage()
      }
    }

    setSaving(false)
  }

  function editRule(rule: CompetitionRule) {
    setEditingRuleId(rule.id)
    setRuleTitle(rule.title)
    setRuleContent(rule.content)
    setMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelRuleEdit() {
    setEditingRuleId(null)
    setRuleTitle('')
    setRuleContent('')
  }

  async function deleteRule(ruleId: string) {
    if (!confirm('Delete this rule section? This cannot be undone.')) return

    setSaving(true)
    setMessage('')

    const { error } = await supabase
      .from('nvpl_competition_rules')
      .delete()
      .eq('id', ruleId)
      .eq('competition_id', id)

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Rule section deleted.')
      if (editingRuleId === ruleId) cancelRuleEdit()
      await loadPage()
    }

    setSaving(false)
  }

  async function toggleRegistrations() {
    if (!competition) return

    setSaving(true)
    setMessage('')

    const { error } = await supabase.rpc(
      'nvpl_set_competition_registrations',
      {
        p_competition_id: competition.id,
        p_open: !competition.registrations_open
      }
    )

    if (error) {
      setMessage(error.message)
    } else {
      setMessage(
        competition.registrations_open
          ? 'Registrations closed.'
          : 'Registrations opened.'
      )
      await loadPage()
    }

    setSaving(false)
  }

  async function registerTeam() {
    if (!selectedTeam || !competition) {
      setMessage('Select a club first.')
      return
    }

    setSaving(true)
    setMessage('')

    const { error } = await supabase.rpc(
      'nvpl_register_competition_team',
      {
        p_competition_id: competition.id,
        p_team_id: selectedTeam
      }
    )

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Your club has been registered.')
      await loadPage()
    }

    setSaving(false)
  }

  async function loadPlayers(teamId: string) {
    setSelectedTeam(teamId)
    setSelectedPlayer('')
    setPlayers([])

    if (!teamId) return

    const { data: membershipData, error } = await supabase
      .from('club_memberships')
      .select('player_id')
      .eq('team_id', teamId)
      .is('left_at', null)
      .in('status', ['active', 'accepted', 'approved'])

    if (error) {
      setMessage(error.message)
      return
    }

    const playerIds = (membershipData || []).map(
      (membership: { player_id: string }) => membership.player_id
    )

    if (!playerIds.length) return

    const { data: playerData, error: playerError } = await supabase
      .from('player_profiles')
      .select('id, username, gamertag, position, avatar_url')
      .in('id', playerIds)
      .order('username')

    if (playerError) {
      setMessage(playerError.message)
      return
    }

    setPlayers((playerData || []) as Player[])
  }

  async function registerPlayer() {
    if (!competition || !selectedTeam || !selectedPlayer) {
      setMessage('Select a club and player.')
      return
    }

    setSaving(true)
    setMessage('')

    const { error } = await supabase.rpc(
      'nvpl_register_competition_player',
      {
        p_competition_id: competition.id,
        p_team_id: selectedTeam,
        p_player_id: selectedPlayer
      }
    )

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Player added to the competition roster.')
      await loadPage()
      await loadPlayers(selectedTeam)
    }

    setSaving(false)
  }

  async function removePlayer(registrationId: string) {
    if (!confirm('Remove this player from the competition roster?')) return

    setSaving(true)
    setMessage('')

    const { error } = await supabase.rpc(
      'nvpl_admin_remove_competition_player',
      { p_registration_id: registrationId }
    )

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Player removed from the competition roster.')
      await loadPage()
    }

    setSaving(false)
  }

  function teamName(teamId: string) {
    return (
      registeredTeams.find(team => team.id === teamId)?.name ||
      fixtureTeams.find(team => team.id === teamId)?.name ||
      'Club'
    )
  }

  function playerName(playerId: string) {
    const player = profiles.find(profile => profile.id === playerId)
    return player?.username || player?.gamertag || 'Player'
  }

  function formatDate(date: string | null) {
    if (!date) return 'TBA'

    return new Date(date).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  function formatKickoff(date: string) {
    return new Date(date).toLocaleString('en-AU', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const completedFixtures = fixtures.filter(
    fixture => ['completed', 'finished', 'played'].includes(
      (fixture.status || '').toLowerCase()
    )
  ).slice(0, 5)

  const upcomingFixtures = fixtures
    .filter(fixture =>
      new Date(fixture.kickoff_at).getTime() >= Date.now() &&
      !['completed', 'finished', 'played'].includes(
        (fixture.status || '').toLowerCase()
      )
    )
    .sort(
      (a, b) =>
        new Date(a.kickoff_at).getTime() -
        new Date(b.kickoff_at).getTime()
    )
    .slice(0, 5)

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 text-white p-8">
        Loading competition...
      </main>
    )
  }

  if (!competition) {
    return (
      <main className="min-h-screen bg-gray-950 text-white p-8">
        Competition not found.
      </main>
    )
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'rules', label: 'Rules' },
    { id: 'fixtures', label: 'Fixtures & Results' },
    { id: 'standings', label: 'Standings' },
    { id: 'totw', label: 'Team of the Week' }
  ]

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-7xl mx-auto">

        <a href="/competitions" className="text-blue-400 hover:underline">
          ← All competitions
        </a>

        <section
          className="relative overflow-hidden bg-gray-900 border border-gray-800 rounded-2xl mt-6"
          style={
            competition.image_url
              ? {
                  backgroundImage: `linear-gradient(90deg, rgba(3,7,18,.97), rgba(3,7,18,.65)), url(${competition.image_url})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }
              : undefined
          }
        >
          <div className="p-8 md:p-12">
            <div className="flex flex-wrap justify-between gap-4">
              <span className="text-blue-400 font-bold uppercase tracking-widest text-sm">
                {competition.region}
              </span>

              <span className="bg-gray-800 px-4 py-2 rounded-full text-sm capitalize">
                {competition.status}
              </span>
            </div>

            <h1 className="text-4xl md:text-5xl font-black mt-6">
              {competition.name}
            </h1>

            <p className="text-gray-300 mt-3 text-lg">
              {competition.season} · {competition.division}
            </p>

            {competition.description && (
              <p className="text-gray-300 mt-5 max-w-3xl whitespace-pre-wrap">
                {competition.description}
              </p>
            )}

            <div className="flex flex-wrap gap-3 mt-8">
              <span className="bg-gray-800/90 px-4 py-2 rounded-lg text-sm">
                Starts: {formatDate(competition.start_date)}
              </span>

              <span className="bg-gray-800/90 px-4 py-2 rounded-lg text-sm">
                Ends: {formatDate(competition.end_date)}
              </span>

              <span className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                competition.registrations_open
                  ? 'bg-green-900 text-green-300'
                  : 'bg-red-900 text-red-300'
              }`}>
                Registrations {competition.registrations_open ? 'Open' : 'Closed'}
              </span>
            </div>
          </div>
        </section>

        <div className="flex gap-2 overflow-x-auto mt-8 border-b border-gray-800 pb-3">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id)
                setMessage('')
              }}
              className={`px-5 py-3 rounded-lg font-semibold whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-900 text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {message && (
          <div className="mt-6 bg-gray-900 border border-gray-700 rounded-lg p-4 text-sm">
            {message}
          </div>
        )}

        {activeTab === 'rules' && (
          <section className="mt-8">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
              <div>
                <h2 className="text-3xl font-black">Competition rules</h2>
                <p className="text-gray-400 mt-2">
                  Official rules and regulations for {competition.name}.
                </p>
              </div>
              <span className="bg-gray-800 px-4 py-2 rounded-lg text-sm text-gray-300">
                {rules.length} sections
              </span>
            </div>

            {isAdmin && (
              <div className="bg-gray-900 border border-blue-800 rounded-xl p-6 mb-8">
                <h3 className="text-xl font-bold">
                  {editingRuleId ? 'Edit rule section' : 'Add a rule section'}
                </h3>

                <div className="mt-5">
                  <label className="block text-sm text-gray-400 mb-2">
                    Section title
                  </label>
                  <input
                    value={ruleTitle}
                    onChange={event => setRuleTitle(event.target.value)}
                    placeholder="e.g. Match Rules"
                    maxLength={120}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white"
                  />
                </div>

                <div className="mt-4">
                  <label className="block text-sm text-gray-400 mb-2">
                    Rule description
                  </label>
                  <textarea
                    value={ruleContent}
                    onChange={event => setRuleContent(event.target.value)}
                    placeholder="Write the rules for this section..."
                    rows={8}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white resize-y"
                  />
                </div>

                <div className="flex flex-wrap gap-3 mt-5">
                  <button
                    onClick={saveRule}
                    disabled={saving || !ruleTitle.trim() || !ruleContent.trim()}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-6 py-3 rounded-lg font-semibold"
                  >
                    {saving
                      ? 'Saving...'
                      : editingRuleId
                        ? 'Save changes'
                        : 'Publish rule section'}
                  </button>

                  {editingRuleId && (
                    <button
                      onClick={cancelRuleEdit}
                      disabled={saving}
                      className="bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-lg font-semibold"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            )}

            {rules.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
                <h3 className="text-xl font-bold">No rules published yet</h3>
                <p className="text-gray-400 mt-2">
                  Competition rules will appear here once they have been published.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {rules.map((rule, index) => (
                  <article
                    key={rule.id}
                    className="bg-gray-900 border border-gray-800 rounded-xl p-6"
                  >
                    <div className="flex flex-wrap justify-between items-start gap-4">
                      <div className="flex gap-4">
                        <span className="w-9 h-9 shrink-0 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold">
                          {index + 1}
                        </span>
                        <div>
                          <h3 className="text-xl font-bold">{rule.title}</h3>
                          <p className="text-gray-300 mt-3 whitespace-pre-wrap leading-7">
                            {rule.content}
                          </p>
                        </div>
                      </div>

                      {isAdmin && (
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => editRule(rule)}
                            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-semibold"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteRule(rule.id)}
                            disabled={saving}
                            className="bg-red-600 hover:bg-red-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-semibold"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === 'overview' && (
          <>
            <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <p className="text-gray-400 text-sm">Registered clubs</p>
                <p className="text-3xl font-black mt-2">{registeredTeams.length}</p>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <p className="text-gray-400 text-sm">Registered players</p>
                <p className="text-3xl font-black mt-2">{registrations.length}</p>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <p className="text-gray-400 text-sm">Matches played</p>
                <p className="text-3xl font-black mt-2">{completedFixtures.length}</p>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <p className="text-gray-400 text-sm">Competition status</p>
                <p className="text-xl font-bold mt-3 capitalize">{competition.status}</p>
              </div>
            </section>

            {isAdmin && (
              <section className="mt-8 bg-gray-900 border border-blue-800 rounded-xl p-6">
                <h2 className="text-xl font-bold">Registration controls</h2>
                <p className="text-gray-400 text-sm mt-2">
                  {competition.registrations_open
                    ? 'Registrations are currently open.'
                    : 'Registrations are currently closed.'}
                </p>
                <button
                  onClick={toggleRegistrations}
                  disabled={saving}
                  className={`mt-4 px-6 py-3 rounded-lg font-semibold disabled:opacity-50 ${
                    competition.registrations_open
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {saving
                    ? 'Saving...'
                    : competition.registrations_open
                      ? 'Close registrations'
                      : 'Open registrations'}
                </button>
              </section>
            )}

            {competition.registrations_open && myTeams.length > 0 && (
              <section className="mt-8 bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h2 className="text-2xl font-bold">Club registration</h2>
                <p className="text-gray-400 mt-2">
                  Register your club for this competition.
                </p>
                <div className="flex flex-col md:flex-row gap-3 mt-5">
                  <select
                    value={selectedTeam}
                    onChange={event => loadPlayers(event.target.value)}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg p-3"
                  >
                    <option value="">Select your club</option>
                    {myTeams.map(team => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={registerTeam}
                    disabled={saving || !selectedTeam}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-6 py-3 rounded-lg font-semibold"
                  >
                    Register club
                  </button>
                </div>
              </section>
            )}

            {competition.registrations_open && myTeams.length > 0 && (
              <section className="mt-8 bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h2 className="text-2xl font-bold">Register players</h2>
                <p className="text-gray-400 mt-2">
                  Select players from your club's active membership.
                </p>
                <div className="flex flex-col md:flex-row gap-3 mt-5">
                  <select
                    value={selectedTeam}
                    onChange={event => loadPlayers(event.target.value)}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg p-3"
                  >
                    <option value="">Select your club</option>
                    {myTeams
                      .filter(team =>
                        registeredTeams.some(registered => registered.id === team.id)
                      )
                      .map(team => (
                        <option key={team.id} value={team.id}>{team.name}</option>
                      ))}
                  </select>

                  <select
                    value={selectedPlayer}
                    onChange={event => setSelectedPlayer(event.target.value)}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg p-3"
                  >
                    <option value="">Select a player</option>
                    {players.map(player => (
                      <option key={player.id} value={player.id}>
                        {player.username || player.gamertag}
                        {player.position ? ` · ${player.position}` : ''}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={registerPlayer}
                    disabled={saving || !selectedTeam || !selectedPlayer}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-6 py-3 rounded-lg font-semibold"
                  >
                    Add player
                  </button>
                </div>
              </section>
            )}

            <section className="mt-8 bg-gray-900 border border-gray-800 rounded-xl p-6">
              <div className="flex justify-between items-center gap-3">
                <h2 className="text-2xl font-bold">Registered clubs</h2>
                <span className="text-gray-400 text-sm">{registeredTeams.length} clubs</span>
              </div>

              {registeredTeams.length === 0 ? (
                <p className="text-gray-400 mt-4">No clubs have registered yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
                  {registeredTeams.map(team => (
                    <div key={team.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex items-center gap-4">
                      {team.badge_url ? (
                        <img src={team.badge_url} alt="" className="w-12 h-12 object-contain" />
                      ) : (
                        <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center font-bold">
                          {team.abbreviation || team.name.slice(0, 2)}
                        </div>
                      )}
                      <div>
                        <h3 className="font-bold">{team.name}</h3>
                        <p className="text-sm text-green-400">Registered</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h2 className="text-xl font-bold">Upcoming fixtures</h2>
                {upcomingFixtures.length === 0 ? (
                  <p className="text-gray-400 mt-5">No upcoming fixtures have been scheduled.</p>
                ) : (
                  <div className="space-y-3 mt-5">
                    {upcomingFixtures.map(fixture => (
                      <div key={fixture.id} className="bg-gray-800 rounded-lg p-4">
                        <p className="text-xs text-blue-400 mb-3">
                          {fixture.matchweek ? `Matchweek ${fixture.matchweek}` : 'Upcoming match'}
                        </p>
                        <div className="flex justify-between items-center gap-3">
                          <span className="font-semibold text-sm">{teamName(fixture.home_team_id)}</span>
                          <span className="text-gray-500 font-bold">VS</span>
                          <span className="font-semibold text-sm text-right">{teamName(fixture.away_team_id)}</span>
                        </div>
                        <p className="text-gray-400 text-xs mt-3">{formatKickoff(fixture.kickoff_at)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h2 className="text-xl font-bold">Recent results</h2>
                {completedFixtures.length === 0 ? (
                  <p className="text-gray-400 mt-5">No completed matches yet.</p>
                ) : (
                  <div className="space-y-3 mt-5">
                    {completedFixtures.map(fixture => (
                      <div key={fixture.id} className="bg-gray-800 rounded-lg p-4">
                        <p className="text-xs text-gray-400 mb-3">
                          {fixture.matchweek ? `Matchweek ${fixture.matchweek}` : 'Final result'}
                        </p>
                        <div className="flex justify-between items-center gap-3">
                          <span className="font-semibold text-sm">{teamName(fixture.home_team_id)}</span>
                          <span className="text-xl font-black">{fixture.home_score ?? 0} - {fixture.away_score ?? 0}</span>
                          <span className="font-semibold text-sm text-right">{teamName(fixture.away_team_id)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="mt-8 bg-gray-900 border border-gray-800 rounded-xl p-6">
              <div className="flex justify-between items-center gap-3">
                <h2 className="text-xl font-bold">League standings</h2>
                <span className="text-blue-400 text-sm">Top 5</span>
              </div>
              {standings.length === 0 ? (
                <p className="text-gray-400 mt-5">Standings will appear once the competition table has been populated.</p>
              ) : (
                <div className="overflow-x-auto mt-5">
                  <table className="w-full text-sm text-left">
                    <thead className="text-gray-400 border-b border-gray-700">
                      <tr>
                        <th className="py-3 px-2">#</th>
                        <th className="py-3 px-2">Club</th>
                        <th className="py-3 px-2">P</th>
                        <th className="py-3 px-2">W</th>
                        <th className="py-3 px-2">D</th>
                        <th className="py-3 px-2">L</th>
                        <th className="py-3 px-2">GD</th>
                        <th className="py-3 px-2">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((standing, index) => (
                        <tr key={standing.team_id} className="border-b border-gray-800">
                          <td className="py-3 px-2 font-bold">{index + 1}</td>
                          <td className="py-3 px-2 font-semibold">{standing.team_name}</td>
                          <td className="py-3 px-2">{standing.played}</td>
                          <td className="py-3 px-2">{standing.wins}</td>
                          <td className="py-3 px-2">{standing.draws}</td>
                          <td className="py-3 px-2">{standing.losses}</td>
                          <td className="py-3 px-2">{standing.goal_difference > 0 ? '+' : ''}{standing.goal_difference}</td>
                          <td className="py-3 px-2 font-black text-blue-400">{standing.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="mt-8 bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-bold">Top scorers</h2>
              {topScorers.length === 0 ? (
                <p className="text-gray-400 mt-5">Player statistics will appear once match statistics are recorded.</p>
              ) : (
                <div className="space-y-3 mt-5">
                  {topScorers.map((player, index) => (
                    <div key={player.player_id} className="bg-gray-800 rounded-lg p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <span className="text-gray-400 font-bold">#{index + 1}</span>
                        <div>
                          <p className="font-semibold">{player.username || player.gamertag || 'Player'}</p>
                          <p className="text-gray-400 text-xs">{player.team_name || 'Club'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-black text-blue-400">{player.goals}</p>
                        <p className="text-xs text-gray-400">Goals · {player.assists} assists</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {userId && (
              <section className="mt-8 bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h2 className="text-2xl font-bold">Competition rosters</h2>
                {registrations.length === 0 ? (
                  <p className="text-gray-400 mt-4">No player registrations are visible yet.</p>
                ) : (
                  <div className="space-y-3 mt-5">
                    {registrations.map(registration => (
                      <div key={registration.id} className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex flex-wrap justify-between items-center gap-3">
                        <div>
                          <p className="font-semibold">{playerName(registration.player_id)}</p>
                          <p className="text-sm text-gray-400">{teamName(registration.team_id)}</p>
                        </div>
                        {isAdmin && (
                          <button
                            onClick={() => removePlayer(registration.id)}
                            disabled={saving}
                            className="bg-red-600 hover:bg-red-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-semibold"
                          >
                            Remove player
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}

        {activeTab === 'fixtures' && (
          <section className="mt-8 bg-gray-900 border border-gray-800 rounded-xl p-8">
            <h2 className="text-2xl font-bold">Fixtures & Results</h2>
            <p className="text-gray-400 mt-3">
              The full fixture management system is coming next.
            </p>
          </section>
        )}

        {activeTab === 'standings' && (
          <section className="mt-8 bg-gray-900 border border-gray-800 rounded-xl p-8">
            <h2 className="text-2xl font-bold">Full standings</h2>
            <p className="text-gray-400 mt-3">
              The full standings page is coming next.
            </p>
          </section>
        )}

        {activeTab === 'totw' && (
          <section className="mt-8 bg-gray-900 border border-gray-800 rounded-xl p-8">
            <h2 className="text-2xl font-bold">Team of the Week</h2>
            <p className="text-gray-400 mt-3">
              Team of the Week selection is coming next.
            </p>
          </section>
        )}

      </div>
    </main>
  )
}

export default function CompetitionPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-950 text-white p-8">
          Loading competition...
        </main>
      }
    >
      <CompetitionPageContent />
    </Suspense>
  )
}
