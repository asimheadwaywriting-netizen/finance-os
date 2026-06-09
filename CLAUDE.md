# Finance OS — Claude Code Constitution

## What This Project Is
A personal finance dashboard for Asim. Data lives in Google Sheets. n8n (self-hosted VPS) is the middleware. Next.js frontend on Vercel. AI chatbot via DeepSeek API. Gmail alerts on schedule.

## Ownership — Claude Code vs Antigravity

**Claude Code owns (do not let Antigravity touch these):**
- `app/api/*` — all Next.js API routes (the n8n proxy layer)
- `lib/types.ts` — the data contract between n8n and the frontend
- `lib/utils.ts` — formatCurrency, formatDate, cn() helpers
- `lib/constants.ts` — category colors, budget thresholds, webhook URLs
- `n8n/` — workflow JSON exports (documentation only, built in n8n UI)
- All 7 n8n workflows (built and tested in n8n)
- Google Sheets schema (4 tabs, exact column names)
- Error handling in API routes

**Antigravity owns (Claude Code does not modify these):**
- `app/page.tsx` and `app/layout.tsx`
- `components/**` — every UI component
- `hooks/**` — all React hooks
- `app/globals.css` (beyond base Tailwind config)

## Architecture
```
Browser → Next.js /api/* routes → n8n Webhooks on VPS → Google Sheets
                                                       → DeepSeek API
                                                       → Gmail
```
n8n webhook URLs are never in client-side code. They live in Vercel env vars only, read via `process.env` in API routes.

## Tech Stack
- Next.js 14 (App Router), TypeScript, Tailwind CSS
- shadcn/ui (component primitives), Recharts (charts)
- Vercel (deploy), n8n self-hosted VPS
- DeepSeek API (`deepseek-chat` model)
- Google Sheets API (via n8n OAuth2 credential)

## n8n Workflows (7 total)
| # | Name | Trigger | Purpose |
|---|------|---------|---------|
| 1 | `finance-data-aggregator` | GET Webhook | Read all 4 Sheets tabs, compute metrics, return JSON |
| 2 | `transaction-logger` | POST Webhook | Validate + append transaction to Sheets |
| 3 | `ai-chat-handler` | POST Webhook | DeepSeek chat + optional transaction logging |
| 4 | `weekly-safe-to-spend-alert` | Mon 8am | Gmail weekly summary |
| 5 | `budget-warning-alert` | Daily 12pm | Gmail if any category ≥80% of budget |
| 6 | `asset-maturity-reminder` | Daily 9am | Gmail if asset matures within 7 days |
| 7 | `end-of-month-summary` | Last day 6pm | Gmail full monthly P&L |

**Rule:** DeepSeek never computes numbers. All math lives in the Workflow 1 Code node. DeepSeek only interprets pre-computed JSON output.

## Google Sheets Structure (4 tabs)
- **Transactions** — `date, type, category, amount, account, note`
- **Accounts** — `account_name, starting_balance`
- **Goals** — `goal_name, target_amount, saved_so_far, monthly_contribution, priority`
- **Assets** — `asset_name, type, value, institution, start_date, maturity_date, interest_rate, notes`

## Environment Variables (Vercel only — never hardcode)
```
N8N_DASHBOARD_WEBHOOK_URL
N8N_TRANSACTION_WEBHOOK_URL
N8N_CHAT_WEBHOOK_URL
N8N_WEBHOOK_SECRET
```

## Data Contract — `lib/types.ts`
This is the single source of truth for the shape of data flowing from n8n to the frontend. If this changes, update gemini.md immediately so Antigravity knows.

```typescript
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
    name: string; target: number; saved: number
    contribution: number; priority: string; progressPct: number
  }[]
  assets: {
    name: string; type: string; value: number; institution: string
    daysToMaturity: number | null; interestRate: number; maturityDate: string | null
  }[]
  recentTransactions: Transaction[]
  spendingByCategory: { category: string; amount: number }[]
  monthlyTrend: { month: string; income: number; expenses: number }[]
}

export interface Transaction {
  date: string
  type: 'Income' | 'Expense'
  category: string
  amount: number
  account: string
  note: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}
```

## API Routes (Claude Code builds these)
- `GET /api/dashboard` → calls n8n aggregator, returns `DashboardData`
- `POST /api/transactions` → calls n8n logger, body: `Omit<Transaction, never>`
- `POST /api/chat` → calls n8n AI handler, body: `{ message: string, history: ChatMessage[] }`

Each route: try/catch + 10s AbortController timeout + 503 on failure.

## Error Handling Rules
- Google Sheets quota: retry once after 60s, return cached data via `$getWorkflowStaticData`
- DeepSeek timeout: return `{ reply: "AI temporarily unavailable" }` after 30s
- n8n unreachable: API routes return 503; frontend shows ErrorBanner with stale data
- Any n8n workflow crash: Error Trigger node → Gmail alert to asim.headwaywriting@gmail.com

## Milestone Versioning
After each milestone is complete:
```bash
git add .
git commit -m "Milestone X: [title]"
git tag vX.Y-[slug]
git push && git push --tags
```
See MILESTONES.md for the full tag list.
