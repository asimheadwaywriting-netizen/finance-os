import { NextResponse } from 'next/server'
import type { Transaction } from '@/lib/types'

// Proxy to n8n Workflow 2 (transaction-logger). The webhook URL lives in env
// vars only (Vercel dashboard / .env.local) — never in client-side code.
export const dynamic = 'force-dynamic'

const TIMEOUT_MS = 10_000

const REQUIRED_FIELDS: (keyof Transaction)[] = [
  'date',
  'type',
  'category',
  'payee',
  'amount',
  'account',
]

export async function POST(request: Request) {
  const url = process.env.N8N_TRANSACTION_WEBHOOK_URL
  if (!url) {
    return NextResponse.json(
      { error: 'N8N_TRANSACTION_WEBHOOK_URL is not configured' },
      { status: 503 }
    )
  }

  let body: Partial<Transaction>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Cheap pre-check so obviously broken payloads never hit n8n.
  // Full validation (types, date format, positive amount) happens in Workflow 2.
  const missing = REQUIRED_FIELDS.filter(
    (field) => body[field] === undefined || body[field] === ''
  )
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing required fields: ${missing.join(', ')}` },
      { status: 400 }
    )
  }

  // Demo deployment: accept the (valid) payload but never write to n8n/Sheets.
  // The frontend keeps the optimistic row until a refresh restores sample data.
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return NextResponse.json({ success: true, transaction: body })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: 'no-store',
    })
    // Pass n8n's response through as-is (success or 400 validation error)
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    console.error('[api/transactions] n8n fetch failed:', err)
    return NextResponse.json(
      { error: 'Transaction service unavailable' },
      { status: 503 }
    )
  } finally {
    clearTimeout(timeout)
  }
}
