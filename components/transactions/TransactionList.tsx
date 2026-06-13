'use client'

import React, { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import { Trash2 } from 'lucide-react'
import { CATEGORY_COLORS } from '@/lib/constants'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Transaction } from '@/lib/types'

export interface TransactionListProps {
  transactions?: Transaction[]
  title?: string
  /** When provided, a remove button appears on each row (confirm dialog first). */
  onRemove?: (tx: Transaction) => Promise<unknown>
  /** Category → hex color map (from live data). Falls back to the static palette. */
  categoryColors?: Record<string, string>
}

export default function TransactionList({
  transactions = [],
  title = "Recent Transactions",
  onRemove,
  categoryColors
}: TransactionListProps) {
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null)
  const [removing, setRemoving] = useState(false)

  const colorFor = (category: string) =>
    (categoryColors && categoryColors[category]) || CATEGORY_COLORS[category] || '#6b7280'

  const confirmRemove = async () => {
    if (!pendingDelete || !onRemove) return
    setRemoving(true)
    try {
      await onRemove(pendingDelete)
      setPendingDelete(null)
    } catch {
      // error surfaced by the caller's hook; keep the dialog open
    } finally {
      setRemoving(false)
    }
  }

  const colSpan = onRemove ? 7 : 6

  return (
    <div className="space-y-4">
      {title && (
        <div className="flex items-center justify-between">
          <h4 className="font-sans font-medium text-sm text-white uppercase tracking-wider">{title}</h4>
          <span className="text-[10px] text-gray-500 font-mono">Showing {transactions.length} rows</span>
        </div>
      )}

      <div className="rounded-lg border border-white/10 bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-white/[0.02] border-b border-white/10">
            <TableRow>
              <TableHead className="text-gray-400 font-medium text-xs">Date</TableHead>
              <TableHead className="text-gray-400 font-medium text-xs">Category</TableHead>
              <TableHead className="text-gray-400 font-medium text-xs">Payee</TableHead>
              <TableHead className="text-gray-400 font-medium text-xs">Account</TableHead>
              <TableHead className="text-gray-400 font-medium text-xs">Note</TableHead>
              <TableHead className="text-gray-400 font-medium text-xs text-right">Amount</TableHead>
              {onRemove && <TableHead className="text-gray-400 font-medium text-xs text-right w-10"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="h-24 text-center text-xs text-gray-500">
                  No transactions recorded.
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((tx, idx) => {
                const catColor = colorFor(tx.category)
                const isIncome = tx.type === 'Income'

                return (
                  <TableRow key={idx} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <TableCell className="text-xs text-gray-300 font-mono">
                      {formatDate(tx.date)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        style={{
                          backgroundColor: `${catColor}15`,
                          color: catColor,
                          borderColor: `${catColor}30`
                        }}
                        className="border font-normal text-[10px] py-0.5 px-2 rounded-md"
                      >
                        {tx.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-white font-medium">
                      {tx.payee}
                    </TableCell>
                    <TableCell className="text-xs text-gray-400">
                      {tx.account}
                    </TableCell>
                    <TableCell className="text-xs text-gray-500 max-w-[180px] truncate">
                      {tx.note || '—'}
                    </TableCell>
                    <TableCell className={`text-xs font-mono font-semibold text-right ${isIncome ? 'text-brand-income' : 'text-brand-expense'}`}>
                      {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                    </TableCell>
                    {onRemove && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label="Remove transaction"
                          className="text-gray-500 hover:text-brand-expense"
                          onClick={() => setPendingDelete(tx)}
                        >
                          <Trash2 />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remove transaction?"
        description={
          pendingDelete
            ? `${pendingDelete.type} of ${formatCurrency(pendingDelete.amount)} — ${pendingDelete.category} (${pendingDelete.payee}) on ${formatDate(pendingDelete.date)}. This deletes the row from your sheet.`
            : ''
        }
        loading={removing}
        onConfirm={confirmRemove}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
