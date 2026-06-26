import { useState } from 'react'
import { mutate } from 'swr'
import type { Bill, DashboardData, Transaction } from '@/lib/types'
import { useTransactions } from '@/hooks/useTransactions'

const isDemo = () => process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

export interface BillInput {
  name: string
  amount: number
  due_day: number
  category: string
  account: string
}

/** The transaction a bill becomes when marked paid. Dated to the bill's due date
 *  (month-stable) so unmark can match and delete it exactly, any day you click. */
function billTransaction(bill: Bill): Transaction {
  return {
    date: bill.dueDate,
    type: 'Expense',
    category: bill.category,
    payee: bill.name,
    amount: bill.amount,
    account: bill.account,
    note: `bill:${bill.name}`,
  }
}

/** Optimistically flip a bill's paid flag + the unpaid total in the dashboard cache. */
function patchPaid(name: string, paid: boolean) {
  return mutate(
    '/api/dashboard',
    (d: DashboardData | undefined) => {
      if (!d) return d
      let delta = 0
      const bills = d.bills.map((b) => {
        if (b.name !== name || b.paid === paid) return b
        delta = paid ? -b.amount : b.amount
        return { ...b, paid }
      })
      return { ...d, bills, metrics: { ...d.metrics, billsUnpaid: d.metrics.billsUnpaid + delta } }
    },
    { revalidate: false, populateCache: true }
  )
}

export function useBills() {
  const { addTransaction, removeTransaction } = useTransactions()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = async (method: 'POST' | 'DELETE', body: unknown) => {
    const res = await fetch('/api/bills', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      throw new Error(errorData.error || `Request failed: ${res.statusText}`)
    }
  }

  const addBill = async (bill: BillInput) => {
    setIsSubmitting(true)
    setError(null)
    try {
      if (isDemo()) {
        await mutate(
          '/api/dashboard',
          (d: DashboardData | undefined) => {
            if (!d) return d
            const dueDay = Math.min(Math.max(bill.due_day, 1), 31)
            const dueDate = `${new Date().toISOString().slice(0, 7)}-${String(dueDay).padStart(2, '0')}`
            const optimistic: Bill = { ...bill, dueDay, dueDate, paid: false, daysToDue: 0 }
            return {
              ...d,
              bills: [...d.bills, optimistic],
              metrics: {
                ...d.metrics,
                billsCommitted: d.metrics.billsCommitted + bill.amount,
                billsUnpaid: d.metrics.billsUnpaid + bill.amount,
              },
            }
          },
          { revalidate: false, populateCache: true }
        )
        return true
      }
      await send('POST', bill)
      await mutate('/api/dashboard')
      return true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add bill'
      setError(msg)
      throw err
    } finally {
      setIsSubmitting(false)
    }
  }

  const removeBill = async (name: string) => {
    setIsSubmitting(true)
    setError(null)
    try {
      if (isDemo()) {
        await mutate(
          '/api/dashboard',
          (d: DashboardData | undefined) =>
            d ? { ...d, bills: d.bills.filter((b) => b.name !== name) } : d,
          { revalidate: false, populateCache: true }
        )
        return true
      }
      await send('DELETE', { name })
      await mutate('/api/dashboard')
      return true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to remove bill'
      setError(msg)
      throw err
    } finally {
      setIsSubmitting(false)
    }
  }

  // Mark paid = log the bill's payment as a real Expense transaction (so it flows into
  // expenses + budgets). Unmark = delete that same transaction. The aggregator derives
  // `paid` from whether a current-month `bill:<name>` transaction exists.
  const markPaid = async (bill: Bill) => {
    setError(null)
    await patchPaid(bill.name, true)
    try {
      await addTransaction(billTransaction(bill))
    } catch (err: unknown) {
      await patchPaid(bill.name, false)
      setError(err instanceof Error ? err.message : 'Failed to mark paid')
      throw err
    }
  }

  const unmarkPaid = async (bill: Bill) => {
    setError(null)
    await patchPaid(bill.name, false)
    try {
      await removeTransaction(billTransaction(bill))
    } catch (err: unknown) {
      await patchPaid(bill.name, true)
      setError(err instanceof Error ? err.message : 'Failed to unmark')
      throw err
    }
  }

  return { addBill, removeBill, markPaid, unmarkPaid, isSubmitting, error }
}
