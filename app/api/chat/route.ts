import { NextResponse } from 'next/server'
import type { ChatMessage } from '@/lib/types'
import { getDemoChatReply } from '@/lib/demo-data'

// Proxy to n8n Workflow 3 (ai-chat-handler). The webhook URL lives in env
// vars only (Vercel dashboard / .env.local) — never in client-side code.
export const dynamic = 'force-dynamic'

// OpenAI can be slow; per CLAUDE.md the fallback after 30s is a graceful reply.
const TIMEOUT_MS = 30_000

const FALLBACK = { reply: 'AI temporarily unavailable. Please try again.' }

export async function POST(request: Request) {
  // Demo deployment: canned replies, no OpenAI call and no sheet writes.
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    let demoBody: { message?: string }
    try {
      demoBody = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    return NextResponse.json({
      reply: getDemoChatReply(demoBody.message || ''),
      action: null,
      transaction: null,
    })
  }

  const url = process.env.N8N_CHAT_WEBHOOK_URL
  if (!url) {
    return NextResponse.json(
      { error: 'N8N_CHAT_WEBHOOK_URL is not configured' },
      { status: 503 }
    )
  }

  let body: { message?: string; history?: ChatMessage[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.message || typeof body.message !== 'string') {
    return NextResponse.json(
      { error: 'Missing required field: message' },
      { status: 400 }
    )
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: body.message,
        history: Array.isArray(body.history) ? body.history : [],
      }),
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!res.ok) {
      throw new Error(`n8n responded with ${res.status}`)
    }
    // { reply, action, transaction } from Workflow 3
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('[api/chat] n8n fetch failed:', err)
    // Graceful degradation: the chat UI shows this as a normal AI message.
    return NextResponse.json(FALLBACK)
  } finally {
    clearTimeout(timeout)
  }
}
