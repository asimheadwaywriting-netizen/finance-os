import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format an amount in Bangladeshi Taka with lakh-style grouping (e.g. ৳1,25,000).
 * Negative amounts render as -৳1,250.
 */
export function formatCurrency(amount: number): string {
  const sign = amount < 0 ? '-' : ''
  const formatted = Math.abs(amount).toLocaleString('en-IN', {
    maximumFractionDigits: 0,
  })
  return `${sign}৳${formatted}`
}

/**
 * Format an ISO date string (YYYY-MM-DD) as "12 Jun 2026".
 * Returns the input unchanged if it isn't a parseable date.
 */
export function formatDate(isoDate: string): string {
  const date = new Date(isoDate)
  if (isNaN(date.getTime())) return isoDate
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

