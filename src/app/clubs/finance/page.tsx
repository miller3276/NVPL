
'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Team = {
  id: string
  name: string
  abbreviation: string
}

type Wallet = {
  id: string
  team_id: string
  balance: number
  currency: string
  updated_at: string
}

type Transaction = {
  id: string
  team_id: string
  transaction_type: string
  amount: number
  description: string
  created_at: string
}

export default function ClubFinancePage() {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [teams, setTeams] = useState<Team[]>([])
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isAdmin, setIsAdmin] = useState(false)

  const [selectedTeam, setSelectedTeam] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [filterTeam, setFilterTeam] = useState('all')

  const teamName = (id: string) =>
    teams.find(team => team.id === id)?.name || 'Unknown club'

  const money = (value: number) =>
    `${Number(value || 0).toLocaleString()} credits`

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser()

      if (authError) throw authError
      if (!authData.user) throw new Error('Please log in.')

      const uid = authData.user.id

      const { data: adminData, error: adminError } =
        await supabase.rpc('is_nvpl_admin')

      if (adminError) throw adminError

      const admin = Boolean(adminData)
      setIsAdmin(admin)

      const { data: owned, error: ownedError } = await supabase
        .from('teams')
        .select('id, name, abbreviation')
        .eq('owner_id', uid)

      if (ownedError) throw ownedError

      const { data: staff, error: staffError } = await supabase
        .from('club_staff')
        .select('team_id')
        .eq('user_id', uid)

      if (staffError) throw staffError

      const staffIds = (staff || []).map(item => item.team_id)

      const { data: staffTeams, error: staffTeamsError } =
        staffIds.length
          ? await supabase
              .from('teams')
              .select('id, name, abbreviation')
              .in('id', staffIds)
          : { data: [], error: null }

      if (staffTeamsError) throw staffTeamsError

      const { data: allTeams, error: allTeamsError } = admin
        ? await supabase
            .from('teams')
            .select('id, name, abbreviation')
            .order('name')
        : { data: [], error: null }

      if (allTeamsError) throw allTeamsError

      const combined = [
        ...(owned || []),
        ...(staffTeams || []),
        ...(allTeams || [])
      ]

      const uniqueTeams = Array.from(
        new Map(combined.map(team => [team.id, team])).values()
      ) as Team[]

      setTeams(uniqueTeams)

      const teamIds = uniqueTeams.map(team => team.id)

      if (teamIds.length === 0) {
        setWallets([])
        setTransactions([])
        return
      }

      const { data: walletData, error: walletError } = await supabase
        .from('nvpl_club_wallets')
        .select('*')
        .in('team_id', teamIds)

      if (walletError) throw walletError

      setWallets((walletData || []) as Wallet[])

      const { data: transactionData, error: transactionError } =
        await supabase
          .from('nvpl_club_transactions')
          .select('*')
          .in('team_id', teamIds)
          .order('created_at', { ascending: false })
          .limit(150)

      if (transactionError) throw transactionError

      setTransactions((transactionData || []) as Transaction[])
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load club finances.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const adjustWallet = async () => {
    if (!selectedTeam) {
      setError('Select a club.')
      return
    }

    const value = Number(amount)

    if (!Number.isFinite(value) || value === 0) {
      setError('Enter a valid amount. Use a positive number for credit or negative for debit.')
      return
    }

    if (description.trim().length < 3) {
      setError('Enter a transaction description.')
      return
    }

    const action = value > 0 ? 'credit' : 'debit'

    if (
      !window.confirm(
        `Confirm ${action} of ${money(Math.abs(value))} for ${teamName(selectedTeam)}?`
      )
    ) return

    setBusy(true)
    setError('')
    setSuccess('')

    try {
      const { data, error: rpcError } = await supabase.rpc(
        'nvpl_admin_adjust_club_wallet',
        {
          p_team_id: selectedTeam,
          p_amount: value,
          p_description: description.trim()
        }
      )

      if (rpcError) throw rpcError

      setSuccess(
        `Wallet updated. New balance: ${money(Number(data))}.`
      )

      setAmount('')
      setDescription('')
      await loadData()
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not update club wallet.'
      )
    } finally {
      setBusy(false)
    }
  }

  const totalBalance = wallets.reduce(
    (total, wallet) => total + Number(wallet.balance || 0),
    0
  )

  const visibleTransactions =
    filterTeam === 'all'
      ? transactions
      : transactions.filter(item => item.team_id === filterTeam)

  const cardClass =
    'rounded-xl border border-gray-800 bg-gray-900 p-5'

  const buttonClass =
    'rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-500 disabled:opacity-50'

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 p-8 text-white">
        Loading club finances...
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-7xl">

        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-blue-400">
              NVPL Club Management
            </p>
            <h1 className="text-3xl font-bold md:text-4xl">
              Club Finances
            </h1>
            <p className="mt-2 text-gray-400">
              Club wallets, credits and transaction records.
            </p>
          </div>

          <button
            onClick={loadData}
            disabled={busy}
            className="rounded-lg border border-gray-700 px-4 py-2 hover:bg-gray-800"
          >
            Refresh
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

        <div className="mb-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className={cardClass}>
            <p className="text-sm text-gray-400">Clubs accessible</p>
            <p className="mt-2 text-3xl font-bold">{teams.length}</p>
          </div>

          <div className={cardClass}>
            <p className="text-sm text-gray-400">Total club credits</p>
            <p className="mt-2 text-3xl font-bold text-green-400">
              {money(totalBalance)}
            </p>
          </div>

          <div className={cardClass}>
            <p className="text-sm text-gray-400">Recorded transactions</p>
            <p className="mt-2 text-3xl font-bold">
              {transactions.length}
            </p>
          </div>
        </div>

        <section className="mb-8">
          <div className="mb-4">
            <h2 className="text-xl font-bold">Club wallets</h2>
            <p className="mt-1 text-sm text-gray-400">
              Current balances for clubs you can access.
            </p>
          </div>

          {teams.length === 0 ? (
            <div className={cardClass}>
              <p className="text-gray-400">
                You don't currently manage a club.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {teams.map(team => {
                const wallet = wallets
                  .filter(item => item.team_id === team.id)
                  .sort(
                    (a, b) =>
                      new Date(b.updated_at).getTime() -
                      new Date(a.updated_at).getTime()
                  )[0]

                return (
                  <div key={team.id} className={cardClass}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-bold">
                          {team.name}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {team.abbreviation}
                        </p>
                      </div>

                      <span className="rounded-lg bg-gray-800 px-3 py-2 text-xs text-gray-300">
                        {wallet?.currency || 'Credits'}
                      </span>
                    </div>

                    <p className="mt-5 text-sm text-gray-400">
                      Available balance
                    </p>

                    <p className="mt-1 text-2xl font-bold text-green-400">
                      {money(Number(wallet?.balance || 0))}
                    </p>

                    <p className="mt-3 text-xs text-gray-500">
                      Last updated:{' '}
                      {wallet?.updated_at
                        ? new Date(wallet.updated_at).toLocaleString()
                        : 'No wallet record yet'}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {isAdmin && (
          <section className={`${cardClass} mb-8`}>
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-blue-400">
              Administration
            </p>

            <h2 className="text-xl font-bold">
              Adjust club credits
            </h2>

            <p className="mb-5 mt-2 text-sm text-gray-400">
              Add credits with a positive amount or deduct credits with a negative amount. Every adjustment is recorded.
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm text-gray-300">
                Select club
                <select
                  value={selectedTeam}
                  onChange={event =>
                    setSelectedTeam(event.target.value)
                  }
                  className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950 p-3"
                >
                  <option value="">Choose a club</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-gray-300">
                Credit or debit amount
                <input
                  type="number"
                  value={amount}
                  onChange={event => setAmount(event.target.value)}
                  placeholder="Example: 500 or -200"
                  className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950 p-3"
                />
              </label>

              <label className="text-sm text-gray-300 md:col-span-2">
                Transaction description
                <input
                  value={description}
                  onChange={event =>
                    setDescription(event.target.value)
                  }
                  placeholder="Example: Season participation reward"
                  className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950 p-3"
                />
              </label>

              <button
                onClick={adjustWallet}
                disabled={busy}
                className={buttonClass}
              >
                {busy ? 'Processing...' : 'Apply wallet adjustment'}
              </button>
            </div>
          </section>
        )}

        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">
                Transaction history
              </h2>
              <p className="mt-1 text-sm text-gray-400">
                Latest club wallet activity.
              </p>
            </div>

            <select
              value={filterTeam}
              onChange={event => setFilterTeam(event.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-900 p-2 text-sm"
            >
              <option value="all">All clubs</option>
              {teams.map(team => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>

          {visibleTransactions.length === 0 ? (
            <div className={cardClass}>
              <p className="text-gray-400">
                No transactions found.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-800">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead className="bg-gray-900 text-gray-400">
                  <tr>
                    <th className="p-4">Club</th>
                    <th className="p-4">Transaction</th>
                    <th className="p-4">Description</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Date</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleTransactions.map(transaction => {
                    const incoming =
                      transaction.transaction_type.includes('in') ||
                      transaction.transaction_type.includes('credit')

                    return (
                      <tr
                        key={transaction.id}
                        className="border-t border-gray-800"
                      >
                        <td className="p-4 font-semibold">
                          {teamName(transaction.team_id)}
                        </td>

                        <td className="p-4 text-gray-300">
                          {transaction.transaction_type.replaceAll('_', ' ')}
                        </td>

                        <td className="max-w-xs p-4 text-gray-400">
                          {transaction.description}
                        </td>

                        <td className={`p-4 font-bold ${
                          incoming ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {incoming ? '+' : '-'}
                          {money(transaction.amount)}
                        </td>

                        <td className="p-4 text-gray-500">
                          {new Date(
                            transaction.created_at
                          ).toLocaleDateString()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="mt-8 text-xs text-gray-500">
          NVPL credits are virtual league credits and have no real-money value.
        </p>
      </div>
    </main>
  )
}
