// Data contract between n8n and the frontend.
// Single source of truth — if this changes, update CLAUDE.md and gemini.md immediately.

export interface DashboardData {
  metrics: {
    income: number
    expenses: number
    net: number
    safeToSpend: number
    daysLeftInMonth: number
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
