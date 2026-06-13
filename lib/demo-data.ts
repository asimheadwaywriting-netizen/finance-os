// Demo mode: self-contained sample data so a public demo deployment can show the
// full dashboard with no n8n / Google Sheets / OpenAI behind it. Activated by
// NEXT_PUBLIC_DEMO_MODE === 'true'. Never used by the real production app.

import sample from '@/n8n/sample-dashboard-response.json'
import { CATEGORY_LIST } from '@/lib/constants'
import type { DashboardData } from '@/lib/types'

const base = sample as DashboardData

// The demo's category list mirrors the static seed taxonomy (the real app reads
// these from the Sheet's Categories tab).
const demoCategories: DashboardData['categories'] = CATEGORY_LIST.map((c) => ({
  name: c.name,
  type: c.type,
  color: c.color,
}))

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function daysFromToday(iso: string): number {
  const today = startOfDay(new Date()).getTime()
  const target = startOfDay(new Date(iso)).getTime()
  return Math.round((target - today) / 86_400_000)
}

function daysLeftInMonth(): number {
  const now = new Date()
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  return lastDay - now.getDate()
}

// Per-day income/expense for the current month (up to today), aggregated from the
// sample's recent transactions — so the demo's daily chart has believable shape.
function buildDailyTrend(): DashboardData['dailyTrend'] {
  const now = new Date()
  const ym = now.toISOString().slice(0, 7)
  const byDay: Record<string, { income: number; expenses: number }> = {}
  for (const t of base.recentTransactions || []) {
    if (!t.date || !t.date.startsWith(ym)) continue
    const dd = t.date.slice(8, 10)
    if (!byDay[dd]) byDay[dd] = { income: 0, expenses: 0 }
    byDay[dd][t.type === 'Income' ? 'income' : 'expenses'] += t.amount
  }
  const out: DashboardData['dailyTrend'] = []
  for (let i = 1; i <= now.getDate(); i++) {
    const k = String(i).padStart(2, '0')
    const e = byDay[k] || { income: 0, expenses: 0 }
    out.push({ day: String(i), income: e.income, expenses: e.expenses })
  }
  return out
}

/**
 * The sample dashboard, with time-sensitive fields recomputed against today so the
 * demo never looks stale: `daysLeftInMonth` is live, asset `daysToMaturity` is
 * derived from each maturity date, and the soonest asset (the FDR) is rolled to
 * ~7 days out so the "maturing soon" amber/orange alert state always demos.
 */
export function getDemoDashboard(): DashboardData {
  const fdr = startOfDay(new Date())
  fdr.setDate(fdr.getDate() + 7)
  const fdrISO = fdr.toISOString().slice(0, 10)

  const assets = base.assets.map((a) => {
    const maturityDate = a.type === 'FDR' ? fdrISO : a.maturityDate
    return {
      ...a,
      maturityDate,
      daysToMaturity: maturityDate ? daysFromToday(maturityDate) : null,
    }
  })

  // Demo "money added to accounts" ≈ current balances + what's been spent.
  const totalBalance = base.accountBalances.reduce((s, a) => s + a.balance, 0)
  const accountsStartingTotal = totalBalance + base.metrics.expenses
  // Safe to spend = current balances − money set aside for goals (floored at 0).
  const goalContrib = base.goals.reduce((s, g) => s + (g.contribution || 0), 0)
  const safeToSpend = Math.max(0, totalBalance - goalContrib)

  // A couple of sample budgets, with spent pulled from the demo's category spending.
  const spentFor = (cat: string) =>
    (base.spendingByCategory.find((c) => c.category === cat)?.amount) ?? 0
  const demoBudgets: DashboardData['budgets'] = [
    { category: 'Groceries', limit: 8000 },
    { category: 'Food & Dining', limit: 4000 },
    { category: 'Transportation', limit: 3000 },
  ].map((b) => {
    const spent = spentFor(b.category)
    return {
      category: b.category,
      limit: b.limit,
      spent,
      remaining: b.limit - spent,
      pct: b.limit > 0 ? Math.round((spent / b.limit) * 100) : 0,
    }
  })

  return {
    ...base,
    metrics: { ...base.metrics, daysLeftInMonth: daysLeftInMonth(), accountsStartingTotal, safeToSpend },
    assets,
    categories: demoCategories,
    dailyTrend: buildDailyTrend(),
    budgets: demoBudgets,
  }
}

/**
 * Canned chat replies for the demo — no OpenAI call, no sheet writes. Matches the
 * real assistant's tone and quotes the sample numbers. Order matters: log/add intent
 * is checked first so "add my biggest expense" is treated as a logging request.
 */
export function getDemoChatReply(message: string): string {
  const m = (message || '').toLowerCase()

  if (/\b(log|add|record|paid|spent|buy|bought)\b/.test(m)) {
    return "In the live version I'd log that to your sheet and email you a confirmation. This is a read-only demo, so nothing is saved."
  }
  if (/(biggest|largest|top|highest|most).*(expense|spend)|expense.*(biggest|largest|most)/.test(m)) {
    return 'Your biggest expense this month is Rent / Housing, amounting to ৳18,000.'
  }
  if (/safe.*spend|spend.*safe/.test(m)) {
    return 'Your safe-to-spend amount right now is ৳34,600, with a few days left in the month.'
  }
  if (/grocer/.test(m)) {
    return 'You spent ৳6,400 on groceries this month.'
  }
  if (/\b(income|earn|earned|made|salary|freelance)\b/.test(m)) {
    return 'Your income this month is ৳1,03,000 — mostly freelance payments from Upwork.'
  }
  if (/\b(net|profit|left over|leftover)\b/.test(m)) {
    return 'Your net this month is ৳69,600 (income ৳1,03,000 minus expenses ৳33,400).'
  }
  if (/\b(goal|goals|saving|savings)\b/.test(m)) {
    return 'You have 3 savings goals: Emergency Fund (40% funded), New Laptop (30%), and Masters Abroad Fund (12%).'
  }
  if (/\b(asset|assets|fdr|dps|maturity|matur)/.test(m)) {
    return 'Your FDR at BRAC Bank (৳50,000) matures within 7 days. You also hold a DPS and a Sanchaypatra maturing in later years.'
  }

  return 'This is a demo of Finance OS running on sample data. Try asking about your biggest expense, your safe-to-spend amount, or how much you spent on groceries.'
}
