'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { BudgetInput } from '@/hooks/useBudgets'

export interface BudgetFormProps {
  onSubmit: (budget: BudgetInput) => Promise<unknown>
  onCancel?: () => void
  isSubmitting?: boolean
  /** Expense category names available to budget (not already budgeted). */
  categories: string[]
}

const inputStyles =
  'flex h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-brand-income/50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors'

export default function BudgetForm({ onSubmit, onCancel, isSubmitting = false, categories }: BudgetFormProps) {
  const [category, setCategory] = useState(categories[0] || '')
  const [limit, setLimit] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  useEffect(() => {
    if (categories.length > 0 && !categories.includes(category)) setCategory(categories[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError(null)

    if (!category) {
      setValidationError('Pick a category.')
      return
    }
    const limitNum = parseFloat(limit)
    if (isNaN(limitNum) || limitNum <= 0) {
      setValidationError('Monthly limit must be a positive number.')
      return
    }

    try {
      await onSubmit({ category, monthly_limit: limitNum })
      setLimit('')
    } catch (err: unknown) {
      setValidationError(err instanceof Error ? err.message : 'Failed to add budget.')
    }
  }

  return (
    <Card className="bg-card border-white/10">
      <CardHeader className="border-b border-white/10 p-5">
        <CardTitle className="text-sm font-medium text-white uppercase tracking-wider">Add Budget</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {validationError && (
            <div className="text-xs text-brand-expense bg-brand-expense/10 border border-brand-expense/20 px-3 py-2 rounded-lg">
              {validationError}
            </div>
          )}

          {categories.length === 0 ? (
            <p className="text-xs text-gray-500">All expense categories already have a budget.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-gray-400">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={isSubmitting}
                  className={inputStyles}
                >
                  {categories.map((c) => (
                    <option key={c} value={c} className="bg-card text-white">{c}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-gray-400">Monthly limit (BDT)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  disabled={isSubmitting}
                  className={inputStyles}
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Button
              type="submit"
              disabled={isSubmitting || categories.length === 0}
              className="flex-1 bg-brand-income hover:bg-brand-income/95 text-white py-2 px-4 rounded-lg font-medium transition-all"
            >
              {isSubmitting ? 'Adding…' : 'Add Budget'}
            </Button>
            {onCancel && (
              <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
