import { useState } from 'react'
import { mutate } from 'swr'
import type { DashboardData } from '@/lib/types'

const isDemo = () => process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

export interface GoalInput {
  goal_name: string
  target_amount: number
  saved_so_far: number
  monthly_contribution: number
  priority: string
}

type Goal = DashboardData['goals'][number]

export function useGoals() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = async (method: 'POST' | 'DELETE', body: unknown) => {
    const res = await fetch('/api/goals', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      throw new Error(errorData.error || `Request failed: ${res.statusText}`)
    }
  }

  const addGoal = async (goal: GoalInput) => {
    setIsSubmitting(true)
    setError(null)

    const optimistic: Goal = {
      name: goal.goal_name,
      target: goal.target_amount,
      saved: goal.saved_so_far,
      contribution: goal.monthly_contribution,
      priority: goal.priority,
      progressPct: goal.target_amount > 0 ? Math.round((goal.saved_so_far / goal.target_amount) * 100) : 0,
    }

    try {
      if (isDemo()) {
        await mutate(
          '/api/dashboard',
          (d: DashboardData | undefined) => (d ? { ...d, goals: [...d.goals, optimistic] } : d),
          { revalidate: false, populateCache: true }
        )
        return true
      }
      await send('POST', goal)
      await mutate('/api/dashboard')
      return true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add goal'
      setError(msg)
      throw err
    } finally {
      setIsSubmitting(false)
    }
  }

  const removeGoal = async (goalName: string) => {
    setIsSubmitting(true)
    setError(null)
    try {
      if (isDemo()) {
        await mutate(
          '/api/dashboard',
          (d: DashboardData | undefined) =>
            d ? { ...d, goals: d.goals.filter((g) => g.name !== goalName) } : d,
          { revalidate: false, populateCache: true }
        )
        return true
      }
      await send('DELETE', { goal_name: goalName })
      await mutate('/api/dashboard')
      return true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to remove goal'
      setError(msg)
      throw err
    } finally {
      setIsSubmitting(false)
    }
  }

  return { addGoal, removeGoal, isSubmitting, error }
}
