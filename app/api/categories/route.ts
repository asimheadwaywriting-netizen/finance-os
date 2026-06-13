import { NextResponse } from 'next/server'
import { forwardToN8n } from '@/lib/n8n-proxy'

// Add a transaction category. POST appends a row to the Categories tab via
// Workflow 9 (record-creator). Column order for the Categories tab:
//   name, type, color
// Once added, the aggregator (Workflow 1) returns it in DashboardData.categories,
// so it appears in the log-transaction dropdown on the next refresh.
export const dynamic = 'force-dynamic'

interface CategoryInput {
  name?: string
  type?: string
  color?: string
}

export async function POST(request: Request) {
  const url = process.env.N8N_CREATE_WEBHOOK_URL
  if (!url) {
    return NextResponse.json(
      { error: 'N8N_CREATE_WEBHOOK_URL is not configured' },
      { status: 503 }
    )
  }

  let body: CategoryInput
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.name || String(body.name).trim() === '') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  if (body.type !== 'Income' && body.type !== 'Expense') {
    return NextResponse.json(
      { error: 'type must be Income or Expense' },
      { status: 400 }
    )
  }

  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return NextResponse.json({ success: true })
  }

  const values = [
    String(body.name).trim(),
    body.type,
    String(body.color || '#6b7280'),
  ]
  return forwardToN8n(url, { tab: 'Categories', values })
}
