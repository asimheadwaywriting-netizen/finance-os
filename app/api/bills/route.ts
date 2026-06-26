import { NextResponse } from 'next/server'
import { forwardToN8n } from '@/lib/n8n-proxy'

// Add / remove recurring bills. POST appends to the bills table via Workflow 9
// (record-creator); DELETE removes the row whose name matches via Workflow 8
// (record-remover). Column order for the Bills table: name, amount, due_day, category, account.
// Marking a bill paid/unpaid is NOT here — that logs/deletes a transaction via /api/transactions.
export const dynamic = 'force-dynamic'

interface BillInput {
  name?: string
  amount?: number | string
  due_day?: number | string
  category?: string
  account?: string
}

export async function POST(request: Request) {
  const url = process.env.N8N_CREATE_WEBHOOK_URL
  if (!url) {
    return NextResponse.json({ error: 'N8N_CREATE_WEBHOOK_URL is not configured' }, { status: 503 })
  }

  let body: BillInput
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.name || String(body.name).trim() === '') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  const amount = Number(body.amount)
  if (!isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
  }
  const dueDay = Number(body.due_day)
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
    return NextResponse.json({ error: 'due_day must be a whole number between 1 and 31' }, { status: 400 })
  }
  if (!body.category || String(body.category).trim() === '') {
    return NextResponse.json({ error: 'category is required' }, { status: 400 })
  }
  if (!body.account || String(body.account).trim() === '') {
    return NextResponse.json({ error: 'account is required' }, { status: 400 })
  }

  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return NextResponse.json({ success: true })
  }

  return forwardToN8n(url, {
    tab: 'Bills',
    values: [String(body.name).trim(), amount, dueDay, String(body.category).trim(), String(body.account).trim()],
  })
}

export async function DELETE(request: Request) {
  const url = process.env.N8N_DELETE_WEBHOOK_URL
  if (!url) {
    return NextResponse.json({ error: 'N8N_DELETE_WEBHOOK_URL is not configured' }, { status: 503 })
  }

  let body: { name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.name || String(body.name).trim() === '') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return NextResponse.json({ success: true })
  }

  return forwardToN8n(url, { tab: 'Bills', match: { name: String(body.name) } })
}
