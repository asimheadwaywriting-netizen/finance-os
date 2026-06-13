'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { AssetInput } from '@/hooks/useAssets'

export interface AssetFormProps {
  onSubmit: (asset: AssetInput) => Promise<unknown>
  onCancel?: () => void
  isSubmitting?: boolean
}

const inputStyles =
  'flex h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-brand-income/50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors'

export default function AssetForm({ onSubmit, onCancel, isSubmitting = false }: AssetFormProps) {
  const [assetName, setAssetName] = useState('')
  const [type, setType] = useState('')
  const [value, setValue] = useState('')
  const [institution, setInstitution] = useState('')
  const [startDate, setStartDate] = useState('')
  const [maturityDate, setMaturityDate] = useState('')
  const [interestRate, setInterestRate] = useState('')
  const [notes, setNotes] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError(null)

    if (!assetName.trim()) {
      setValidationError('Asset name is required.')
      return
    }
    const valueNum = parseFloat(value)
    if (isNaN(valueNum) || valueNum <= 0) {
      setValidationError('Value must be a positive number.')
      return
    }

    try {
      await onSubmit({
        asset_name: assetName.trim(),
        type: type.trim(),
        value: valueNum,
        institution: institution.trim(),
        start_date: startDate,
        maturity_date: maturityDate,
        interest_rate: parseFloat(interestRate) || 0,
        notes: notes.trim(),
      })
      setAssetName('')
      setType('')
      setValue('')
      setInstitution('')
      setStartDate('')
      setMaturityDate('')
      setInterestRate('')
      setNotes('')
    } catch (err: unknown) {
      setValidationError(err instanceof Error ? err.message : 'Failed to add asset.')
    }
  }

  return (
    <Card className="bg-card border-white/10">
      <CardHeader className="border-b border-white/10 p-5">
        <CardTitle className="text-sm font-medium text-white uppercase tracking-wider">Add Asset</CardTitle>
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
              <label className="text-xs text-gray-400">Asset name</label>
              <input
                type="text"
                placeholder="e.g. BRAC FDR"
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
                disabled={isSubmitting}
                className={inputStyles}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">Type</label>
              <input
                type="text"
                placeholder="e.g. FDR, DPS, Sanchaypatra"
                value={type}
                onChange={(e) => setType(e.target.value)}
                disabled={isSubmitting}
                className={inputStyles}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">Value (BDT)</label>
              <input
                type="number"
                step="any"
                placeholder="0.00"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                disabled={isSubmitting}
                className={inputStyles}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">Institution</label>
              <input
                type="text"
                placeholder="e.g. BRAC Bank"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                disabled={isSubmitting}
                className={inputStyles}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={isSubmitting}
                className={inputStyles}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">Maturity date</label>
              <input
                type="date"
                value={maturityDate}
                onChange={(e) => setMaturityDate(e.target.value)}
                disabled={isSubmitting}
                className={inputStyles}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">Interest rate (%)</label>
              <input
                type="number"
                step="any"
                placeholder="0.0"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                disabled={isSubmitting}
                className={inputStyles}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">Notes (optional)</label>
              <input
                type="text"
                placeholder="Add details…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isSubmitting}
                className={inputStyles}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-brand-income hover:bg-brand-income/95 text-white py-2 px-4 rounded-lg font-medium transition-all"
            >
              {isSubmitting ? 'Adding…' : 'Add Asset'}
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
