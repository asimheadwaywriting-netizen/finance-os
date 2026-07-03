import { useState } from 'react'
import { mutate } from 'swr'
import type { DashboardData, Transaction } from '@/lib/types'

const EMPTY_DASHBOARD: DashboardData = {
  metrics: { income: 0, expenses: 0, net: 0, safeToSpend: 0, weeklySafeToSpend: 0, daysLeftInMonth: 30, accountsStartingTotal: 0, billsCommitted: 0, billsUnpaid: 0 },
  accountBalances: [],
  goals: [],
  assets: [],
  recentTransactions: [],
  spendingByCategory: [],
  monthlyTrend: [],
  dailyTrend: [],
  categories: [],
  budgets: [],
  bills: [],
}

const isDemo = () => process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
// Dhaka month (UTC+6), matching the server aggregator — plain toISOString() is UTC
// and disagrees with the server from midnight to 6am on the 1st.
const currentYearMonth = () => new Date(Date.now() + 6 * 3600 * 1000).toISOString().substring(0, 7) // "2026-06"

function txMatches(a: Transaction, b: Transaction): boolean {
  return (
    a.date === b.date &&
    a.type === b.type &&
    a.category === b.category &&
    a.payee === b.payee &&
    a.amount === b.amount &&
    a.account === b.account &&
    (a.note || '') === (b.note || '')
  )
}

/**
 * Build an SWR optimistic updater that applies (direction = +1) or reverses
 * (direction = -1) a transaction's effect on the dashboard cache: recent list,
 * account balances, and — only when the transaction is in the current month —
 * the headline metrics and spending-by-category breakdown.
 */
function buildUpdater(tx: Transaction, direction: 1 | -1) {
  const inCurrentMonth = tx.date.substring(0, 7) === currentYearMonth()

  return (currentData: DashboardData | undefined): DashboardData => {
    const data = currentData || EMPTY_DASHBOARD
    const amount = tx.amount

    const newRecent =
      direction === 1
        ? [tx, ...data.recentTransactions].slice(0, 10)
        : data.recentTransactions.filter((t) => !txMatches(t, tx))

    const newBalances = data.accountBalances.map((acc) => {
      if (acc.name !== tx.account) return acc
      const signed = tx.type === 'Income' ? amount : -amount
      return { ...acc, balance: acc.balance + direction * signed }
    })

    const newMetrics = { ...data.metrics }
    let newSpending = [...data.spendingByCategory]

    if (inCurrentMonth) {
      if (tx.type === 'Income') {
        newMetrics.income += direction * amount
        newMetrics.net += direction * amount
        newMetrics.safeToSpend += direction * amount
      } else {
        newMetrics.expenses += direction * amount
        newMetrics.net -= direction * amount
        // A bill payment was already reserved as an unpaid bill in safeToSpend, so paying
        // it leaves safeToSpend unchanged (balance down, billsUnpaid down — they cancel).
        // ponytail: exact value comes from the next revalidate; this just avoids a flicker.
        if (!(tx.note || '').startsWith('bill:')) newMetrics.safeToSpend -= direction * amount

        const idx = newSpending.findIndex((c) => c.category === tx.category)
        if (idx > -1) {
          const next = newSpending[idx].amount + direction * amount
          if (next <= 0) {
            newSpending = newSpending.filter((_, i) => i !== idx)
          } else {
            newSpending[idx] = { ...newSpending[idx], amount: next }
          }
        } else if (direction === 1) {
          newSpending.push({ category: tx.category, amount })
        }
        newSpending.sort((a, b) => b.amount - a.amount)
      }
    }

    return {
      ...data,
      metrics: newMetrics,
      accountBalances: newBalances,
      recentTransactions: newRecent,
      spendingByCategory: newSpending,
    }
  }
}

export function useTransactions() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addTransaction = async (tx: Transaction) => {
    setIsSubmitting(true)
    setError(null)
    const updater = buildUpdater(tx, 1)

    // Demo: apply the optimistic row directly and skip the POST + revalidation,
    // so the new transaction stays visible until a hard refresh restores sample data.
    if (isDemo()) {
      try {
        await mutate('/api/dashboard', updater, { revalidate: false, populateCache: true })
        return true
      } finally {
        setIsSubmitting(false)
      }
    }

    try {
      await mutate(
        '/api/dashboard',
        async () => {
          const res = await fetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tx),
          })
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}))
            throw new Error(errorData.error || `Failed to log transaction: ${res.statusText}`)
          }
          return undefined // revalidate against fresh state
        },
        { optimisticData: updater, rollbackOnError: true, populateCache: false, revalidate: true }
      )
      return true
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'An error occurred while saving the transaction'
      setError(errMsg)
      throw err
    } finally {
      setIsSubmitting(false)
    }
  }

  const removeTransaction = async (tx: Transaction) => {
    setIsSubmitting(true)
    setError(null)
    const updater = buildUpdater(tx, -1)

    if (isDemo()) {
      try {
        await mutate('/api/dashboard', updater, { revalidate: false, populateCache: true })
        return true
      } finally {
        setIsSubmitting(false)
      }
    }

    try {
      await mutate(
        '/api/dashboard',
        async () => {
          const res = await fetch('/api/transactions', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tx),
          })
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}))
            throw new Error(errorData.error || `Failed to remove transaction: ${res.statusText}`)
          }
          return undefined
        },
        { optimisticData: updater, rollbackOnError: true, populateCache: false, revalidate: true }
      )
      return true
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'An error occurred while removing the transaction'
      setError(errMsg)
      throw err
    } finally {
      setIsSubmitting(false)
    }
  }

  return { addTransaction, removeTransaction, isSubmitting, error }
}
