import { useState } from 'react'
import { mutate } from 'swr'
import type { DashboardData } from '@/lib/types'

const isDemo = () => process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

export interface BudgetInput {
  category: string
  monthly_limit: number
}

type Budget = DashboardData['budgets'][number]

export function useBudgets() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = async (method: 'POST' | 'DELETE', body: unknown) => {
    const res = await fetch('/api/budgets', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      throw new Error(errorData.error || `Request failed: ${res.statusText}`)
    }
  }

  const addBudget = async (budget: BudgetInput) => {
    setIsSubmitting(true)
    setError(null)

    const optimistic = (d: DashboardData): Budget => {
      const spent = d.spendingByCategory.find((c) => c.category === budget.category)?.amount ?? 0
      return {
        category: budget.category,
        limit: budget.monthly_limit,
        spent,
        remaining: budget.monthly_limit - spent,
        pct: budget.monthly_limit > 0 ? Math.round((spent / budget.monthly_limit) * 100) : 0,
      }
    }

    try {
      if (isDemo()) {
        await mutate(
          '/api/dashboard',
          (d: DashboardData | undefined) => (d ? { ...d, budgets: [...d.budgets, optimistic(d)] } : d),
          { revalidate: false, populateCache: true }
        )
        return true
      }
      await send('POST', budget)
      await mutate('/api/dashboard')
      return true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add budget'
      setError(msg)
      throw err
    } finally {
      setIsSubmitting(false)
    }
  }

  const removeBudget = async (category: string) => {
    setIsSubmitting(true)
    setError(null)
    try {
      if (isDemo()) {
        await mutate(
          '/api/dashboard',
          (d: DashboardData | undefined) =>
            d ? { ...d, budgets: d.budgets.filter((b) => b.category !== category) } : d,
          { revalidate: false, populateCache: true }
        )
        return true
      }
      await send('DELETE', { category })
      await mutate('/api/dashboard')
      return true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to remove budget'
      setError(msg)
      throw err
    } finally {
      setIsSubmitting(false)
    }
  }

  return { addBudget, removeBudget, isSubmitting, error }
}
