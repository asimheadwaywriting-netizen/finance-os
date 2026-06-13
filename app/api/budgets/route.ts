import { NextResponse } from 'next/server'
import { forwardToN8n } from '@/lib/n8n-proxy'

// Add / remove per-category monthly budgets. POST appends to the Budgets tab via
// Workflow 9 (record-creator); DELETE removes the row whose category matches via
// Workflow 8 (record-remover). Column order for the Budgets tab: category, monthly_limit.
export const dynamic = 'force-dynamic'

interface BudgetInput {
  category?: string
  monthly_limit?: number | string
}

export async function POST(request: Request) {
  const url = process.env.N8N_CREATE_WEBHOOK_URL
  if (!url) {
    return NextResponse.json({ error: 'N8N_CREATE_WEBHOOK_URL is not configured' }, { status: 503 })
  }

  let body: BudgetInput
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.category || String(body.category).trim() === '') {
    return NextResponse.json({ error: 'category is required' }, { status: 400 })
  }
  const limit = Number(body.monthly_limit)
  if (!isFinite(limit) || limit <= 0) {
    return NextResponse.json({ error: 'monthly_limit must be a positive number' }, { status: 400 })
  }

  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return NextResponse.json({ success: true })
  }

  return forwardToN8n(url, { tab: 'Budgets', values: [String(body.category).trim(), limit] })
}

export async function DELETE(request: Request) {
  const url = process.env.N8N_DELETE_WEBHOOK_URL
  if (!url) {
    return NextResponse.json({ error: 'N8N_DELETE_WEBHOOK_URL is not configured' }, { status: 503 })
  }

  let body: { category?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.category || String(body.category).trim() === '') {
    return NextResponse.json({ error: 'category is required' }, { status: 400 })
  }

  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return NextResponse.json({ success: true })
  }

  return forwardToN8n(url, { tab: 'Budgets', match: { category: String(body.category) } })
}
