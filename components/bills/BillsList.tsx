'use client'

import React, { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency, cn } from '@/lib/utils'
import type { Bill } from '@/lib/types'
import { Check, Undo2, AlertTriangle, Trash2 } from 'lucide-react'

export interface BillsListProps {
  bills: Bill[]
  committed: number
  unpaid: number
  onMarkPaid: (bill: Bill) => Promise<void>
  onUnmark: (bill: Bill) => Promise<void>
  onDelete: (name: string) => void
  categoryColors: Record<string, string>
}

export default function BillsList({
  bills,
  committed,
  unpaid,
  onMarkPaid,
  onUnmark,
  onDelete,
  categoryColors,
}: BillsListProps) {
  const [busy, setBusy] = useState<string | null>(null)

  const toggle = async (bill: Bill) => {
    setBusy(bill.name)
    try {
      await (bill.paid ? onUnmark(bill) : onMarkPaid(bill))
    } catch {
      // error surfaced by the hook
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card className="bg-card border-white/10 overflow-hidden">
      <CardContent className="p-0">
        {/* Summary header */}
        <div className="flex items-center justify-between gap-4 p-5 border-b border-white/10">
          <span className="text-sm font-medium text-white uppercase tracking-wider">Recurring Bills</span>
          <div className="flex items-center gap-5 text-xs font-mono">
            <span className="text-gray-400">
              Committed <span className="text-white">{formatCurrency(committed)}</span>
            </span>
            <span className="text-gray-400">
              Unpaid <span className={unpaid > 0 ? 'text-brand-warning' : 'text-brand-success'}>{formatCurrency(unpaid)}</span>
            </span>
          </div>
        </div>

        {bills.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500">
            No bills yet. Add your fixed monthly obligations (rent, utilities, subscriptions) to see what&apos;s committed.
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {bills.map((bill) => {
              const color = categoryColors[bill.category] || '#6b7280'
              const overdue = !bill.paid && bill.daysToDue < 0
              const dueSoon = !bill.paid && bill.daysToDue >= 0 && bill.daysToDue <= 7

              const statusText = bill.paid
                ? 'Paid'
                : overdue
                ? `Overdue · was due ${bill.dueDay}`
                : dueSoon
                ? bill.daysToDue === 0
                  ? 'Due today'
                  : `Due in ${bill.daysToDue} ${bill.daysToDue === 1 ? 'day' : 'days'}`
                : `Due ${bill.dueDay}`
              const statusColor = bill.paid
                ? 'text-brand-success'
                : overdue
                ? 'text-brand-expense'
                : dueSoon
                ? 'text-brand-warning'
                : 'text-gray-500'

              return (
                <li key={bill.name} className="flex items-center gap-3 p-4 sm:px-5">
                  <div className="flex-shrink-0">
                    {bill.paid ? (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-success/15 text-brand-success">
                        <Check className="h-4 w-4" />
                      </span>
                    ) : overdue ? (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-expense/15 text-brand-expense">
                        <AlertTriangle className="h-4 w-4" />
                      </span>
                    ) : (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-gray-500 text-[10px] font-mono">
                        {bill.dueDay}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm text-white">{bill.name}</span>
                      <span
                        className="hidden sm:inline border font-normal text-[10px] py-0.5 px-1.5 rounded"
                        style={{ backgroundColor: `${color}15`, color, borderColor: `${color}30` }}
                      >
                        {bill.category}
                      </span>
                    </div>
                    <div className={cn('text-[11px] font-mono', statusColor)}>{statusText}</div>
                  </div>

                  <div className="flex-shrink-0 text-right font-mono text-sm text-gray-100">
                    {formatCurrency(bill.amount)}
                  </div>

                  <div className="flex flex-shrink-0 items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy === bill.name}
                      onClick={() => toggle(bill)}
                      className={cn(
                        'h-8 border-white/10 text-xs',
                        bill.paid ? 'text-gray-400' : 'text-brand-success'
                      )}
                    >
                      {busy === bill.name ? (
                        '…'
                      ) : bill.paid ? (
                        <>
                          <Undo2 className="h-3.5 w-3.5" /> Unmark
                        </>
                      ) : (
                        <>
                          <Check className="h-3.5 w-3.5" /> Mark paid
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Remove bill"
                      className="text-gray-500 hover:text-brand-expense"
                      onClick={() => onDelete(bill.name)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
