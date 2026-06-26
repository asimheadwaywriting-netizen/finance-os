import { NextResponse } from 'next/server'
import type { DashboardData } from '@/lib/types'
import { getDemoDashboard } from '@/lib/demo-data'
import { getDashboardData } from '@/lib/dashboard'

// Dashboard read path. Prefers a direct Postgres query (DATABASE_URL set) — one
// hop, no n8n. Falls back to the n8n webhook when DATABASE_URL is absent, so the
// migration can be rolled out without a flag day.
export const dynamic = 'force-dynamic'

const TIMEOUT_MS = 10_000

export async function GET() {
  // Demo deployment: serve self-contained sample data, never touch the DB/n8n.
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return NextResponse.json(getDemoDashboard())
  }

  // Fast path: direct from Postgres via APP_DATABASE_URL — a dedicated, app-controlled
  // var. NOT Vercel's integration-managed DATABASE_URL: its deployed value points at a
  // stale/divergent Neon branch (returned 131,648 vs the real 105,648). If APP_DATABASE_URL
  // is unset, fall back to the n8n webhook (canonical data).
  if (process.env.APP_DATABASE_URL) {
    try {
      return NextResponse.json(await getDashboardData())
    } catch (err) {
      console.error('[api/dashboard] direct DB query failed:', err)
      return NextResponse.json({ error: 'Dashboard data unavailable' }, { status: 503 })
    }
  }

  // Default path: n8n Workflow 1 webhook (reads the canonical database).
  const url = process.env.N8N_DASHBOARD_WEBHOOK_URL
  if (!url) {
    return NextResponse.json(
      { error: 'N8N_DASHBOARD_WEBHOOK_URL is not configured' },
      { status: 503 }
    )
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!res.ok) {
      throw new Error(`n8n responded with ${res.status}`)
    }
    const data: DashboardData = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('[api/dashboard] n8n fetch failed:', err)
    return NextResponse.json(
      { error: 'Dashboard data unavailable' },
      { status: 503 }
    )
  } finally {
    clearTimeout(timeout)
  }
}
