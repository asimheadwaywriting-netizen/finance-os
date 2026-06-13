'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { GoalInput } from '@/hooks/useGoals'

export interface GoalFormProps {
  onSubmit: (goal: GoalInput) => Promise<unknown>
  onCancel?: () => void
  isSubmitting?: boolean
}

const inputStyles =
  'flex h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-brand-income/50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors'

export default function GoalForm({ onSubmit, onCancel, isSubmitting = false }: GoalFormProps) {
  const [goalName, setGoalName] = useState('')
  const [target, setTarget] = useState('')
  const [saved, setSaved] = useState('')
  const [contribution, setContribution] = useState('')
  const [priority, setPriority] = useState('Medium')
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError(null)

    if (!goalName.trim()) {
      setValidationError('Goal name is required.')
      return
    }
    const targetNum = parseFloat(target)
    if (isNaN(targetNum) || targetNum <= 0) {
      setValidationError('Target amount must be a positive number.')
      return
    }

    try {
      await onSubmit({
        goal_name: goalName.trim(),
        target_amount: targetNum,
        saved_so_far: parseFloat(saved) || 0,
        monthly_contribution: parseFloat(contribution) || 0,
        priority,
      })
      setGoalName('')
      setTarget('')
      setSaved('')
      setContribution('')
      setPriority('Medium')
    } catch (err: unknown) {
      setValidationError(err instanceof Error ? err.message : 'Failed to add goal.')
    }
  }

  return (
    <Card className="bg-card border-white/10">
      <CardHeader className="border-b border-white/10 p-5">
        <CardTitle className="text-sm font-medium text-white uppercase tracking-wider">Add Goal</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {validationError && (
            <div className="text-xs text-brand-expense bg-brand-expense/10 border border-brand-expense/20 px-3 py-2 rounded-lg">
              {validationError}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs text-gray-400">Goal name</label>
            <input
              type="text"
              placeholder="e.g. Emergency Fund"
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
              disabled={isSubmitting}
              className={inputStyles}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">Target amount (BDT)</label>
              <input
                type="number"
                step="any"
                placeholder="0.00"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                disabled={isSubmitting}
                className={inputStyles}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">Saved so far (BDT)</label>
              <input
                type="number"
                step="any"
                placeholder="0.00"
                value={saved}
                onChange={(e) => setSaved(e.target.value)}
                disabled={isSubmitting}
                className={inputStyles}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">Monthly contribution</label>
              <input
                type="number"
                step="any"
                placeholder="0.00"
                value={contribution}
                onChange={(e) => setContribution(e.target.value)}
                disabled={isSubmitting}
                className={inputStyles}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                disabled={isSubmitting}
                className={inputStyles}
              >
                <option value="High" className="bg-card text-white">High</option>
                <option value="Medium" className="bg-card text-white">Medium</option>
                <option value="Low" className="bg-card text-white">Low</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-brand-income hover:bg-brand-income/95 text-white py-2 px-4 rounded-lg font-medium transition-all"
            >
              {isSubmitting ? 'Adding…' : 'Add Goal'}
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
