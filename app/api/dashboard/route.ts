import { NextResponse } from 'next/server'
import type { DashboardData } from '@/lib/types'

// Proxy to n8n Workflow 1 (finance-data-aggregator). The webhook URL lives in
// env vars only (Vercel dashboard / .env.local) — never in client-side code.
export const dynamic = 'force-dynamic'

const TIMEOUT_MS = 10_000

export async function GET() {
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
