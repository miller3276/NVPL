
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

const TIMEZONES = [
  { label: 'Brisbane / Queensland', value: 'Australia/Brisbane' },
  { label: 'Sydney / Melbourne', value: 'Australia/Sydney' },
  { label: 'Adelaide', value: 'Australia/Adelaide' },
  { label: 'Perth', value: 'Australia/Perth' },
  { label: 'Auckland / New Zealand', value: 'Pacific/Auckland' },
  { label: 'London', value: 'Europe/London' },
  { label: 'Berlin / Central Europe', value: 'Europe/Berlin' },
  { label: 'New York / Eastern USA', value: 'America/New_York' },
  { label: 'Chicago / Central USA', value: 'America/Chicago' },
  { label: 'Los Angeles / Pacific USA', value: 'America/Los_Angeles' },
]

function getZonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value)

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  }
}

function toZonedInput(value: string, timeZone: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return ''

  const parts = getZonedParts(date, timeZone)

  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}T${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`
}

function zonedInputToUtc(value: string, timeZone: string) {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
  )

  if (!match) throw new Error('Please enter a valid kickoff time.')

  const [, y, mo, d, h, mi] = match
  const target = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi)
  )

  let result = target

  for (let i = 0; i < 4; i++) {
    const parts = getZonedParts(new Date(result), timeZone)

    const represented = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute
    )

    const difference = target - represented

    if (difference === 0) break

    result += difference
  }

  const check = getZonedParts(new Date(result), timeZone)

  if (
    check.year !== Number(y) ||
    check.month !== Number(mo) ||
    check.day !== Number(d) ||
    check.hour !== Number(h) ||
    check.minute !== Number(mi)
  ) {
    throw new Error(
      'That local time is invalid or ambiguous because of daylight saving time. Please choose another kickoff time.'
    )
  }

  return new Date(result).toISOString()
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
  const [timezone, setTimezone] = useState('Australia/Brisbane')
  const [savedTimezone, setSavedTimezone] = useState('Australia/Brisbane')
  const [loading, setLoading] = useState(false)
  const [savingTimezone, setSavingTimezone] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function loadFixtures() {
    const { data: competition, error: competitionError } = await supabase
      .from('competitions')
      .select('schedule_timezone')
      .eq('id', competitionId)
      .single()

    if (competitionError) {
      setError(competitionError.message)
      return
    }

    const loadedTimezone =
      competition?.schedule_timezone || 'Australia/Brisbane'

    setTimezone(loadedTimezone)
    setSavedTimezone(loadedTimezone)

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
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('id, name')
        .in('id', teamIds)

      if (teamError) {
        setError(teamError.message)
        return
      }

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

  async function saveTimezone() {
    setSavingTimezone(true)
    setError('')
    setMessage('')

    const { error } = await supabase
      .from('competitions')
      .update({ schedule_timezone: timezone })
      .eq('id', competitionId)

    setSavingTimezone(false)

    if (error) {
      setError(error.message)
      return
    }

    setSavedTimezone(timezone)
    setMessage('Competition timezone saved.')
  }

  async function generateSchedule() {
    setLoading(true)
    setError('')
    setMessage('')

    const { error: timezoneError } = await supabase
      .from('competitions')
      .update({ schedule_timezone: timezone })
      .eq('id', competitionId)

    if (timezoneError) {
      setLoading(false)
      setError(timezoneError.message)
      return
    }

    const { data, error } = await supabase.rpc(
      'nvpl_generate_fixture_schedule',
      {
        p_competition_id: competitionId,
        p_start_date: startDate,
        p_end_date: endDate,
        p_kickoff_time: kickoffTime,
        p_slot_minutes: slotMinutes,
        p_timezone: timezone,
      }
    )

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setSavedTimezone(timezone)
    setMessage(`${data} fixtures generated successfully.`)
    await loadFixtures()
  }

  async function saveKickoff(fixtureId: string) {
    const value = editing[fixtureId]

    if (!value) return

    setSavingId(fixtureId)
    setError('')
    setMessage('')

    let kickoffAt: string

    try {
      kickoffAt = zonedInputToUtc(value, timezone)
    } catch (err) {
      setSavingId(null)
      setError(
        err instanceof Error ? err.message : 'Invalid kickoff time.'
      )
      return
    }

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

  function displayKickoff(value: string) {
    return new Intl.DateTimeFormat('en-AU', {
      timeZone: timezone,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(value))
  }

  return (
    <div className="space-y-6 rounded-2xl border border-white/10 bg-[#080b12] p-5 text-white">
      <div>
        <h2 className="text-xl font-bold">Fixture Scheduler</h2>
        <p className="mt-1 text-sm text-gray-400">
          Generate a single round-robin schedule and manage kickoff times.
        </p>
      </div>

      <div className="space-y-2">
        <label className="block text-sm text-gray-400">
          Competition timezone
        </label>

        <select
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
          className="w-full rounded-lg border border-white/10 bg-[#111827] p-3 text-white"
        >
          {TIMEZONES.map((zone) => (
            <option key={zone.value} value={zone.value}>
              {zone.label}
            </option>
          ))}
        </select>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={saveTimezone}
            disabled={savingTimezone || timezone === savedTimezone}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-40"
          >
            {savingTimezone ? 'Saving...' : 'Save timezone'}
          </button>

          <span className="text-xs text-gray-500">
            All competition kickoff times use this timezone.
          </span>
        </div>
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
            disabled={
              loading ||
              !startDate ||
              !endDate ||
              slotMinutes < 1
            }
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Generate Fixtures'}
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Competition dates: {startDate || 'Not set'} to {endDate || 'Not set'}
        {' · '}Timezone: {timezone}
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
          Fixtures ({fixtures.length})
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

                <p className="mb-2 text-sm text-gray-400">
                  Current kickoff: {displayKickoff(fixture.kickoff_at)}
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="datetime-local"
                    value={
                      editing[fixture.id] ??
                      toZonedInput(fixture.kickoff_at, timezone)
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
                      editing[fixture.id] ===
                        toZonedInput(fixture.kickoff_at, timezone)
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
