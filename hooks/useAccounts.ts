import { useState } from 'react'
import { mutate } from 'swr'
import type { DashboardData } from '@/lib/types'

const isDemo = () => process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

export interface AccountInput {
  account_name: string
  starting_balance: number
}

export function useAccounts() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addAccount = async (account: AccountInput) => {
    setIsSubmitting(true)
    setError(null)
    try {
      if (isDemo()) {
        await mutate(
          '/api/dashboard',
          (d: DashboardData | undefined) =>
            d
              ? {
                  ...d,
                  accountBalances: [...d.accountBalances, { name: account.account_name, balance: account.starting_balance }],
                  metrics: { ...d.metrics, accountsStartingTotal: d.metrics.accountsStartingTotal + account.starting_balance },
                }
              : d,
          { revalidate: false, populateCache: true }
        )
        return true
      }
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(account),
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || `Request failed: ${res.statusText}`)
      }
      await mutate('/api/dashboard')
      return true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add account'
      setError(msg)
      throw err
    } finally {
      setIsSubmitting(false)
    }
  }

  return { addAccount, isSubmitting, error }
}
