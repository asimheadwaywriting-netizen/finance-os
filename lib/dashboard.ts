import { neon } from '@neondatabase/serverless'
import type { DashboardData } from '@/lib/types'

// Direct-from-Postgres dashboard aggregator. This is a faithful port of n8n
// Workflow 1 (finance-data-aggregator): same single json_agg query + the same
// compute, moved into the app so the request is browser -> Vercel -> Neon with
// no n8n hop. All financial math lives here (the AI assistant never computes).
//
// Timezone: Bangladesh is a fixed UTC+6 with no DST, so "now in Dhaka" is just
// UTC + 6h read via the UTC getters — exact, no date library needed.

const QUERY = `SELECT
  (SELECT COALESCE(json_agg(json_build_object(
    'date', to_char(date,'YYYY-MM-DD'), 'type', type, 'category', category,
    'payee', payee, 'amount', amount, 'account', account, 'note', note
  )), '[]') FROM transactions) AS transactions,
  (SELECT COALESCE(json_agg(json_build_object(
    'account_name', account_name, 'starting_balance', starting_balance,
    'as_of_date', to_char(as_of_date,'YYYY-MM-DD')
  )), '[]') FROM accounts) AS accounts,
  (SELECT COALESCE(json_agg(json_build_object(
    'goal_name', goal_name, 'target_amount', target_amount, 'saved_so_far', saved_so_far,
    'monthly_contribution', monthly_contribution, 'priority', priority
  )), '[]') FROM goals) AS goals,
  (SELECT COALESCE(json_agg(json_build_object(
    'asset_name', asset_name, 'type', type, 'value', value, 'institution', institution,
    'maturity_date', to_char(maturity_date,'YYYY-MM-DD'), 'interest_rate', interest_rate
  )), '[]') FROM assets) AS assets,
  (SELECT COALESCE(json_agg(json_build_object('name', name, 'type', type, 'color', color)), '[]') FROM categories) AS categories,
  (SELECT COALESCE(json_agg(json_build_object('category', category, 'monthly_limit', monthly_limit)), '[]') FROM budgets) AS budgets,
  (SELECT COALESCE(json_agg(json_build_object('name', name, 'amount', amount, 'due_day', due_day, 'category', category, 'account', account)), '[]') FROM bills) AS bills;`

const MS_DAY = 86_400_000
const toISO = (d: unknown): string => String(d ?? '').slice(0, 10)
const monthShort = (ym: string): string =>
  new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1)).toLocaleString('en-US', { month: 'short' })

interface Row {
  transactions: { date: string; type: string; category: string; payee: string; amount: number; account: string; note: string }[]
  accounts: { account_name: string; starting_balance: number; as_of_date: string | null }[]
  goals: { goal_name: string; target_amount: number; saved_so_far: number; monthly_contribution: number; priority: string }[]
  assets: { asset_name: string; type: string; value: number; institution: string; maturity_date: string | null; interest_rate: number }[]
  categories: { name: string; type: string; color: string }[]
  budgets: { category: string; monthly_limit: number }[]
  bills: { name: string; amount: number; due_day: number; category: string; account: string }[]
}

