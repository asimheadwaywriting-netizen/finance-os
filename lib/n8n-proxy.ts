import { NextResponse } from 'next/server'

// Shared helper for the mutation API routes (transactions DELETE, goals, assets,
// categories). POSTs a JSON body to an n8n webhook with a 10s timeout and passes
// n8n's response through as-is (success or 400 validation error). 503 if n8n is
// unreachable. Webhook URLs live in env vars only — never in client-side code.

const TIMEOUT_MS = 10_000

export async function forwardToN8n(url: string, body: unknown) {
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
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    console.error('[n8n-proxy] fetch failed:', err)
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  } finally {
    clearTimeout(timeout)
  }
}
