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
import { AlertTriangle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import type { DashboardData } from '@/lib/types'

type Asset = DashboardData['assets'][number]

export interface AssetMaturityTrackerProps {
  assets?: Asset[]
  title?: string
  /** When provided, a remove button appears on each row (confirm dialog first). */
  onRemove?: (assetName: string) => Promise<unknown>
}

export default function AssetMaturityTracker({
  assets = [],
  title = 'Assets & Maturities',
  onRemove
}: AssetMaturityTrackerProps) {
  const [pendingDelete, setPendingDelete] = useState<Asset | null>(null)
  const [removing, setRemoving] = useState(false)

  const confirmRemove = async () => {
    if (!pendingDelete || !onRemove) return
    setRemoving(true)
    try {
      await onRemove(pendingDelete.name)
      setPendingDelete(null)
    } catch {
      // error surfaced by the caller's hook; keep the dialog open
    } finally {
      setRemoving(false)
    }
  }

  // Soonest maturity first; assets with no maturity date (e.g. open DPS) last.
  const sorted = [...assets].sort((a, b) => {
    if (a.daysToMaturity === null) return 1
    if (b.daysToMaturity === null) return -1
    return a.daysToMaturity - b.daysToMaturity
  })

  return (
    <div className="space-y-4">
      {title && (
        <div className="flex items-center justify-between">
          <h4 className="font-sans font-medium text-sm text-white uppercase tracking-wider">{title}</h4>
          <span className="text-[10px] text-gray-500 font-mono">Showing {sorted.length} assets</span>
        </div>
      )}

      <div className="rounded-lg border border-white/10 bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-white/[0.02] border-b border-white/10">
            <TableRow>
              <TableHead className="text-gray-400 font-medium text-xs">Asset</TableHead>
              <TableHead className="text-gray-400 font-medium text-xs">Type</TableHead>
              <TableHead className="text-gray-400 font-medium text-xs">Institution</TableHead>
              <TableHead className="text-gray-400 font-medium text-xs text-right">Value</TableHead>
              <TableHead className="text-gray-400 font-medium text-xs text-right">Rate</TableHead>
              <TableHead className="text-gray-400 font-medium text-xs">Matures</TableHead>
              <TableHead className="text-gray-400 font-medium text-xs text-right">Days left</TableHead>
              {onRemove && <TableHead className="text-gray-400 font-medium text-xs text-right w-10"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={onRemove ? 8 : 7} className="h-24 text-center text-xs text-gray-500">
                  No assets recorded.
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((asset, idx) => {
                const days = asset.daysToMaturity
                const isUrgent = days !== null && days <= 7
                const isSoon = days !== null && days <= 30

                return (
                  <TableRow key={idx} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <TableCell className="text-xs text-white font-medium">
                      {asset.name}
                    </TableCell>
                    <TableCell className="text-xs text-gray-400">
                      {asset.type}
                    </TableCell>
                    <TableCell className="text-xs text-gray-400">
                      {asset.institution}
                    </TableCell>
                    <TableCell className="text-xs font-mono font-semibold text-right text-gray-100">
                      {formatCurrency(asset.value)}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-right text-gray-400">
                      {asset.interestRate}%
                    </TableCell>
                    <TableCell className="text-xs text-gray-400 font-mono">
                      {asset.maturityDate ? formatDate(asset.maturityDate) : '—'}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-xs font-mono font-semibold text-right',
                        isUrgent
                          ? 'text-brand-expense'
                          : isSoon
                            ? 'text-brand-warning'
                            : 'text-gray-300'
                      )}
                    >
                      {days === null ? (
                        '—'
                      ) : (
                        <span className="inline-flex items-center gap-1.5 justify-end">
                          {isSoon && <AlertTriangle className="w-3 h-3" />}
                          {days}
                        </span>
                      )}
                    </TableCell>
                    {onRemove && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label="Remove asset"
                          className="text-gray-500 hover:text-brand-expense"
                          onClick={() => setPendingDelete(asset)}
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
        title="Remove asset?"
        description={
          pendingDelete
            ? `${pendingDelete.name} (${formatCurrency(pendingDelete.value)}) at ${pendingDelete.institution || 'unknown'}. This deletes the row from your sheet.`
            : ''
        }
        loading={removing}
        onConfirm={confirmRemove}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