export async function getDashboardData(): Promise<DashboardData> {
  // FINANCE_APP_DB_URL — dedicated, verified to point at the canonical Neon DB n8n uses.
  // Deliberately NOT DATABASE_URL/APP_DATABASE_URL: Vercel's Neon integration keeps
  // auto-resyncing and blanking any var matching its managed naming pattern (caught
  // it wiping APP_DATABASE_URL twice in one session, 2026-06-29). This name is chosen
  // to fall outside whatever pattern the integration scans for.
  const url = process.env.FINANCE_APP_DB_URL
  if (!url) throw new Error('FINANCE_APP_DB_URL is not configured')
  // Next.js patches global fetch with its own Data Cache; the neon() driver issues
  // queries over fetch under the hood, so without an explicit no-store it can serve
  // a stale snapshot even on a force-dynamic route (caught: a just-added category
  // missing from the response while a slightly older one showed fine, 2026-06-30).
  const sql = neon(url, { fetchOptions: { cache: 'no-store' } })
  const rows = (await sql.query(QUERY)) as unknown as Row[]
  const r = rows[0]

  const txs = (r.transactions || []).map((t) => ({
    date: toISO(t.date),
    type: t.type === 'Income' ? 'Income' : 'Expense',
    category: String(t.category || ''),
    payee: String(t.payee || ''),
    amount: Number(t.amount) || 0,
    account: String(t.account || ''),
    note: String(t.note || ''),
  }))
  const accounts = r.accounts || []
  const accountsStartingTotal = accounts.reduce((s, a) => s + (Number(a.starting_balance) || 0), 0)
  const categories: DashboardData['categories'] = (r.categories || []).map((c) => ({
    name: String(c.name || ''),
    type: c.type === 'Income' ? 'Income' : 'Expense',
    color: String(c.color || '#6b7280'),
  }))

  // "now" in Asia/Dhaka (UTC+6, no DST)
  const dhaka = new Date(Date.now() + 6 * 3600 * 1000)
  const Y = dhaka.getUTCFullYear()
  const M = dhaka.getUTCMonth()
  const D = dhaka.getUTCDate()
  const daysInMonth = new Date(Date.UTC(Y, M + 1, 0)).getUTCDate()
  const todayMidnight = Date.UTC(Y, M, D)
  const ym = `${Y}-${String(M + 1).padStart(2, '0')}`

  const curr = txs.filter((t) => t.date.indexOf(ym) === 0)
  const income = curr.filter((t) => t.type === 'Income').reduce((s, t) => s + t.amount, 0)
  const expenses = curr.filter((t) => t.type === 'Expense').reduce((s, t) => s + t.amount, 0)
  const net = income - expenses
  const goalContrib = (r.goals || []).reduce((s, g) => s + (Number(g.monthly_contribution) || 0), 0)
  const daysLeftInMonth = daysInMonth - D

  const accountBalances = accounts.map((a) => {
    const name = String(a.account_name || '')
    const asOf = a.as_of_date ? toISO(a.as_of_date) : ''
    const delta = txs.reduce((s, t) => {
      if (t.account !== name) return s
      if (asOf && t.date <= asOf) return s
      return s + (t.type === 'Income' ? t.amount : -t.amount)
    }, 0)
    const bal = (Number(a.starting_balance) || 0) + delta
    return { name, balance: bal < 0 ? 0 : bal }
  })

  const goals = (r.goals || []).map((g) => {
    const target = Number(g.target_amount) || 0
    const saved = Number(g.saved_so_far) || 0
    return {
      name: String(g.goal_name || ''),
      target,
      saved,
      contribution: Number(g.monthly_contribution) || 0,
      priority: String(g.priority || ''),
      progressPct: target > 0 ? Math.round((saved / target) * 100) : 0,
    }
  })

  const assets = (r.assets || []).map((a) => {
    const md = a.maturity_date ? toISO(a.maturity_date) : ''
    let daysToMaturity: number | null = null
    if (md) {
      const mUTC = Date.UTC(Number(md.slice(0, 4)), Number(md.slice(5, 7)) - 1, Number(md.slice(8, 10)))
      daysToMaturity = Math.ceil((mUTC - todayMidnight) / MS_DAY)
    }
    return {
      name: String(a.asset_name || ''),
      type: String(a.type || ''),
      value: Number(a.value) || 0,
      institution: String(a.institution || ''),
      daysToMaturity,
      interestRate: Number(a.interest_rate) || 0,
      maturityDate: md || null,
    }
  })

  const recentTransactions = txs.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10) as DashboardData['recentTransactions']

  const catTotals: Record<string, number> = {}
  curr.forEach((t) => {
    if (t.type === 'Expense') catTotals[t.category] = (catTotals[t.category] || 0) + t.amount
  })
  const spendingByCategory = Object.keys(catTotals)
    .map((c) => ({ category: c, amount: catTotals[c] }))
    .sort((a, b) => b.amount - a.amount)

  const byMonth: Record<string, { income: number; expenses: number }> = {}
  txs.forEach((t) => {
    const m = t.date.slice(0, 7)
    if (!byMonth[m]) byMonth[m] = { income: 0, expenses: 0 }
    byMonth[m][t.type === 'Income' ? 'income' : 'expenses'] += t.amount
  })
  const monthlyTrend = Object.keys(byMonth).sort().slice(-6).map((m) => ({
    month: monthShort(m + '-01'),
    income: byMonth[m].income,
    expenses: byMonth[m].expenses,
  }))

  const byDay: Record<string, { income: number; expenses: number }> = {}
  curr.forEach((t) => {
    const dd = t.date.slice(8, 10)
    if (!byDay[dd]) byDay[dd] = { income: 0, expenses: 0 }
    byDay[dd][t.type === 'Income' ? 'income' : 'expenses'] += t.amount
  })
  const daysToShow = Math.min(daysInMonth, D)
  const dailyTrend = []
  for (let i = 1; i <= daysToShow; i++) {
    const k = String(i).padStart(2, '0')
    const e = byDay[k] || { income: 0, expenses: 0 }
    dailyTrend.push({ day: String(i), income: e.income, expenses: e.expenses })
  }

  const budgets = (r.budgets || []).map((b) => {
    const cat = String(b.category || '')
    const limit = Number(b.monthly_limit) || 0
    const spent = catTotals[cat] || 0
    return { category: cat, limit, spent, remaining: limit - spent, pct: limit > 0 ? Math.round((spent / limit) * 100) : 0 }
  })

  // Bills: paid = a current-month Expense tagged `bill:<name>`.
  const paidBillNames: Record<string, boolean> = {}
  // Amounts of this month's MANUAL (non-bill) expenses — used to warn about possible
  // double-entry when an unpaid bill matches one.
  const manualExpenseAmounts = new Set<number>()
  curr.forEach((t) => {
    if (t.type !== 'Expense') return
    if (t.note && t.note.indexOf('bill:') === 0) paidBillNames[t.note.slice(5)] = true
    else manualExpenseAmounts.add(t.amount)
  })
  const bills = (r.bills || []).map((b) => {
    const name = String(b.name || '')
    const amount = Number(b.amount) || 0
    const dueDay = Math.min(Math.max(parseInt(String(b.due_day), 10) || 1, 1), daysInMonth)
    const dueDate = `${ym}-${String(dueDay).padStart(2, '0')}`
    const dueUTC = Date.UTC(Y, M, dueDay)
    const paid = !!paidBillNames[name]
    return {
      name,
      amount,
      dueDay,
      category: String(b.category || ''),
      account: String(b.account || ''),
      paid,
      dueDate,
      daysToDue: Math.ceil((dueUTC - todayMidnight) / MS_DAY),
      possibleDuplicate: !paid && manualExpenseAmounts.has(amount),
    }
  })
  const billsCommitted = bills.reduce((s, b) => s + b.amount, 0)
  const billsUnpaid = bills.reduce((s, b) => s + (b.paid ? 0 : b.amount), 0)

  // Safe-to-spend v2: cash − goal reservations − UNPAID bills (paid bills already left the balance).
  const totalCash = accountBalances.reduce((s, a) => s + a.balance, 0)
  const safeToSpend = Math.max(0, totalCash - goalContrib - billsUnpaid)
  const weeksLeft = Math.max(1, Math.ceil(daysLeftInMonth / 7))
  const weeklySafeToSpend = Math.round(safeToSpend / weeksLeft)

  return {
    metrics: { income, expenses, net, safeToSpend, weeklySafeToSpend, daysLeftInMonth, accountsStartingTotal, billsCommitted, billsUnpaid },
    accountBalances,
    goals,
    assets,
    recentTransactions,
    spendingByCategory,
    monthlyTrend,
    dailyTrend,
    categories,
    budgets,
    bills,
  }
}
