import { useState } from 'react'
import { mutate } from 'swr'
import type { DashboardData } from '@/lib/types'

const isDemo = () => process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

export interface CategoryInput {
  name: string
  type: 'Income' | 'Expense'
  color: string
}

export function useCategories() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addCategory = async (category: CategoryInput) => {
    setIsSubmitting(true)
    setError(null)
    try {
      if (isDemo()) {
        await mutate(
          '/api/dashboard',
          (d: DashboardData | undefined) =>
            d ? { ...d, categories: [...d.categories, category] } : d,
          { revalidate: false, populateCache: true }
        )
        return true
      }
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(category),
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || `Request failed: ${res.statusText}`)
      }
      await mutate('/api/dashboard')
      return true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add category'
      setError(msg)
      throw err
    } finally {
      setIsSubmitting(false)
    }
  }

  return { addCategory, isSubmitting, error }
}
