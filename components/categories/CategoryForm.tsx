'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { CategoryInput } from '@/hooks/useCategories'

export interface CategoryFormProps {
  onSubmit: (category: CategoryInput) => Promise<unknown>
  onCancel?: () => void
  isSubmitting?: boolean
}

const inputStyles =
  'flex h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-brand-income/50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors'

// Preset swatches mirroring the design-system palette (lib/constants COLORS + the
// existing category hues). The user can also pick any hex with the color input.
const SWATCHES = [
  '#f97316', '#fb923c', '#3b82f6', '#60a5fa', '#a78bfa', '#f59e0b',
  '#ef4444', '#ec4899', '#06b6d4', '#8b5cf6', '#14b8a6', '#6366f1',
  '#10b981', '#dc2626', '#0ea5e9', '#6b7280',
]

export default function CategoryForm({ onSubmit, onCancel, isSubmitting = false }: CategoryFormProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState<'Income' | 'Expense'>('Expense')
  const [color, setColor] = useState('#6b7280')
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError(null)

    if (!name.trim()) {
      setValidationError('Category name is required.')
      return
    }

    try {
      await onSubmit({ name: name.trim(), type, color })
      setName('')
      setType('Expense')
      setColor('#6b7280')
    } catch (err: unknown) {
      setValidationError(err instanceof Error ? err.message : 'Failed to add category.')
    }
  }

  return (
    <Card className="bg-card border-white/10">
      <CardHeader className="border-b border-white/10 p-5">
        <CardTitle className="text-sm font-medium text-white uppercase tracking-wider">Add Category</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {validationError && (
            <div className="text-xs text-brand-expense bg-brand-expense/10 border border-brand-expense/20 px-3 py-2 rounded-lg">
              {validationError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">Category name</label>
              <input
                type="text"
                placeholder="e.g. Pets, Travel"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
                className={inputStyles}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as 'Income' | 'Expense')}
                disabled={isSubmitting}
                className={inputStyles}
              >
                <option value="Expense" className="bg-card text-white">Expense</option>
                <option value="Income" className="bg-card text-white">Income</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-gray-400">Color</label>
            <div className="flex flex-wrap items-center gap-2">
              {SWATCHES.map((sw) => (
                <button
                  key={sw}
                  type="button"
                  onClick={() => setColor(sw)}
                  disabled={isSubmitting}
                  aria-label={`Pick ${sw}`}
                  className={cn(
                    'h-6 w-6 rounded-md border transition-transform',
                    color.toLowerCase() === sw.toLowerCase()
                      ? 'border-white scale-110'
                      : 'border-white/10 hover:scale-105'
                  )}
                  style={{ backgroundColor: sw }}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                disabled={isSubmitting}
                aria-label="Custom color"
                className="h-6 w-8 cursor-pointer rounded-md border border-white/10 bg-transparent p-0"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-brand-income hover:bg-brand-income/95 text-white py-2 px-4 rounded-lg font-medium transition-all"
            >
              {isSubmitting ? 'Adding…' : 'Add Category'}
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
