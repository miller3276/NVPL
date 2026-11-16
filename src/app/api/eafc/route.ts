
import { NextRequest, NextResponse } from 'next/server'
import { ProClubsClient } from 'proclubs-sdk'

const ea = new ProClubsClient({ cache: true })

const VALID_PLATFORMS = ['common-gen5', 'nx'] as const

type EAPlatform = (typeof VALID_PLATFORMS)[number]

type MatchRecord = {
  matchId?: string | number
  timestamp?: number
  clubs?: Record<string, unknown>
  players?: Record<string, Record<string, Record<string, unknown>>>
}

function validClubId(value: string | null) {
  if (!value || !/^\d+$/.test(value)) return null

  const id = Number(value)

  return Number.isSafeInteger(id) && id > 0 ? id : null
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const mode = params.get('mode')
  const clubName = params.get('name')?.trim()
  const platform = params.get('platform') ?? 'common-gen5'

  if (!VALID_PLATFORMS.includes(platform as EAPlatform)) {
    return NextResponse.json(
      { error: 'Unsupported EA platform.' },
      { status: 400 }
    )
  }

  const selectedPlatform = platform as EAPlatform

  try {
    // DISCOVER PLAYERS FROM RECENT CLUB MATCHES
    if (mode === 'clubPlayers') {
      const clubId = validClubId(params.get('clubId'))

      if (!clubId) {
        return NextResponse.json(
          { error: 'A valid EA club ID is required.' },
          { status: 400 }
        )
      }

      const matches = await ea.matches.list({
        clubId,
        platform: selectedPlatform,
        type: 'leagueMatch',
        limit: 20,
      })

      const discovered = new Map<
        string,
        {
          eaPlayerId: string
          name: string
          position: string
          matchesSeen: number
        }
      >()

      for (const match of (matches || []) as unknown as MatchRecord[]) {
        const clubPlayers = match.players?.[String(clubId)]

        if (!clubPlayers) continue

        for (const [eaPlayerId, stats] of Object.entries(clubPlayers)) {
          const name = String(stats.playername || '').trim()

          if (!name) continue

          const existing = discovered.get(eaPlayerId)

          if (existing) {
            existing.matchesSeen += 1
          } else {
            discovered.set(eaPlayerId, {
              eaPlayerId,
              name,
              position: String(stats.pos || ''),
              matchesSeen: 1,
            })
          }
        }
      }

      return NextResponse.json({
        success: true,
        players: Array.from(discovered.values()).sort(
          (a, b) => a.name.localeCompare(b.name)
        ),
        matchesChecked: matches?.length || 0,
      })
    }

    // AUTOMATIC FIXTURE MATCH SEARCH
    if (mode === 'fixtureMatches') {
      const homeClubId = validClubId(params.get('homeClubId'))
      const awayClubId = validClubId(params.get('awayClubId'))

      if (!homeClubId || !awayClubId) {
        return NextResponse.json(
          { error: 'Both EA club IDs must be valid.' },
          { status: 400 }
        )
      }

      if (homeClubId === awayClubId) {
        return NextResponse.json(
          { error: 'The two teams cannot use the same EA club.' },
          { status: 400 }
        )
      }

      const [homeHistory, awayHistory] = await Promise.all([
        ea.matches.list({
          clubId: homeClubId,
          platform: selectedPlatform,
          type: 'leagueMatch',
          limit: 20,
        }),
        ea.matches.list({
          clubId: awayClubId,
          platform: selectedPlatform,
          type: 'leagueMatch',
          limit: 20,
        }),
      ])

      const combined = [
        ...(homeHistory || []),
        ...(awayHistory || []),
      ] as unknown as MatchRecord[]

      const uniqueMatches = new Map<string, MatchRecord>()

      for (const match of combined) {
        if (!match.matchId || !match.clubs) continue
        uniqueMatches.set(String(match.matchId), match)
      }

      const matchingMatches = Array.from(uniqueMatches.values())
        .filter(match => {
          const clubIds = Object.keys(match.clubs || {})

          return (
            clubIds.includes(String(homeClubId)) &&
            clubIds.includes(String(awayClubId))
          )
        })
        .sort(
          (a, b) =>
            Number(b.timestamp || 0) - Number(a.timestamp || 0)
        )

      return NextResponse.json({
        success: true,
        matches: matchingMatches,
        count: matchingMatches.length,
        syncedAt: new Date().toISOString(),
      })
    }

    // EXISTING TEAM SETTINGS CLUB SEARCH
    if (!clubName || clubName.length > 60) {
      return NextResponse.json(
        { error: 'Enter a valid EA club name.' },
        { status: 400 }
      )
    }

    const clubs = await ea.clubs.search({
      name: clubName,
      platform: selectedPlatform,
    })

    if (!clubs.length) {
      return NextResponse.json(
        { error: 'No matching EA club found.' },
        { status: 404 }
      )
    }

    if (params.get('search') === '1') {
      return NextResponse.json({
        success: true,
        clubs,
      })
    }

    const club = clubs[0]

    const [info, overallStats, members, matches] =
      await Promise.all([
        ea.clubs.get({
          clubId: club.clubId,
          platform: selectedPlatform,
        }),
        ea.clubs.overallStats({
          clubId: club.clubId,
          platform: selectedPlatform,
        }),
        ea.members.stats({
          clubId: club.clubId,
          platform: selectedPlatform,
        }),
        ea.matches.list({
          clubId: club.clubId,
          platform: selectedPlatform,
          type: 'leagueMatch',
          limit: 10,
        }),
      ])

    return NextResponse.json({
      success: true,
      club,
      info,
      overallStats,
      members,
      matches,
      syncedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('EA FC error:', error)

    return NextResponse.json(
      {
        error: 'EA FC data could not be retrieved.',
        details:
          error instanceof Error
            ? error.message
            : 'Unknown error',
      },
      { status: 502 }
    )
  }
}
