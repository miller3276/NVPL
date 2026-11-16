
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Props = {
  competitionId?: string
  playerId?: string
  teamId?: string
}

type BadgeDefinition = {
  code: string
  name: string
  tier: 'Diamond' | 'Platinum' | 'Gold'
  scope: 'club' | 'player'
  description: string | null
  icon: string
  display_order: number
}

type Award = {
  id: string
  badge_code: string
  competition_id: string
  team_id: string | null
  player_id: string | null
  status: string
  awarded_at: string | null
  note: string | null
  definition?: {
    name: string
    tier: string
    description: string | null
    icon: string
  }
  competition?: {
    name: string
    season: string | null
  }
}

type Recipient = {
  id: string
  name: string
}

export default function NVPLBadges({
  competitionId,
  playerId,
  teamId
}: Props) {
  const [badges, setBadges] = useState<Award[]>([])
  const [definitions, setDefinitions] = useState<BadgeDefinition[]>([])
  const [teams, setTeams] = useState<Recipient[]>([])
  const [players, setPlayers] = useState<Recipient[]>([])
  const [selectedBadge, setSelectedBadge] = useState('')
  const [selectedRecipient, setSelectedRecipient] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [removingBadgeId, setRemovingBadgeId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const mode = competitionId
    ? 'competition'
    : playerId
      ? 'player'
      : teamId
        ? 'club'
        : 'none'

  async function loadBadges() {
    if (mode === 'none') {
      setLoading(false)
      return
    }

    let query = (supabase as any)
      .from('nvpl_awarded_badges')
      .select(`
        id,
        badge_code,
        competition_id,
        team_id,
        player_id,
        status,
        awarded_at,
        note,
        definition:nvpl_badge_definitions (
          name,
          tier,
          description,
          icon
        ),
        competition:competitions (
          name,
          season
        )
      `)

    if (competitionId) {
      query = query.eq('competition_id', competitionId)
    } else if (playerId) {
      query = query.eq('player_id', playerId)
    } else if (teamId) {
      query = query.eq('team_id', teamId)
    }

    const { data, error: loadError } = await query
      .eq('status', 'approved')
      .order('awarded_at', { ascending: false })

    if (loadError) {
      setError(loadError.message)
    } else {
      setBadges((data || []) as Award[])
    }
  }

  async function loadAdminTools() {
    if (!competitionId) return

    const { data: adminResult, error: adminError } =
      await supabase.rpc('nvpl_can_manage_competitions')

    if (adminError || !adminResult) {
      setIsAdmin(false)
      return
    }

    setIsAdmin(true)

    const [
      { data: badgeData },
      { data: teamData },
      { data: playerData }
    ] = await Promise.all([
      (supabase as any)
        .from('nvpl_badge_definitions')
        .select('code, name, tier, scope, description, icon, display_order')
        .eq('active', true)
        .order('display_order'),

      supabase
        .from('teams')
        .select('id, name')
        .order('name'),

      supabase
        .from('player_profiles')
        .select('id, username, gamertag')
        .order('username')
    ])

    setDefinitions((badgeData || []) as BadgeDefinition[])

    setTeams(
      (teamData || []).map((team: any) => ({
        id: team.id,
        name: team.name
      }))
    )

    setPlayers(
      (playerData || []).map((player: any) => ({
        id: player.id,
        name: player.username
          ? `@${player.username} (${player.gamertag})`
          : player.gamertag
      }))
    )
  }

  async function refresh() {
    setLoading(true)
    setError('')

    await Promise.all([
      loadBadges(),
      loadAdminTools()
    ])

    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [competitionId, playerId, teamId])

  const currentDefinition = definitions.find(
    badge => badge.code === selectedBadge
  )

  async function createAward() {
    if (!competitionId || !selectedBadge || !selectedRecipient) return

    setSaving(true)
    setError('')
    setMessage('')

    let result: any

    if (currentDefinition?.scope === 'club') {
      result = await supabase.rpc('nvpl_create_club_badge_award', {
        p_competition_id: competitionId,
        p_badge_code: selectedBadge,
        p_team_id: selectedRecipient,
        p_note: null
      })
    } else {
      result = await supabase.rpc('nvpl_create_player_badge_award', {
        p_competition_id: competitionId,
        p_badge_code: selectedBadge,
        p_player_id: selectedRecipient,
        p_note: null
      })
    }

    if (result.error) {
      setError(result.error.message)
    } else {
      setMessage(
        'Draft award created. Approve it to publish the badge.'
      )
      setSelectedBadge('')
      setSelectedRecipient('')
      await loadBadges()
    }

    setSaving(false)
  }

  async function approveAwards() {
    if (!competitionId) return

    setSaving(true)
    setError('')
    setMessage('')

    const { data, error: approveError } = await supabase.rpc(
      'nvpl_approve_competition_badges',
      { p_competition_id: competitionId }
    )

    if (approveError) {
      setError(approveError.message)
    } else {
      setMessage(`${data} badge awards approved and published.`)
      await loadBadges()
    }

    setSaving(false)
  }

  async function removeAward(badge: Award) {
    const badgeName = badge.definition?.name || badge.badge_code

    const confirmed = window.confirm(
      `Are you sure you want to permanently remove "${badgeName}"? This will also remove it from the recipient's achievements.`
    )

    if (!confirmed) return

    setRemovingBadgeId(badge.id)
    setError('')
    setMessage('')

    const { error: removeError } = await supabase.rpc(
      'nvpl_admin_remove_badge_award',
      { p_award_id: badge.id }
    )

    if (removeError) {
      setError(removeError.message)
    } else {
      setBadges(current => current.filter(item => item.id !== badge.id))
      setMessage(`${badgeName} has been removed successfully.`)
    }

    setRemovingBadgeId(null)
  }

  function tierStyle(tier?: string) {
    switch (tier) {
      case 'Diamond':
        return 'border-cyan-400/60 bg-cyan-400/10 text-cyan-200'
      case 'Platinum':
        return 'border-purple-400/60 bg-purple-400/10 text-purple-200'
      default:
        return 'border-yellow-500/60 bg-yellow-500/10 text-yellow-200'
    }
  }

  const heading = mode === 'competition'
    ? 'Competition Badges'
    : mode === 'player'
      ? 'Player Achievements'
      : 'Club Achievements'

  if (mode === 'none') return null

  return (
    <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mt-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <p className="text-blue-400 text-xs font-bold tracking-widest">
            NVPL ACHIEVEMENTS
          </p>
          <h2 className="text-2xl font-bold mt-1">{heading}</h2>
        </div>

        <span className="text-sm text-gray-400">
          {badges.length} earned
        </span>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading badges...</p>
      ) : badges.length === 0 ? (
        <div className="border border-dashed border-gray-700 rounded-xl p-8 text-center">
          <div className="text-4xl mb-3">🏅</div>
          <p className="font-bold">No badges awarded yet</p>
          <p className="text-gray-500 text-sm mt-2">
            Competition achievements will appear here once approved.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {badges.map(badge => (
            <div
              key={badge.id}
              className={`border rounded-xl p-4 ${tierStyle(badge.definition?.tier)}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl bg-black/20 flex items-center justify-center text-3xl">
                  {badge.definition?.icon || '🏅'}
                </div>

                <div className="min-w-0">
                  <p className="font-bold">
                    {badge.definition?.name || badge.badge_code}
                  </p>
                  <p className="text-xs uppercase font-bold tracking-wider opacity-80">
                    {badge.definition?.tier || 'Achievement'}
                  </p>
                </div>
              </div>

              {badge.definition?.description && (
                <p className="text-sm mt-3 opacity-80">
                  {badge.definition.description}
                </p>
              )}

              {badge.competition?.name && (
                <p className="text-xs mt-3 opacity-80">
                  {badge.competition.name}
                  {badge.competition.season
                    ? ` · ${badge.competition.season}`
                    : ''}
                </p>
              )}

              {badge.awarded_at && (
                <p className="text-xs mt-2 opacity-60">
                  Awarded {new Date(badge.awarded_at).toLocaleDateString()}
                </p>
              )}

              {mode === 'competition' && isAdmin && (
                <button
                  onClick={() => removeAward(badge)}
                  disabled={removingBadgeId === badge.id}
                  className="mt-4 w-full rounded-lg border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 px-3 py-2 text-sm font-bold text-red-300"
                >
                  {removingBadgeId === badge.id
                    ? 'Removing...'
                    : 'Remove Badge'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="text-red-400 text-sm mt-4">{error}</p>
      )}

      {message && (
        <p className="text-emerald-400 text-sm mt-4">{message}</p>
      )}

      {mode === 'competition' && isAdmin && (
        <div className="border-t border-gray-800 mt-7 pt-6">
          <h3 className="text-lg font-bold">Admin Badge Management</h3>

          <p className="text-sm text-gray-400 mt-1">
            Create awards for review, approve them to publish, or remove
            an existing award.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            <select
              value={selectedBadge}
              onChange={event => {
                setSelectedBadge(event.target.value)
                setSelectedRecipient('')
              }}
              className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-white"
            >
              <option value="">Select achievement</option>
              {definitions.map(definition => (
                <option key={definition.code} value={definition.code}>
                  {definition.icon} {definition.name} — {definition.tier}
                </option>
              ))}
            </select>

            <select
              value={selectedRecipient}
              onChange={event => setSelectedRecipient(event.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-white"
              disabled={!selectedBadge}
            >
              <option value="">Select recipient</option>
              {(currentDefinition?.scope === 'club' ? teams : players).map(
                recipient => (
                  <option key={recipient.id} value={recipient.id}>
                    {recipient.name}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="flex flex-wrap gap-3 mt-4">
            <button
              onClick={createAward}
              disabled={saving || !selectedBadge || !selectedRecipient}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-5 py-3 rounded-lg font-bold"
            >
              {saving ? 'Processing...' : 'Create Draft Award'}
            </button>

            <button
              onClick={approveAwards}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-5 py-3 rounded-lg font-bold"
            >
              Approve & Publish Awards
            </button>
          </div>

          <p className="text-xs text-gray-500 mt-3">
            Club awards also create draft badges for players who meet the
            15% appearance requirement.
          </p>
        </div>
      )}
    </section>
  )
}
