import { NextResponse } from 'next/server'
import { forwardToN8n } from '@/lib/n8n-proxy'

// Add / remove assets. POST appends a row to the Assets tab via Workflow 9
// (record-creator); DELETE removes the row whose asset_name matches via Workflow 8
// (record-remover). Column order for the Assets tab (see CLAUDE.md):
//   asset_name, type, value, institution, start_date, maturity_date, interest_rate, notes
export const dynamic = 'force-dynamic'

interface AssetInput {
  asset_name?: string
  type?: string
  value?: number | string
  institution?: string
  start_date?: string
  maturity_date?: string
  interest_rate?: number | string
  notes?: string
}

export async function POST(request: Request) {
  const url = process.env.N8N_CREATE_WEBHOOK_URL
  if (!url) {
    return NextResponse.json(
      { error: 'N8N_CREATE_WEBHOOK_URL is not configured' },
      { status: 503 }
    )
  }

  let body: AssetInput
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.asset_name || String(body.asset_name).trim() === '') {
    return NextResponse.json({ error: 'asset_name is required' }, { status: 400 })
  }
  const value = Number(body.value)
  if (!isFinite(value) || value <= 0) {
    return NextResponse.json(
      { error: 'value must be a positive number' },
      { status: 400 }
    )
  }

  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return NextResponse.json({ success: true })
  }

  const values = [
    String(body.asset_name).trim(),
    String(body.type || ''),
    value,
    String(body.institution || ''),
    String(body.start_date || ''),
    String(body.maturity_date || ''),
    Number(body.interest_rate) || 0,
    String(body.notes || ''),
  ]
  return forwardToN8n(url, { tab: 'Assets', values })
}

export async function DELETE(request: Request) {
  const url = process.env.N8N_DELETE_WEBHOOK_URL
  if (!url) {
    return NextResponse.json(
      { error: 'N8N_DELETE_WEBHOOK_URL is not configured' },
      { status: 503 }
    )
  }

  let body: { asset_name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.asset_name || String(body.asset_name).trim() === '') {
    return NextResponse.json({ error: 'asset_name is required' }, { status: 400 })
  }

  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return NextResponse.json({ success: true })
  }

  return forwardToN8n(url, { tab: 'Assets', match: { asset_name: String(body.asset_name) } })
}
