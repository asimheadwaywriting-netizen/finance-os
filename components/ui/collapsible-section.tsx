'use client'

import React, { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CollapsibleSectionProps {
  title: string
  /** Small muted text on the right (e.g. "Showing 10 rows"). */
  badge?: string
  /** localStorage key so the collapsed/expanded choice sticks across reloads. */
  storageKey: string
  defaultOpen?: boolean
  children: React.ReactNode
}

// A section header you can click to collapse/expand its content. Used for the
// Assets and Transactions blocks, which Asim rarely needs expanded.
export default function CollapsibleSection({
  title,
  badge,
  storageKey,
  defaultOpen = true,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    try {
      const v = localStorage.getItem(storageKey)
      if (v !== null) setOpen(v === '1')
    } catch {
      // ignore — fall back to defaultOpen
    }
  }, [storageKey])

  const toggle = () => {
    setOpen((o) => {
      const next = !o
      try {
        localStorage.setItem(storageKey, next ? '1' : '0')
      } catch {
        // ignore persistence failures
      }
      return next
    })
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="flex items-center gap-2">
          <ChevronDown
            className={cn('h-4 w-4 text-gray-500 transition-transform duration-200', !open && '-rotate-90')}
          />
          <span className="font-sans font-medium text-sm text-white uppercase tracking-wider">{title}</span>
        </span>
        {badge && <span className="text-[10px] text-gray-500 font-mono">{badge}</span>}
      </button>
      {open && children}
    </div>
  )
}
