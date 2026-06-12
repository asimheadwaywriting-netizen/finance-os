'use client'

import React from 'react'
import MetricCard from './MetricCard'
import { TrendingUp, TrendingDown, Landmark, Sparkles } from 'lucide-react'
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
        <MetricCard title="Monthly Income" value={0} loading={true} />
        <MetricCard title="Monthly Expenses" value={0} loading={true} />
        <MetricCard title="Net Savings" value={0} loading={true} />
        <MetricCard title="Total Balances" value={0} loading={true} />
      </div>
    )
  }

  // Calculate dynamic deltas if we have enough trend history
  let incomeDelta
  let expenseDelta
  let netDelta

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

    // Net Delta
    const currentNet = current.income - current.expenses
    const previousNet = previous.income - previous.expenses
    if (previousNet !== 0) {
      const pct = ((currentNet - previousNet) / Math.abs(previousNet)) * 100
      netDelta = {
        value: parseFloat(Math.abs(pct).toFixed(1)),
        isPositive: pct >= 0,
        label: `vs ${previous.month}`
      }
    }
  }

  // Calculate total account balances
  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      <MetricCard 
        title="Monthly Income" 
        value={data.income} 
        type="income"
        delta={incomeDelta}
        icon={<TrendingUp className="w-4 h-4 text-brand-income" />}
      />
      <MetricCard 
        title="Monthly Expenses" 
        value={data.expenses} 
        type="expense"
        delta={expenseDelta}
        icon={<TrendingDown className="w-4 h-4 text-brand-expense" />}
      />
      <MetricCard 
        title="Net Savings" 
        value={data.net} 
        type={data.net >= 0 ? "income" : "expense"}
        delta={netDelta}
        icon={<Sparkles className="w-4 h-4 text-amber-500" />}
      />
      <MetricCard 
        title="Total Balances" 
        value={totalBalance} 
        type="neutral"
        icon={<Landmark className="w-4 h-4 text-gray-400" />}
      />
    </div>
  )
}
