'use client'

import React from 'react'
import { Button } from '@/components/ui/button'

export interface ConfirmDialogProps {
  open: boolean
  title?: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Lightweight confirm dialog: a fixed backdrop + centered card. No external
 * dialog primitive — reused by every destructive action (remove transaction /
 * goal / asset). Renders nothing when closed.
 */
export default function ConfirmDialog({
  open,
  title = 'Are you sure?',
  description = 'This action cannot be undone.',
  confirmLabel = 'Remove',
  cancelLabel = 'Cancel',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={loading ? undefined : onCancel}
      />
      <div className="relative w-full max-w-sm rounded-lg border border-white/10 bg-card p-6 shadow-xl">
        <h3 className="text-sm font-medium text-white">{title}</h3>
        <p className="mt-2 text-xs text-gray-400">{description}</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirm} disabled={loading}>
            {loading ? 'Removing…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
