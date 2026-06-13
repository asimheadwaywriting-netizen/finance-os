import { NextResponse } from 'next/server'
import { forwardToN8n } from '@/lib/n8n-proxy'

// Add / remove savings goals. POST appends a row to the Goals tab via Workflow 9
// (record-creator); DELETE removes the row whose goal_name matches via Workflow 8
// (record-remover). Column order for the Goals tab (see CLAUDE.md):
//   goal_name, target_amount, saved_so_far, monthly_contribution, priority
export const dynamic = 'force-dynamic'

interface GoalInput {
  goal_name?: string
  target_amount?: number | string
  saved_so_far?: number | string
  monthly_contribution?: number | string
  priority?: string
}

export async function POST(request: Request) {
  const url = process.env.N8N_CREATE_WEBHOOK_URL
  if (!url) {
    return NextResponse.json(
      { error: 'N8N_CREATE_WEBHOOK_URL is not configured' },
      { status: 503 }
    )
  }

  let body: GoalInput
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.goal_name || String(body.goal_name).trim() === '') {
    return NextResponse.json({ error: 'goal_name is required' }, { status: 400 })
  }
  const target = Number(body.target_amount)
  if (!isFinite(target) || target <= 0) {
    return NextResponse.json(
      { error: 'target_amount must be a positive number' },
      { status: 400 }
    )
  }

  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return NextResponse.json({ success: true })
  }

  const values = [
    String(body.goal_name).trim(),
    target,
    Number(body.saved_so_far) || 0,
    Number(body.monthly_contribution) || 0,
    String(body.priority || 'Medium'),
  ]
  return forwardToN8n(url, { tab: 'Goals', values })
}

export async function DELETE(request: Request) {
  const url = process.env.N8N_DELETE_WEBHOOK_URL
  if (!url) {
    return NextResponse.json(
      { error: 'N8N_DELETE_WEBHOOK_URL is not configured' },
      { status: 503 }
    )
  }

  let body: { goal_name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.goal_name || String(body.goal_name).trim() === '') {
    return NextResponse.json({ error: 'goal_name is required' }, { status: 400 })
  }

  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return NextResponse.json({ success: true })
  }

  return forwardToN8n(url, { tab: 'Goals', match: { goal_name: String(body.goal_name) } })
}
