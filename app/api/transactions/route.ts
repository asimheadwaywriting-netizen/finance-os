import { NextResponse } from 'next/server'
import type { Transaction } from '@/lib/types'

// Milestone 1 stub — validates shape, echoes the transaction back.
// Later milestone: forward to process.env.N8N_TRANSACTION_WEBHOOK_URL
// + 10s AbortController timeout + 503 on failure.

const REQUIRED_FIELDS: (keyof Transaction)[] = [
  'date',
  'type',
  'category',
  'payee',
  'amount',
  'account',
]

export async function POST(request: Request) {
  let body: Partial<Transaction>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const missing = REQUIRED_FIELDS.filter(
    (field) => body[field] === undefined || body[field] === ''
  )
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing required fields: ${missing.join(', ')}` },
      { status: 400 }
    )
  }

  return NextResponse.json({ success: true, transaction: body })
}
