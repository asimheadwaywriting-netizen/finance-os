'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MetricCardProps {
  title: string
  value: number
  type?: 'income' | 'expense' | 'neutral'
  delta?: {
    value: number
    isPositive: boolean
    label: string
  }
  /** Small contrasting line under the value (e.g. "final at month-end"). */
  caption?: string
  icon?: React.ReactNode
  loading?: boolean
}

export default function MetricCard({
  title,
  value,
  type = 'neutral',
  delta,
  caption,
  icon,
  loading = false
}: MetricCardProps) {
  if (loading) {
    return (
      <Card className="bg-card border-white/10">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24 bg-white/5" />
            <Skeleton className="h-5 w-5 rounded-full bg-white/5" />
          </div>
          <Skeleton className="h-8 w-36 bg-white/5" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-12 bg-white/5" />
            <Skeleton className="h-3 w-20 bg-white/5" />
          </div>
        </CardContent>
      </Card>
    )
  }

  // Type-specific colors for text and badges
  const typeColorClasses = {
    income: 'text-brand-income',
    expense: 'text-brand-expense',
    neutral: 'text-white'
  }

  const badgeColorClasses = {
    income: 'bg-brand-income/10 text-brand-income border-brand-income/20',
    expense: 'bg-brand-expense/10 text-brand-expense border-brand-expense/20',
    neutral: 'bg-white/5 text-gray-400 border-white/5'
  }

  return (
    <Card className="bg-card border-white/10 hover:border-white/20 transition-all duration-300 relative group overflow-hidden">
      {/* Visual Accent Glow (micro-animation on hover) */}
      <div className={cn(
        "absolute top-0 left-0 right-0 h-[2px] transition-all duration-300 opacity-50 group-hover:opacity-100",
        type === 'income' && "bg-brand-income",
        type === 'expense' && "bg-brand-expense",
        type === 'neutral' && "bg-brand-neutral"
      )} />

      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-gray-500 tracking-wide uppercase">{title}</span>
          {icon && (
            <div className="p-1.5 rounded-lg bg-white/5 text-gray-400 border border-white/5">
              {icon}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className={cn("text-2xl font-semibold font-mono tracking-tight", typeColorClasses[type])}>
            {formatCurrency(value)}
          </div>

          {delta && (
            <div className="flex items-center gap-1.5">
              <span className={cn(
                "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono border font-medium leading-none",
                delta.isPositive ? badgeColorClasses.income : badgeColorClasses.expense
              )}>
                {delta.isPositive ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                {delta.value}%
              </span>
              <span className="text-[10px] text-gray-500">{delta.label}</span>
            </div>
          )}

          {caption && (
            <div className="mt-1 inline-block rounded bg-brand-warning/10 border border-brand-warning/20 px-2 py-1 text-[10px] font-mono text-brand-warning leading-tight">
              {caption}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
