# Finance OS — Claude Code Constitution

## What This Project Is
A personal finance dashboard for Asim. Data lives in Google Sheets. n8n (self-hosted VPS) is the middleware. Next.js frontend on Vercel. AI chatbot via OpenAI API (existing subscription — DeepSeek was dropped 2026-06-12, no subscription). Gmail alerts on schedule.

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
                                                       → OpenAI API
                                                       → Gmail
```
n8n webhook URLs are never in client-side code. They live in Vercel env vars only, read via `process.env` in API routes.

## Tech Stack
- Next.js 14 (App Router), TypeScript, Tailwind CSS
- shadcn/ui (component primitives), Recharts (charts)
- Vercel (deploy), n8n self-hosted VPS
- OpenAI API (`gpt-4o-mini` default — bump to `gpt-4o` if answers feel weak; existing n8n credential `OpenAi account`, ID `9L3j2utOyiBJWa9S`)
- Google Sheets API (via n8n OAuth2 credential)

## n8n Workflows (7 total)
| # | Name | Trigger | Purpose |
|---|------|---------|---------|
| 1 | `finance-data-aggregator` | GET Webhook | Read all 4 Sheets tabs, compute metrics, return JSON |
| 2 | `transaction-logger` | POST Webhook | Validate + append transaction to Sheets |
| 3 | `ai-chat-handler` | POST Webhook | OpenAI chat + optional transaction logging |
| 4 | `weekly-safe-to-spend-alert` | Mon 8am | Gmail weekly summary |
| 5 | `budget-warning-alert` | Daily 12pm | Gmail if any category ≥80% of budget |
| 6 | `asset-maturity-reminder` | Daily 9am | Gmail if asset matures within 7 days |
| 7 | `end-of-month-summary` | Last day 6pm | Gmail full monthly P&L |

**Rule:** OpenAI never computes numbers. All math lives in the Workflow 1 Code node. OpenAI only interprets pre-computed JSON output.

## Live Infrastructure (Milestone 2)
- **Google Sheet:** `Finance OS` — spreadsheet ID `16vNm0PPxV-OP1Kp_INOKiBz33YcL-ZkowAyRw7HnwcI` (4 tabs seeded with Jan–Jun 2026 sample data)
- **Workflow 1:** `finance-data-aggregator` — n8n workflow ID `8GejOtDtsht0CfEJ`, active
- **Workflow 2:** `transaction-logger` — n8n workflow ID `WwmlYYISq5buXPYx`, active (validate incl. payee → append; 400 + error list on invalid, nothing written)
- **Workflow 3:** `ai-chat-handler` — n8n workflow ID `5RkSgctHtRNq3mIR`, active (fetch Workflow 1 JSON → gpt-4o-mini → parse intent → `{ reply, action, transaction }`)
- **Webhook:** `GET https://asim.sg-node8n.serverdoor.com/webhook/finance-dashboard` → returns `DashboardData`
- **Webhook:** `POST https://asim.sg-node8n.serverdoor.com/webhook/finance-transaction` → `{ success, transaction }` or 400 `{ success: false, error }`
- **Webhook:** `POST https://asim.sg-node8n.serverdoor.com/webhook/finance-chat` → `{ reply, action, transaction }`
- Workflow export: `n8n/finance-data-aggregator.json` · sample response: `n8n/sample-dashboard-response.json` · deploy script: `n8n/deploy-milestone2.js`
- Implementation note: reads use ONE Sheets `values:batchGet` call for all 4 tabs (quota-friendlier than 4 separate reads); dates seeded with `valueInputOption: RAW` so they stay strings, and the Code node converts serial numbers defensively anyway
- `safeToSpend` formula: current month `net` minus total `monthly_contribution` across all goals

## Google Sheets Structure (4 tabs)
- **Transactions** — `date, type, category, payee, amount, account, note`
- **Accounts** — `account_name, starting_balance`
- **Goals** — `goal_name, target_amount, saved_so_far, monthly_contribution, priority`
- **Assets** — `asset_name, type, value, institution, start_date, maturity_date, interest_rate, notes`

## Category Taxonomy

Starter envelope list for `lib/constants.ts` (`CATEGORY_LIST` + `CATEGORY_COLORS`), built Milestone 1. `TransactionForm.tsx` filters this list by the selected `type` (Income vs Expense).

**Expense categories:**
| Category | Color |
|---|---|
| Groceries | `#f97316` (orange-500) |
| Food & Dining | `#fb923c` (orange-400) |
| Bills & Utilities | `#3b82f6` (blue-500) |
| Rent / Housing | `#60a5fa` (blue-400) |
| Transportation | `#a78bfa` (violet-400) |
| Home Repair | `#f59e0b` (amber-500) |
| Health & Medical | `#ef4444` (red-500) |
| Date Night / Entertainment | `#ec4899` (pink-500) |
| Shopping & Personal | `#06b6d4` (cyan-500) |
| Education | `#8b5cf6` (violet-500) |
| Family & Gifts | `#14b8a6` (teal-500) |
| Subscriptions | `#6366f1` (indigo-500) |
| Savings & Investments | `#10b981` (emerald-500) |
| Debt Payment | `#dc2626` (red-600) |
| Miscellaneous | `#6b7280` (gray-500) |

**Income categories:**
| Category | Color |
|---|---|
| Salary | `#3b82f6` (blue-500) |
| Freelance Income | `#0ea5e9` (sky-500) |
| Other Income | `#10b981` (emerald-500) |

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
```

## API Routes (Claude Code builds these)
- `GET /api/dashboard` → calls n8n aggregator, returns `DashboardData`
- `POST /api/transactions` → calls n8n logger, body: `Omit<Transaction, never>`
- `POST /api/chat` → calls n8n AI handler, body: `{ message: string, history: ChatMessage[] }`

Each route: try/catch + 10s AbortController timeout + 503 on failure.

## Error Handling Rules
- Google Sheets quota: retry once after 60s, return cached data via `$getWorkflowStaticData`
- OpenAI timeout: return `{ reply: "AI temporarily unavailable" }` after 30s
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
