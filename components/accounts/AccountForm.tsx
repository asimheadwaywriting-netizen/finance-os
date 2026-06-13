'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { AccountInput } from '@/hooks/useAccounts'

export interface AccountFormProps {
  onSubmit: (account: AccountInput) => Promise<unknown>
  onCancel?: () => void
  isSubmitting?: boolean
}

const inputStyles =
  'flex h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-brand-income/50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors'

export default function AccountForm({ onSubmit, onCancel, isSubmitting = false }: AccountFormProps) {
  const [accountName, setAccountName] = useState('')
  const [startingBalance, setStartingBalance] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError(null)

    if (!accountName.trim()) {
      setValidationError('Account name is required.')
      return
    }

    try {
      await onSubmit({
        account_name: accountName.trim(),
        starting_balance: parseFloat(startingBalance) || 0,
      })
      setAccountName('')
      setStartingBalance('')
    } catch (err: unknown) {
      setValidationError(err instanceof Error ? err.message : 'Failed to add account.')
    }
  }

  return (
    <Card className="bg-card border-white/10">
      <CardHeader className="border-b border-white/10 p-5">
        <CardTitle className="text-sm font-medium text-white uppercase tracking-wider">Add Account</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {validationError && (
            <div className="text-xs text-brand-expense bg-brand-expense/10 border border-brand-expense/20 px-3 py-2 rounded-lg">
              {validationError}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs text-gray-400">Account name</label>
            <input
              type="text"
              placeholder="e.g. Sonali Bank, Nagad"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              disabled={isSubmitting}
              className={inputStyles}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-gray-400">Starting balance (BDT)</label>
            <input
              type="number"
              step="any"
              placeholder="0.00"
              value={startingBalance}
              onChange={(e) => setStartingBalance(e.target.value)}
              disabled={isSubmitting}
              className={inputStyles}
            />
            <p className="text-[10px] text-gray-500">The money currently in this account — counts toward your total income.</p>
          </div>

          <div className="flex gap-3 pt-1">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-brand-income hover:bg-brand-income/95 text-white py-2 px-4 rounded-lg font-medium transition-all"
            >
              {isSubmitting ? 'Adding…' : 'Add Account'}
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
