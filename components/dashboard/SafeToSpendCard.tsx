'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'
import { CalendarDays, AlertCircle } from 'lucide-react'

export interface SafeToSpendCardProps {
  safeToSpend?: number
  daysLeft?: number
  loading?: boolean
}

export default function SafeToSpendCard({
  safeToSpend,
  daysLeft,
  loading = false
}: SafeToSpendCardProps) {
  if (loading || safeToSpend === undefined || daysLeft === undefined) {
    return (
      <Card className="bg-gradient-to-br from-card to-card/50 border-brand-income/20">
        <CardContent className="p-8 space-y-4">
          <Skeleton className="h-4 w-28 bg-white/5" />
          <Skeleton className="h-12 w-48 bg-white/5" />
          <Skeleton className="h-6 w-36 bg-white/5" />
        </CardContent>
      </Card>
    )
  }

  // Calculate current date details to know total days in the current month
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth() // 0-indexed
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate()
  
  // Calculate percentage of the month completed vs remaining
  const daysPassed = totalDaysInMonth - daysLeft
  const progressPct = Math.max(0, Math.min(100, (daysPassed / totalDaysInMonth) * 100))

  // Warning thresholds
  const isCritical = safeToSpend <= 5000 && daysLeft > 5
  const isWarning = safeToSpend <= 10000 && daysLeft > 10

  return (
    <Card className="relative bg-gradient-to-br from-card to-card/40 border-brand-income/20 hover:border-brand-income/40 transition-all duration-500 overflow-hidden group">
      {/* Decorative premium glow vector in the background (similar to the sphere in reference image) */}
      <div className="absolute right-0 bottom-0 w-48 h-48 bg-brand-income/5 rounded-full blur-3xl pointer-events-none group-hover:bg-brand-income/10 transition-all duration-500" />
      
      <CardContent className="p-8 relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-4">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-brand-income uppercase tracking-wider">Safe to Spend</span>
            <h3 className="text-4xl sm:text-5xl font-bold font-mono tracking-tight text-white">
              {formatCurrency(safeToSpend)}
            </h3>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <CalendarDays className="w-4 h-4 text-brand-income" />
            <span>
              <strong className="text-white font-mono">{daysLeft}</strong> {daysLeft === 1 ? 'day' : 'days'} remaining in this billing cycle
            </span>
          </div>

          {(isWarning || isCritical) && (
            <div className="flex items-center gap-2 text-xs bg-brand-warning/10 border border-brand-warning/20 text-brand-warning px-3 py-1.5 rounded-lg max-w-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>Remaining budget is low for the days left in the month.</span>
            </div>
          )}
        </div>

        {/* Custom Progress Meter */}
        <div className="w-full md:w-72 space-y-2">
          <div className="flex justify-between text-xs text-gray-500 font-mono">
            <span>Billing Progress</span>
            <span>{Math.round(progressPct)}% Completed</span>
          </div>
          <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
            <div 
              className="h-full bg-brand-income rounded-full transition-all duration-1000 ease-out" 
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-gray-500 font-mono">
            <span>Day 1</span>
            <span>Day {totalDaysInMonth}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
