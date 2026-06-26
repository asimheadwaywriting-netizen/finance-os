'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { BillInput } from '@/hooks/useBills'

export interface BillFormProps {
  onSubmit: (bill: BillInput) => Promise<unknown>
  onCancel?: () => void
  isSubmitting?: boolean
  /** Expense category names (from live data). */
  categories: string[]
  /** Account names to pay the bill from (from live data). */
  accounts: string[]
}

const inputStyles =
  'flex h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-brand-income/50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors'

export default function BillForm({ onSubmit, onCancel, isSubmitting = false, categories, accounts }: BillFormProps) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDay, setDueDay] = useState('')
  const [category, setCategory] = useState(categories[0] || '')
  const [account, setAccount] = useState(accounts[0] || '')
  const [validationError, setValidationError] = useState<string | null>(null)

  useEffect(() => {
    if (categories.length > 0 && !categories.includes(category)) setCategory(categories[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories])
  useEffect(() => {
    if (accounts.length > 0 && !accounts.includes(account)) setAccount(accounts[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError(null)

    if (!name.trim()) {
      setValidationError('Bill name is required.')
      return
    }
    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      setValidationError('Amount must be a positive number.')
      return
    }
    const dueDayNum = parseInt(dueDay, 10)
    if (isNaN(dueDayNum) || dueDayNum < 1 || dueDayNum > 31) {
      setValidationError('Due day must be between 1 and 31.')
      return
    }
    if (!category) {
      setValidationError('Pick a category.')
      return
    }
    if (!account) {
      setValidationError('Pick an account.')
      return
    }

    try {
      await onSubmit({ name: name.trim(), amount: amountNum, due_day: dueDayNum, category, account })
      setName('')
      setAmount('')
      setDueDay('')
    } catch (err: unknown) {
      setValidationError(err instanceof Error ? err.message : 'Failed to add bill.')
    }
  }

  return (
    <Card className="bg-card border-white/10">
      <CardHeader className="border-b border-white/10 p-5">
        <CardTitle className="text-sm font-medium text-white uppercase tracking-wider">Add Recurring Bill</CardTitle>
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
              <label className="text-xs text-gray-400">Bill name</label>
              <input
                type="text"
                placeholder="e.g. Rent, Internet"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
                className={inputStyles}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">Amount (BDT)</label>
              <input
                type="number"
                step="any"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isSubmitting}
                className={inputStyles}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">Due day (1–31)</label>
              <input
                type="number"
                min={1}
                max={31}
                step={1}
                placeholder="e.g. 5"
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                disabled={isSubmitting}
                className={inputStyles}
              />
            </div>
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
              <label className="text-xs text-gray-400">Pay from</label>
              <select
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                disabled={isSubmitting}
                className={inputStyles}
              >
                {accounts.map((a) => (
                  <option key={a} value={a} className="bg-card text-white">{a}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <Button
              type="submit"
              disabled={isSubmitting || categories.length === 0 || accounts.length === 0}
              className="flex-1 bg-brand-income hover:bg-brand-income/95 text-white py-2 px-4 rounded-lg font-medium transition-all"
            >
              {isSubmitting ? 'Adding…' : 'Add Bill'}
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
