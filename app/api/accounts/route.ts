import { NextResponse } from 'next/server'
import { forwardToN8n } from '@/lib/n8n-proxy'

// Add an account. POST appends a row to the Accounts tab via Workflow 9
// (record-creator). Column order for the Accounts tab: account_name, starting_balance.
// Once added, the aggregator (Workflow 1) returns it in accountBalances and the
// starting balance counts toward metrics.accountsStartingTotal ("Total Income So Far").
export const dynamic = 'force-dynamic'

interface AccountInput {
  account_name?: string
  starting_balance?: number | string
}

export async function POST(request: Request) {
  const url = process.env.N8N_CREATE_WEBHOOK_URL
  if (!url) {
    return NextResponse.json(
      { error: 'N8N_CREATE_WEBHOOK_URL is not configured' },
      { status: 503 }
    )
  }

  let body: AccountInput
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.account_name || String(body.account_name).trim() === '') {
    return NextResponse.json({ error: 'account_name is required' }, { status: 400 })
  }

  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return NextResponse.json({ success: true })
  }

  // as_of_date (internal): the balance is current as of today, so only expenses
  // logged after today reduce it. The user never sees or types this.
  const today = new Date().toISOString().slice(0, 10)
  const values = [String(body.account_name).trim(), Number(body.starting_balance) || 0, today]
  return forwardToN8n(url, { tab: 'Accounts', values })
}
