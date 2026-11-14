
import { NextRequest, NextResponse } from 'next/server'
import { ProClubsClient } from 'proclubs-sdk'

const ea = new ProClubsClient({ cache: true })

export async function GET(request: NextRequest) {
  const clubName = request.nextUrl.searchParams.get('name')?.trim()
  const platform = request.nextUrl.searchParams.get('platform') ?? 'common-gen5'

  if (!clubName || clubName.length > 60) {
    return NextResponse.json(
      { error: 'Enter a valid EA club name.' },
      { status: 400 }
    )
  }

  if (!['common-gen5', 'nx'].includes(platform)) {
    return NextResponse.json(
      { error: 'Unsupported EA platform.' },
      { status: 400 }
    )
  }

  try {
    const selectedPlatform = platform as 'common-gen5' | 'nx'

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
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 502 }
    )
  }
}
