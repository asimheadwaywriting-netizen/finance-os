import { useState } from 'react'
import { mutate } from 'swr'
import type { DashboardData, Transaction } from '@/lib/types'

export function useTransactions() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addTransaction = async (tx: Transaction) => {
    setIsSubmitting(true)
    setError(null)

    // Calculate current local year-month to verify if it is in the current month (June 2026 for local calendar)
    const currentYearMonth = new Date().toISOString().substring(0, 7) // "2026-06"
    const txYearMonth = tx.date.substring(0, 7)
    const isCurrentMonth = txYearMonth === currentYearMonth

    const postTx = async () => {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tx)
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to log transaction: ${res.statusText}`)
      }

      const result = await res.json()
      return result
    }

    // Define the SWR optimistic data updater
    const updateDashboardCache = (currentData: DashboardData | undefined): DashboardData => {
      const fallbackData: DashboardData = currentData || {
        metrics: { income: 0, expenses: 0, net: 0, safeToSpend: 0, daysLeftInMonth: 30 },
        accountBalances: [],
        goals: [],
        assets: [],
        recentTransactions: [],
        spendingByCategory: [],
        monthlyTrend: []
      }

      // 1. Prepend transaction to recentTransactions
      const newRecent = [tx, ...fallbackData.recentTransactions].slice(0, 10)

      // 2. Adjust account balances
      const newBalances = fallbackData.accountBalances.map(acc => {
        if (acc.name === tx.account) {
          const amount = tx.amount
          return {
            ...acc,
            balance: tx.type === 'Income' ? acc.balance + amount : acc.balance - amount
          }
        }
        return acc
      })

      // 3. Only adjust metrics & spendingByCategory if transaction date is in the current month
      let newMetrics = { ...fallbackData.metrics }
      let newSpending = [...fallbackData.spendingByCategory]

      if (isCurrentMonth) {
        const amount = tx.amount
        if (tx.type === 'Income') {
          newMetrics.income += amount
          newMetrics.net += amount
          newMetrics.safeToSpend += amount
        } else {
          newMetrics.expenses += amount
          newMetrics.net -= amount
          newMetrics.safeToSpend -= amount

          // Update spendingByCategory
          const catIdx = newSpending.findIndex(c => c.category === tx.category)
          if (catIdx > -1) {
            newSpending[catIdx] = {
              ...newSpending[catIdx],
              amount: newSpending[catIdx].amount + amount
            }
          } else {
            newSpending.push({ category: tx.category, amount })
          }
          // Sort spendingByCategory descending by amount
          newSpending.sort((a, b) => b.amount - a.amount)
        }
      }

      return {
        ...fallbackData,
        metrics: newMetrics,
        accountBalances: newBalances,
        recentTransactions: newRecent,
        spendingByCategory: newSpending
      }
    }

    try {
      await mutate(
        '/api/dashboard',
        async () => {
          await postTx()
          // Return undefined so revalidate runs immediately and queries fresh state
          return undefined
        },
        {
          optimisticData: updateDashboardCache,
          rollbackOnError: true,
          populateCache: false,
          revalidate: true
        }
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

  return {
    addTransaction,
    isSubmitting,
    error
  }
}
