import { NextResponse } from 'next/server'
import type { DashboardData } from '@/lib/types'

// Without this, Next statically prerenders this GET route at build time —
// fine for the stub, but it would serve stale data once n8n is wired up.
export const dynamic = 'force-dynamic'

// Milestone 1 stub — hardcoded data matching the DashboardData contract.
// Later milestone: replace with fetch(process.env.N8N_DASHBOARD_WEBHOOK_URL)
// + 10s AbortController timeout + 503 on failure.

const STUB_DATA: DashboardData = {
  metrics: {
    income: 185000,
    expenses: 112500,
    net: 72500,
    safeToSpend: 38200,
    daysLeftInMonth: 18,
  },
  accountBalances: [
    { name: 'Cash', balance: 12500 },
    { name: 'bKash', balance: 8300 },
    { name: 'Bank - DBBL', balance: 145000 },
  ],
  goals: [
    {
      name: 'Emergency Fund',
      target: 300000,
      saved: 120000,
      contribution: 15000,
      priority: 'High',
      progressPct: 40,
    },
    {
      name: 'New Laptop',
      target: 150000,
      saved: 45000,
      contribution: 10000,
      priority: 'Medium',
      progressPct: 30,
    },
  ],
  assets: [
    {
      name: 'DPS - DBBL',
      type: 'DPS',
      value: 96000,
      institution: 'DBBL',
      daysToMaturity: 412,
      interestRate: 7.5,
      maturityDate: '2027-07-29',
    },
  ],
  recentTransactions: [
    {
      date: '2026-06-11',
      type: 'Expense',
      category: 'Groceries',
      payee: 'Shwapno',
      amount: 2350,
      account: 'Cash',
      note: 'Weekly groceries',
    },
    {
      date: '2026-06-10',
      type: 'Expense',
      category: 'Bills & Utilities',
      payee: 'DESCO',
      amount: 1800,
      account: 'bKash',
      note: 'Electricity bill',
    },
    {
      date: '2026-06-09',
      type: 'Income',
      category: 'Freelance Income',
      payee: 'Upwork',
      amount: 45000,
      account: 'Bank - DBBL',
      note: 'n8n automation project',
    },
  ],
  spendingByCategory: [
    { category: 'Rent / Housing', amount: 35000 },
    { category: 'Groceries', amount: 18200 },
    { category: 'Bills & Utilities', amount: 9400 },
    { category: 'Food & Dining', amount: 7600 },
    { category: 'Transportation', amount: 5100 },
  ],
  monthlyTrend: [
    { month: 'Mar', income: 160000, expenses: 105000 },
    { month: 'Apr', income: 172000, expenses: 118000 },
    { month: 'May', income: 168000, expenses: 99000 },
    { month: 'Jun', income: 185000, expenses: 112500 },
  ],
}

export async function GET() {
  return NextResponse.json(STUB_DATA)
}
