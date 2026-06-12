import { NextResponse } from 'next/server'

// Milestone 1 stub — returns a canned reply.
// Later milestone: forward to process.env.N8N_CHAT_WEBHOOK_URL (OpenAI via n8n)
// + 30s timeout with "AI temporarily unavailable" fallback.

export async function POST(request: Request) {
  let body: { message?: string }
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

  return NextResponse.json({
    reply: `(stub) AI assistant not wired up yet. You said: "${body.message}"`,
  })
}
