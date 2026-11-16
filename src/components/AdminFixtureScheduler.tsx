
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Fixture = {
  id: string
  competition_id: string
  home_team_id: string
  away_team_id: string
  matchweek: number
  kickoff_at: string
  status: string
  schedule_generated?: boolean
  schedule_manually_edited?: boolean
}

type Team = {
  id: string
  name: string
}

type Props = {
  competitionId: string
  startDate: string
  endDate: string
}

function toLocalInput(value: string) {
  const date = new Date(value)
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60000)
    .toISOString()
    .slice(0, 16)
}

export default function AdminFixtureScheduler({
  competitionId,
  startDate,
  endDate,
}: Props) {
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [kickoffTime, setKickoffTime] = useState('19:00')
  const [slotMinutes, setSlotMinutes] = useState(30)
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function loadFixtures() {
    const { data, error } = await supabase
      .from('nvpl_fixtures')
      .select('*')
      .eq('competition_id', competitionId)
      .order('matchweek', { ascending: true })
      .order('kickoff_at', { ascending: true })

    if (error) {
      setError(error.message)
      return
    }

    const fixtureRows = (data || []) as Fixture[]
    setFixtures(fixtureRows)

    const teamIds = Array.from(
      new Set(
        fixtureRows.flatMap((fixture) => [
          fixture.home_team_id,
          fixture.away_team_id,
        ])
      )
    )

    if (teamIds.length) {
      const { data: teamData } = await supabase
        .from('teams')
        .select('id, name')
        .in('id', teamIds)

      setTeams((teamData || []) as Team[])
    } else {
      setTeams([])
    }
  }

  useEffect(() => {
    loadFixtures()
  }, [competitionId])

  function teamName(id: string) {
    return teams.find((team) => team.id === id)?.name || id
  }

  async function generateSchedule() {
    setLoading(true)
    setError('')
    setMessage('')

    const { data, error } = await supabase.rpc(
      'nvpl_generate_fixture_schedule',
      {
        p_competition_id: competitionId,
        p_start_date: startDate,
        p_end_date: endDate,
        p_kickoff_time: kickoffTime,
        p_slot_minutes: slotMinutes,
        p_timezone: 'Australia/Brisbane',
      }
    )

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setMessage(`${data} fixtures generated successfully.`)
    await loadFixtures()
  }

  async function saveKickoff(fixtureId: string) {
    const value = editing[fixtureId]

    if (!value) return

    setSavingId(fixtureId)
    setError('')
    setMessage('')

    const kickoffAt = new Date(value).toISOString()

    const { error } = await supabase
      .from('nvpl_fixtures')
      .update({
        kickoff_at: kickoffAt,
        schedule_manually_edited: true,
      })
      .eq('id', fixtureId)
      .eq('competition_id', competitionId)

    setSavingId(null)

    if (error) {
      setError(error.message)
      return
    }

    setMessage('Fixture kickoff time updated.')
    setEditing((previous) => {
      const next = { ...previous }
      delete next[fixtureId]
      return next
    })

    await loadFixtures()
  }

  return (
    <div className="space-y-6 rounded-2xl border border-white/10 bg-[#080b12] p-5 text-white">
      <div>
        <h2 className="text-xl font-bold">Fixture Scheduler</h2>
        <p className="mt-1 text-sm text-gray-400">
          Generate a single round-robin schedule and manage kickoff times.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-2 block text-sm text-gray-400">
            First kickoff
          </label>
          <input
            type="time"
            value={kickoffTime}
            onChange={(event) => setKickoffTime(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-[#111827] p-3"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-gray-400">
            Minutes between matches
          </label>
          <input
            type="number"
            min={1}
            max={240}
            value={slotMinutes}
            onChange={(event) =>
              setSlotMinutes(Number(event.target.value))
            }
            className="w-full rounded-lg border border-white/10 bg-[#111827] p-3"
          />
        </div>

        <div className="flex items-end">
          <button
            onClick={generateSchedule}
            disabled={loading || !startDate || !endDate}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Generate Fixtures'}
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Competition dates: {startDate || 'Not set'} to {endDate || 'Not set'}
        {' · '}Timezone: Australia/Brisbane
      </p>

      {message && (
        <p className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-400">
          {message}
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </p>
      )}

      <div>
        <h3 className="mb-3 font-semibold">
          Generated Fixtures ({fixtures.length})
        </h3>

        {fixtures.length === 0 ? (
          <p className="text-sm text-gray-500">
            No fixtures have been generated for this competition yet.
          </p>
        ) : (
          <div className="space-y-3">
            {fixtures.map((fixture) => (
              <div
                key={fixture.id}
                className="rounded-xl border border-white/10 bg-[#111827] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-blue-400">
                    Matchweek {fixture.matchweek}
                  </span>

                  <span className="text-xs text-gray-500">
                    {fixture.schedule_manually_edited
                      ? 'Manually edited'
                      : fixture.schedule_generated
                        ? 'Auto scheduled'
                        : 'Existing fixture'}
                  </span>
                </div>

                <div className="my-3 font-semibold">
                  {teamName(fixture.home_team_id)}
                  <span className="mx-3 text-gray-500">vs</span>
                  {teamName(fixture.away_team_id)}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="datetime-local"
                    value={
                      editing[fixture.id] ??
                      toLocalInput(fixture.kickoff_at)
                    }
                    onChange={(event) =>
                      setEditing((previous) => ({
                        ...previous,
                        [fixture.id]: event.target.value,
                      }))
                    }
                    className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#080b12] p-2 text-sm"
                  />

                  <button
                    onClick={() => saveKickoff(fixture.id)}
                    disabled={
                      savingId === fixture.id ||
                      !editing[fixture.id] ||
                      editing[fixture.id] === toLocalInput(fixture.kickoff_at)
                    }
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold hover:bg-blue-500 disabled:opacity-40"
                  >
                    {savingId === fixture.id ? 'Saving...' : 'Save time'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
