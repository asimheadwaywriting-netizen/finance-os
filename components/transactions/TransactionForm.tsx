'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { categoriesForType } from '@/lib/constants'
import type { DashboardData, Transaction } from '@/lib/types'

export interface TransactionFormProps {
  onSubmit: (tx: Transaction) => Promise<void>
  isSubmitting?: boolean
  accounts?: { name: string; balance: number }[]
  /** Live category list (Sheet-driven). Falls back to the static taxonomy when empty. */
  categories?: DashboardData['categories']
}

export default function TransactionForm({
  onSubmit,
  isSubmitting = false,
  accounts = [],
  categories = []
}: TransactionFormProps) {
  // Setup fallback accounts if SWR cache is empty
  const accountOptions = accounts.length > 0
    ? accounts.map(a => a.name)
    : ['Cash', 'bKash', 'Bank - DBBL']

  // Categories come from live data; fall back to the static taxonomy (demo / first load).
  const categoriesFor = (t: 'Income' | 'Expense'): { name: string }[] => {
    const live = categories.filter((c) => c.type === t)
    return live.length > 0 ? live : categoriesForType(t)
  }

  // Get current date in local YYYY-MM-DD
  const getTodayString = () => {
    const today = new Date()
    const offset = today.getTimezoneOffset()
    const localToday = new Date(today.getTime() - (offset * 60 * 1000))
    return localToday.toISOString().substring(0, 10)
  }

  // Form states
  const [type, setType] = useState<'Income' | 'Expense'>('Expense')
  const [category, setCategory] = useState<string>('')
  const [account, setAccount] = useState<string>('')
  const [payee, setPayee] = useState<string>('')
  const [date, setDate] = useState<string>(getTodayString())
  const [amount, setAmount] = useState<string>('')
  const [note, setNote] = useState<string>('')
  const [validationError, setValidationError] = useState<string | null>(null)

  // Update category and account selections when options filter or change
  useEffect(() => {
    const availableCategories = categoriesFor(type)
    if (availableCategories.length > 0) {
      setCategory(availableCategories[0].name)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, categories])

  useEffect(() => {
    if (accounts.length > 0) {
      setAccount(accounts[0].name)
    } else {
      setAccount('Cash')
    }
  }, [accounts])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError(null)

    // Basic Validation
    if (!payee.trim()) {
      setValidationError('Payee is a required field.')
      return
    }
    if (!date) {
      setValidationError('Date is a required field.')
      return
    }
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setValidationError('Amount must be a positive number greater than 0.')
      return
    }

    const tx: Transaction = {
      date,
      type,
      category,
      payee: payee.trim(),
      amount: parsedAmount,
      account,
      note: note.trim()
    }

    try {
      await onSubmit(tx)
      // Reset form variables on success (keep type, account, and date for consecutive entries convenience)
      setPayee('')
      setAmount('')
      setNote('')
    } catch (err: unknown) {
      setValidationError(err instanceof Error ? err.message : 'Failed to submit transaction.')
    }
  }

  const inputStyles = "flex h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-brand-income/50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"

  return (
    <Card className="bg-card border-white/10 relative overflow-hidden">
      <CardHeader className="border-b border-white/10 p-5">
        <CardTitle className="text-sm font-medium text-white uppercase tracking-wider">Log Transaction</CardTitle>
      </CardHeader>
      
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {validationError && (
            <div className="text-xs text-brand-expense bg-brand-expense/10 border border-brand-expense/20 px-3 py-2 rounded-lg">
              {validationError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Transaction Type */}
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

            {/* Account */}
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">Account</label>
              <select
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                disabled={isSubmitting}
                className={inputStyles}
              >
                {accountOptions.map((accName) => (
                  <option key={accName} value={accName} className="bg-card text-white">
                    {accName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Category */}
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={isSubmitting}
                className={inputStyles}
              >
                {categoriesFor(type).map((cat) => (
                  <option key={cat.name} value={cat.name} className="bg-card text-white">
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={isSubmitting}
                className={inputStyles}
              />
            </div>
          </div>

          {/* Payee */}
          <div className="space-y-1.5">
            <label className="text-xs text-gray-400">Payee</label>
            <input
              type="text"
              placeholder="e.g. Shwapno, DESCO, Upwork"
              value={payee}
              onChange={(e) => setPayee(e.target.value)}
              disabled={isSubmitting}
              className={inputStyles}
            />
          </div>

          {/* Amount */}
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

          {/* Note */}
          <div className="space-y-1.5">
            <label className="text-xs text-gray-400">Note (Optional)</label>
            <input
              type="text"
              placeholder="Add details..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={isSubmitting}
              className={inputStyles}
            />
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-brand-income hover:bg-brand-income/95 text-white py-2 px-4 rounded-lg font-medium transition-all"
          >
            {isSubmitting ? 'Logging...' : 'Submit Transaction'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
