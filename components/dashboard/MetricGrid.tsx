'use client'

import React from 'react'
import MetricCard from './MetricCard'
import { TrendingUp, TrendingDown, Wallet, Sparkles } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { DashboardData } from '@/lib/types'

export interface MetricGridProps {
  data?: DashboardData['metrics']
  trend?: DashboardData['monthlyTrend']
  accounts?: DashboardData['accountBalances']
  loading?: boolean
}

export default function MetricGrid({
  data,
  trend,
  accounts,
  loading = false
}: MetricGridProps) {
  if (loading || !data || !accounts || !trend) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <MetricCard title="Cash in Hand" value={0} loading={true} />
        <MetricCard title="Total Expense So Far" value={0} loading={true} />
        <MetricCard title="Total Income So Far" value={0} loading={true} />
        <MetricCard title="Net Saving" value={0} loading={true} />
      </div>
    )
  }

  // Calculate dynamic deltas if we have enough trend history
  let incomeDelta
  let expenseDelta

  if (trend.length >= 2) {
    const current = trend[trend.length - 1]
    const previous = trend[trend.length - 2]

    // Income Delta
    if (previous.income > 0) {
      const pct = ((current.income - previous.income) / previous.income) * 100
      incomeDelta = {
        value: parseFloat(Math.abs(pct).toFixed(1)),
        isPositive: pct >= 0,
        label: `vs ${previous.month}`
      }
    }

    // Expense Delta
    if (previous.expenses > 0) {
      const pct = ((current.expenses - previous.expenses) / previous.expenses) * 100
      // In terms of expenses, an increase is technically "negative" financially,
      // but let's keep isPositive representing whether the number went up or down,
      // or let's flag went up as positive = true.
      expenseDelta = {
        value: parseFloat(Math.abs(pct).toFixed(1)),
        isPositive: pct < 0, // Invert: negative change is green/positive for savings
        label: pct < 0 ? `less vs ${previous.month}` : `more vs ${previous.month}`
      }
      // Actually, let's keep isPositive as "is it financially good?" or "did the value increase?".
      // If we look at the styling: isPositive = true will show in brand-income (blue), isPositive = false in brand-expense (orange).
      // If expenses went down, it's financially good (blue/positive). If expenses went up, it's orange/negative.
      // So expenseDelta.isPositive should be true if pct < 0 (expenses decreased). This is very elegant!
    }
  }

  // Cash in Hand = the real money held right now (sum of all account balances).
  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0)

  // Net Saving is a month-END figure: it stays 0 during the month and locks in the
  // month's net only on the last day (daysLeftInMonth === 0). The caption shows the
  // running figure so the in-progress number isn't lost.
  const isMonthEnd = data.daysLeftInMonth === 0
  const netSaving = isMonthEnd ? data.net : 0
  const netSavingCaption = isMonthEnd
    ? 'Final saving for this month'
    : `So far: ${formatCurrency(data.net)} · finalized at month-end`

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      <MetricCard
        title="Cash in Hand"
        value={totalBalance}
        type="neutral"
        icon={<Wallet className="w-4 h-4 text-gray-400" />}
      />
      <MetricCard
        title="Total Expense So Far"
        value={data.expenses}
        type="expense"
        delta={expenseDelta}
        icon={<TrendingDown className="w-4 h-4 text-brand-expense" />}
      />
      <MetricCard
        title="Total Income So Far"
        value={data.income}
        type="income"
        delta={incomeDelta}
        icon={<TrendingUp className="w-4 h-4 text-brand-income" />}
      />
      <MetricCard
        title="Net Saving"
        value={netSaving}
        type={netSaving >= 0 ? "income" : "expense"}
        caption={netSavingCaption}
        icon={<Sparkles className="w-4 h-4 text-amber-500" />}
      />
    </div>
  )
}
