
'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Team = {
  id: string
  name: string
  abbreviation: string
}

type Player = {
  id: string
  user_id: string
  username: string | null
  gamertag: string
  position: string | null
  market_value_millions: number
  avatar_url: string | null
}

type Listing = {
  id: string
  player_id: string | null
  team_id: string
  player_username: string
  gamertag: string | null
  position: string | null
  asking_value: number | null
  description: string | null
  status: string
  created_at: string
}

type Offer = {
  id: string
  listing_id: string
  player_id: string
  seller_team_id: string
  buyer_team_id: string
  offer_amount: number
  message: string | null
  status: string
  created_at: string
}

type History = {
  id: string
  player_id: string
  from_team_id: string
  to_team_id: string
  transfer_value: number
  completed_at: string
}

type Membership = {
  id: string
  team_id: string
  player_id: string
  primary_position: string | null
  status: string
}

type Tab = 'market' | 'offers' | 'history' | 'list'

export default function MarketPage() {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [tab, setTab] = useState<Tab>('market')

  const [userId, setUserId] = useState('')
  const [teams, setTeams] = useState<Team[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [listings, setListings] = useState<Listing[]>([])
  const [offers, setOffers] = useState<Offer[]>([])
  const [history, setHistory] = useState<History[]>([])

  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [askingValue, setAskingValue] = useState('0')
  const [description, setDescription] = useState('')

  const [offerListing, setOfferListing] = useState('')
  const [buyerTeam, setBuyerTeam] = useState('')
  const [offerAmount, setOfferAmount] = useState('')
  const [offerMessage, setOfferMessage] = useState('')

  const teamName = (id: string) =>
    teams.find(team => team.id === id)?.name || 'Unknown club'

  const playerName = (id: string) => {
    const player = players.find(item => item.id === id)
    return player?.gamertag || player?.username || 'Player'
  }

  const formatValue = (value: number | null | undefined) =>
    `${Number(value || 0).toLocaleString()} credits`

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser()

      if (authError) throw authError
      if (!authData.user) throw new Error('Please log in to access the market.')

      const uid = authData.user.id
      setUserId(uid)

      const { data: staffData, error: staffError } = await supabase
        .from('club_staff')
        .select('team_id')
        .eq('user_id', uid)

      if (staffError) throw staffError

      const staffTeamIds = (staffData || []).map(
        (item: { team_id: string }) => item.team_id
      )

      const { data: ownedTeams, error: ownedError } = await supabase
        .from('teams')
        .select('id, name, abbreviation')
        .eq('owner_id', uid)

      if (ownedError) throw ownedError

      const { data: staffTeams, error: staffTeamsError } =
        staffTeamIds.length
          ? await supabase
              .from('teams')
              .select('id, name, abbreviation')
              .in('id', staffTeamIds)
          : { data: [], error: null }

      if (staffTeamsError) throw staffTeamsError

      const allTeams = [
        ...(ownedTeams || []),
        ...(staffTeams || [])
      ]

      const uniqueTeams = Array.from(
        new Map(allTeams.map(team => [team.id, team])).values()
      ) as Team[]

      setTeams(uniqueTeams)

      const teamIds = uniqueTeams.map(team => team.id)

      const { data: listingData, error: listingError } = await supabase
        .from('nvpl_transfer_listings')
        .select('*')
        .order('created_at', { ascending: false })

      if (listingError) throw listingError
      setListings((listingData || []) as Listing[])

      const { data: offerData, error: offerError } = await supabase
        .from('nvpl_transfer_offers')
        .select('*')
        .order('created_at', { ascending: false })

      if (offerError) throw offerError
      setOffers((offerData || []) as Offer[])

      const { data: historyData, error: historyError } = await supabase
        .from('nvpl_transfer_history')
        .select('*')
        .order('completed_at', { ascending: false })

      if (historyError) throw historyError
      setHistory((historyData || []) as History[])

      const { data: membershipData, error: membershipError } =
        teamIds.length
          ? await supabase
              .from('club_memberships')
              .select('id, team_id, player_id, primary_position, status')
              .in('team_id', teamIds)
              .eq('status', 'active')
          : { data: [], error: null }

      if (membershipError) throw membershipError
      setMemberships((membershipData || []) as Membership[])

      const playerIds = Array.from(
        new Set([
          ...(membershipData || []).map(
            (membership: Membership) => membership.player_id
          ),
          ...(listingData || [])
            .map((listing: Listing) => listing.player_id)
            .filter(Boolean),
          ...(historyData || []).map(
            (item: History) => item.player_id
          )
        ])
      )

      if (playerIds.length) {
        const { data: playerData, error: playerError } = await supabase
          .from('player_profiles')
          .select(
            'id, user_id, username, gamertag, position, market_value_millions, avatar_url'
          )
          .in('id', playerIds)

        if (playerError) throw playerError
        setPlayers((playerData || []) as Player[])
      } else {
        setPlayers([])
      }
    } catch (err: any) {
      setError(err.message || 'Could not load the transfer market.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const createListing = async () => {
    if (!selectedPlayer) {
      setError('Choose a player first.')
      return
    }

    const value = Number(askingValue)

    if (!Number.isFinite(value) || value < 0) {
      setError('Enter a valid asking value.')
      return
    }

    setBusy(true)
    setError('')
    setSuccess('')

    try {
      const { error: rpcError } = await supabase.rpc(
        'nvpl_create_transfer_listing',
        {
          p_player_id: selectedPlayer,
          p_asking_value: value,
          p_description: description.trim() || null
        }
      )

      if (rpcError) throw rpcError

      setSuccess('Player successfully listed on the market.')
      setSelectedPlayer('')
      setAskingValue('0')
      setDescription('')
      await loadData()
      setTab('market')
    } catch (err: any) {
      setError(err.message || 'Could not create the listing.')
    } finally {
      setBusy(false)
    }
  }

  const submitOffer = async () => {
    if (!offerListing || !buyerTeam) {
      setError('Choose a listing and buying club.')
      return
    }

    const amount = Number(offerAmount)

    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter an offer greater than zero.')
      return
    }

    setBusy(true)
    setError('')
    setSuccess('')

    try {
      const { error: rpcError } = await supabase.rpc(
        'nvpl_submit_transfer_offer',
        {
          p_listing_id: offerListing,
          p_buyer_team_id: buyerTeam,
          p_offer_amount: amount,
          p_message: offerMessage.trim() || null
        }
      )

      if (rpcError) throw rpcError

      setSuccess('Transfer offer submitted.')
      setOfferListing('')
      setBuyerTeam('')
      setOfferAmount('')
      setOfferMessage('')
      await loadData()
      setTab('offers')
    } catch (err: any) {
      setError(err.message || 'Could not submit the offer.')
    } finally {
      setBusy(false)
    }
  }

  const reviewOffer = async (
    offerId: string,
    decision: 'accepted' | 'rejected'
  ) => {
    const confirmation =
      decision === 'accepted'
        ? 'Accept this offer and complete the transfer? This will move the player and club credits.'
        : 'Reject this transfer offer?'

    if (!window.confirm(confirmation)) return

    setBusy(true)
    setError('')
    setSuccess('')

    try {
      const { error: rpcError } = await supabase.rpc(
        'nvpl_review_transfer_offer',
        {
          p_offer_id: offerId,
          p_decision: decision
        }
      )

      if (rpcError) throw rpcError

      setSuccess(
        decision === 'accepted'
          ? 'Transfer completed successfully.'
          : 'Transfer offer rejected.'
      )

      await loadData()
    } catch (err: any) {
      setError(err.message || 'Could not review the offer.')
    } finally {
      setBusy(false)
    }
  }

  const myOffers = offers.filter(
    offer =>
      teams.some(team => team.id === offer.seller_team_id) ||
      teams.some(team => team.id === offer.buyer_team_id)
  )

  const incomingOffers = myOffers.filter(offer =>
    teams.some(team => team.id === offer.seller_team_id)
  )

  const availablePlayers = memberships.filter(membership => {
    const alreadyListed = listings.some(
      listing =>
        listing.player_id === membership.player_id &&
        listing.status === 'listed'
    )

    return !alreadyListed
  })

  const openListings = listings.filter(
    listing => listing.status === 'listed'
  )

  const myHistory = history.filter(
    item =>
      teams.some(team => team.id === item.from_team_id) ||
      teams.some(team => team.id === item.to_team_id)
  )

  const buttonClass = (active: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-semibold transition ${
      active
        ? 'bg-blue-600 text-white'
        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
    }`

  const cardClass =
    'rounded-xl border border-gray-800 bg-gray-900 p-5'

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 p-8 text-white">
        Loading NVPL Transfer Market...
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-blue-400">
              NVPL Transfers
            </p>
            <h1 className="text-3xl font-bold md:text-4xl">
              Player Market
            </h1>
            <p className="mt-2 text-gray-400">
              Buy, sell and track player transfers across NVPL.
            </p>
          </div>

          <button
            onClick={loadData}
            disabled={busy}
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm hover:bg-gray-800"
          >
            Refresh market
          </button>
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-red-800 bg-red-950 p-4 text-red-300">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-lg border border-green-800 bg-green-950 p-4 text-green-300">
            {success}
          </div>
        )}

        <div className="mb-7 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className={cardClass}>
            <p className="text-sm text-gray-400">Available players</p>
            <p className="mt-2 text-3xl font-bold">{openListings.length}</p>
          </div>
          <div className={cardClass}>
            <p className="text-sm text-gray-400">Incoming offers</p>
            <p className="mt-2 text-3xl font-bold">
              {incomingOffers.filter(item => item.status === 'pending').length}
            </p>
          </div>
          <div className={cardClass}>
            <p className="text-sm text-gray-400">My clubs</p>
            <p className="mt-2 text-3xl font-bold">{teams.length}</p>
          </div>
          <div className={cardClass}>
            <p className="text-sm text-gray-400">Completed transfers</p>
            <p className="mt-2 text-3xl font-bold">{history.length}</p>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          <button
            className={buttonClass(tab === 'market')}
            onClick={() => setTab('market')}
          >
            Market
          </button>
          <button
            className={buttonClass(tab === 'offers')}
            onClick={() => setTab('offers')}
          >
            Offers
          </button>
          <button
            className={buttonClass(tab === 'history')}
            onClick={() => setTab('history')}
          >
            Transfer history
          </button>
          <button
            className={buttonClass(tab === 'list')}
            onClick={() => setTab('list')}
          >
            List a player
          </button>
        </div>

        {tab === 'market' && (
          <section>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold">Available players</h2>
              <span className="text-sm text-gray-400">
                {openListings.length} players listed
              </span>
            </div>

            {openListings.length === 0 ? (
              <div className={cardClass}>
                <p className="text-gray-400">
                  No players are currently listed on the market.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {openListings.map(listing => {
                  const player = players.find(
                    item => item.id === listing.player_id
                  )

                  const alreadyOffered = offers.some(
                    offer =>
                      offer.listing_id === listing.id &&
                      offer.buyer_team_id &&
                      teams.some(
                        team => team.id === offer.buyer_team_id
                      )
                  )

                  return (
                    <div key={listing.id} className={cardClass}>
                      <div className="mb-4 flex items-start justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-wider text-blue-400">
                            {listing.position || 'Unspecified position'}
                          </p>
                          <h3 className="mt-1 text-xl font-bold">
                            {listing.gamertag ||
                              listing.player_username}
                          </h3>
                          <p className="text-sm text-gray-400">
                            {listing.player_username}
                          </p>
                        </div>
                        {player?.avatar_url ? (
                          <img
                            src={player.avatar_url}
                            alt=""
                            className="h-14 w-14 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-800 text-xl font-bold">
                            {(listing.gamertag ||
                              listing.player_username)[0]?.toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 text-sm">
                        <p className="text-gray-400">
                          Club:{' '}
                          <span className="text-white">
                            {teamName(listing.team_id)}
                          </span>
                        </p>
                        <p className="text-gray-400">
                          Market value:{' '}
                          <span className="text-white">
                            {player
                              ? `${Number(
                                  player.market_value_millions
                                ).toFixed(2)}m`
                              : 'Not available'}
                          </span>
                        </p>
                        <p className="text-gray-400">
                          Asking price:{' '}
                          <span className="font-bold text-green-400">
                            {formatValue(listing.asking_value)}
                          </span>
                        </p>
                      </div>

                      {listing.description && (
                        <p className="mt-4 border-t border-gray-800 pt-3 text-sm text-gray-400">
                          {listing.description}
                        </p>
                      )}

                      {teams.some(
                        team => team.id === listing.team_id
                      ) ? (
                        <p className="mt-5 rounded-lg bg-gray-800 px-3 py-2 text-center text-sm text-gray-300">
                          Your club's listing
                        </p>
                      ) : teams.length === 0 ? (
                        <p className="mt-5 text-sm text-gray-500">
                          You need to manage a club to submit offers.
                        </p>
                      ) : (
                        <button
                          onClick={() => {
                            setOfferListing(listing.id)
                            setTab('offers')
                          }}
                          className="mt-5 w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-500"
                        >
                          Make transfer offer
                        </button>
                      )}

                      {alreadyOffered && (
                        <p className="mt-2 text-xs text-gray-500">
                          Your club has already submitted an offer.
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {tab === 'offers' && (
          <section className="space-y-6">
            <div className={cardClass}>
              <h2 className="mb-4 text-xl font-bold">
                Submit a transfer offer
              </h2>

              {teams.length === 0 ? (
                <p className="text-gray-400">
                  You must own or be staff at a club to submit offers.
                </p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm text-gray-300">
                    Player listing
                    <select
                      value={offerListing}
                      onChange={event =>
                        setOfferListing(event.target.value)
                      }
                      className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950 p-3"
                    >
                      <option value="">Select a player</option>
                      {openListings
                        .filter(
                          listing =>
                            !teams.some(
                              team => team.id === listing.team_id
                            )
                        )
                        .map(listing => (
                          <option key={listing.id} value={listing.id}>
                            {listing.gamertag ||
                              listing.player_username}{' '}
                            — {teamName(listing.team_id)}
                          </option>
                        ))}
                    </select>
                  </label>

                  <label className="text-sm text-gray-300">
                    Buying club
                    <select
                      value={buyerTeam}
                      onChange={event =>
                        setBuyerTeam(event.target.value)
                      }
                      className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950 p-3"
                    >
                      <option value="">Select your club</option>
                      {teams.map(team => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm text-gray-300">
                    Offer amount
                    <input
                      type="number"
                      min="1"
                      value={offerAmount}
                      onChange={event =>
                        setOfferAmount(event.target.value)
                      }
                      placeholder="Enter credits"
                      className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950 p-3"
                    />
                  </label>

                  <label className="text-sm text-gray-300">
                    Message (optional)
                    <input
                      value={offerMessage}
                      onChange={event =>
                        setOfferMessage(event.target.value)
                      }
                      placeholder="Add a message to the selling club"
                      className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950 p-3"
                    />
                  </label>

                  <button
                    disabled={busy}
                    onClick={submitOffer}
                    className="rounded-lg bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-500 disabled:opacity-50 md:col-span-2"
                  >
                    {busy ? 'Submitting...' : 'Submit offer'}
                  </button>
                </div>
              )}
            </div>

            <div className={cardClass}>
              <h2 className="mb-4 text-xl font-bold">
                Incoming and outgoing offers
              </h2>

              {myOffers.length === 0 ? (
                <p className="text-gray-400">
                  Your clubs have no transfer offers yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {myOffers.map(offer => {
                    const isSeller = teams.some(
                      team => team.id === offer.seller_team_id
                    )

                    const canReview =
                      isSeller && offer.status === 'pending'

                    return (
                      <div
                        key={offer.id}
                        className="rounded-lg border border-gray-800 bg-gray-950 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="font-bold">
                              {playerName(offer.player_id)}
                            </h3>
                            <p className="mt-1 text-sm text-gray-400">
                              {teamName(offer.buyer_team_id)} offers{' '}
                              <span className="font-semibold text-green-400">
                                {formatValue(offer.offer_amount)}
                              </span>
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              Selling club: {teamName(offer.seller_team_id)}
                            </p>
                            {offer.message && (
                              <p className="mt-2 text-sm text-gray-400">
                                "{offer.message}"
                              </p>
                            )}
                          </div>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              offer.status === 'accepted'
                                ? 'bg-green-950 text-green-400'
                                : offer.status === 'rejected'
                                ? 'bg-red-950 text-red-400'
                                : 'bg-yellow-950 text-yellow-400'
                            }`}
                          >
                            {offer.status.toUpperCase()}
                          </span>
                        </div>

                        {canReview && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              disabled={busy}
                              onClick={() =>
                                reviewOffer(offer.id, 'accepted')
                              }
                              className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold hover:bg-green-600 disabled:opacity-50"
                            >
                              Accept offer
                            </button>
                            <button
                              disabled={busy}
                              onClick={() =>
                                reviewOffer(offer.id, 'rejected')
                              }
                              className="rounded-lg bg-red-900 px-4 py-2 text-sm font-semibold hover:bg-red-800 disabled:opacity-50"
                            >
                              Reject offer
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {tab === 'history' && (
          <section>
            <h2 className="mb-5 text-xl font-bold">
              Completed transfer history
            </h2>

            {history.length === 0 ? (
              <div className={cardClass}>
                <p className="text-gray-400">
                  No completed transfers have been recorded yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map(item => (
                  <div
                    key={item.id}
                    className={cardClass}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h3 className="font-bold">
                          {playerName(item.player_id)}
                        </h3>
                        <p className="mt-1 text-sm text-gray-400">
                          {teamName(item.from_team_id)} →{' '}
                          {teamName(item.to_team_id)}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {new Date(item.completed_at).toLocaleString()}
                        </p>
                      </div>
                      <p className="font-bold text-green-400">
                        {formatValue(item.transfer_value)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === 'list' && (
          <section className={cardClass}>
            <h2 className="mb-2 text-xl font-bold">
              List a player for transfer
            </h2>
            <p className="mb-6 text-sm text-gray-400">
              Only club owners and staff can list players belonging to their club.
            </p>

            {availablePlayers.length === 0 ? (
              <p className="rounded-lg bg-gray-950 p-4 text-gray-400">
                No eligible players available to list. Check that your club has active player memberships and that those players aren't already listed.
              </p>
            ) : (
              <div className="max-w-2xl space-y-4">
                <label className="block text-sm text-gray-300">
                  Select player
                  <select
                    value={selectedPlayer}
                    onChange={event =>
                      setSelectedPlayer(event.target.value)
                    }
                    className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950 p-3"
                  >
                    <option value="">Choose a player</option>
                    {availablePlayers.map(membership => {
                      const player = players.find(
                        item => item.id === membership.player_id
                      )

                      return (
                        <option
                          key={membership.id}
                          value={membership.player_id}
                        >
                          {player?.gamertag ||
                            player?.username ||
                            'Unknown player'}{' '}
                          — {teamName(membership.team_id)}
                        </option>
                      )
                    })}
                  </select>
                </label>

                {selectedPlayer && (
                  <div className="rounded-lg bg-gray-950 p-3 text-sm text-gray-400">
                    Player market value:{' '}
                    <span className="font-semibold text-white">
                      {Number(
                        players.find(
                          item => item.id === selectedPlayer
                        )?.market_value_millions || 0
                      ).toFixed(2)}m
                    </span>
                  </div>
                )}

                <label className="block text-sm text-gray-300">
                  Asking price (credits)
                  <input
                    type="number"
                    min="0"
                    value={askingValue}
                    onChange={event =>
                      setAskingValue(event.target.value)
                    }
                    className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950 p-3"
                  />
                </label>

                <label className="block text-sm text-gray-300">
                  Description (optional)
                  <textarea
                    rows={4}
                    value={description}
                    onChange={event =>
                      setDescription(event.target.value)
                    }
                    placeholder="Add details about the player..."
                    className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950 p-3"
                  />
                </label>

                <button
                  disabled={busy || !selectedPlayer}
                  onClick={createListing}
                  className="w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-500 disabled:opacity-50"
                >
                  {busy ? 'Creating listing...' : 'List player on market'}
                </button>
              </div>
            )}
          </section>
        )}

        <div className="mt-8 rounded-lg border border-gray-800 bg-gray-900 p-4 text-sm text-gray-400">
          NVPL transfer credits are virtual league credits. All completed transfers are recorded in the transfer history.
        </div>
      </div>
    </main>
  )
}
