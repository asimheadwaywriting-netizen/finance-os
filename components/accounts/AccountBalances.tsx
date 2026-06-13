'use client'

import React from 'react'
import { cn, formatCurrency } from '@/lib/utils'

export interface AccountBalancesProps {
  accounts?: { name: string; balance: number }[]
}

export default function AccountBalances({ accounts = [] }: AccountBalancesProps) {
  if (accounts.length === 0) {
    return (
      <p className="text-xs text-gray-500 text-center py-6">No accounts found.</p>
    )
  }

  const total = accounts.reduce((sum, acc) => sum + acc.balance, 0)

  return (
    <div className="space-y-3">
      {accounts.map((acc, idx) => {
        const isNegative = acc.balance < 0
        return (
          <div
            key={idx}
            className="flex justify-between items-center p-2.5 rounded bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/[0.07] transition-all"
          >
            <span className="text-xs font-medium text-gray-300">{acc.name}</span>
            <span
              className={cn(
                'text-xs font-mono font-semibold',
                isNegative ? 'text-brand-expense' : 'text-brand-income'
              )}
            >
              {isNegative ? '' : '+'}
              {formatCurrency(acc.balance)}
            </span>
          </div>
        )
      })}

      {/* Total = cash in hand (all accounts combined) */}
      <div className="flex justify-between items-center px-2.5 pt-3 mt-1 border-t border-white/10">
        <span className="text-xs font-semibold text-white uppercase tracking-wide">Total (cash in hand)</span>
        <span
          className={cn(
            'text-sm font-mono font-bold',
            total < 0 ? 'text-brand-expense' : 'text-white'
          )}
        >
          {formatCurrency(total)}
        </span>
      </div>
    </div>
  )
}
