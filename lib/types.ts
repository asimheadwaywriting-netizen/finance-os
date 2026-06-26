// Data contract between n8n and the frontend.
// Single source of truth — if this changes, update CLAUDE.md and gemini.md immediately.

export interface DashboardData {
  metrics: {
    income: number
    expenses: number
    net: number
    safeToSpend: number
    /** safeToSpend spread over the weeks left in the month (>= 1 week). */
    weeklySafeToSpend: number
    daysLeftInMonth: number
    /** Sum of all account starting balances = money added to accounts ("Total Income So Far"). */
    accountsStartingTotal: number
    /** Sum of all recurring bills this month (display only — not yet wired into safeToSpend). */
    billsCommitted: number
    /** Sum of recurring bills not yet marked paid this month. */
    billsUnpaid: number
  }
  accountBalances: { name: string; balance: number }[]
  goals: {
    name: string
    target: number
    saved: number
    contribution: number
    priority: string
    progressPct: number
  }[]
  assets: {
    name: string
    type: string
    value: number
    institution: string
    daysToMaturity: number | null
    interestRate: number
    maturityDate: string | null
  }[]
  recentTransactions: Transaction[]
  spendingByCategory: { category: string; amount: number }[]
  monthlyTrend: { month: string; income: number; expenses: number }[]
  dailyTrend: { day: string; income: number; expenses: number }[]
  categories: { name: string; type: 'Income' | 'Expense'; color: string }[]
  budgets: { category: string; limit: number; spent: number; remaining: number; pct: number }[]
  bills: Bill[]
}

export interface Bill {
  name: string
  amount: number
  /** Day of month the bill is due (1–31, clamped to the month length). */
  dueDay: number
  category: string
  account: string
  /** True if a current-month Expense transaction tagged `bill:<name>` exists. */
  paid: boolean
  /** This month's due date, YYYY-MM-DD. The mark-paid transaction is logged on this date. */
  dueDate: string
  daysToDue: number
  /** True when the bill is unpaid but a manual expense of the same amount already exists
   *  this month — a soft "did you already log this?" warning. Optional: the n8n fallback
   *  doesn't compute it. */
  possibleDuplicate?: boolean
}

export interface Transaction {
  date: string
  type: 'Income' | 'Expense'
  category: string
  payee: string
  amount: number
  account: string
  note: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}
