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

## n8n Workflows (9 total)
| # | Name | Trigger | Purpose |
|---|------|---------|---------|
| 1 | `finance-data-aggregator` | GET Webhook | Read all 5 Sheets tabs, compute metrics, return JSON (incl. `categories[]`) |
| 2 | `transaction-logger` | POST Webhook | Validate + append transaction to Sheets |
| 3 | `ai-chat-handler` | POST Webhook | OpenAI chat + optional transaction logging (no per-tx email since M11) |
| 4 | `weekly-safe-to-spend-alert` | Mon 8am | Gmail weekly summary |
| 5 | `budget-warning-alert` | Daily 12pm | Gmail if any category ≥80% of budget |
| 6 | `asset-maturity-reminder` | Daily 9am | Gmail if asset matures within 7 days |
| 7 | `end-of-month-summary` | Last day 6pm | Gmail full monthly P&L |
| 8 | `record-remover` | POST Webhook | Generic delete: find first row matching `match` in tab, delete by dimension |
| 9 | `record-creator` | POST Webhook | Generic append: add a row to Goals / Assets / Categories |

**Rule:** OpenAI never computes numbers. All math lives in the Workflow 1 Code node. OpenAI only interprets pre-computed JSON output.

## Live Infrastructure (Milestone 2)
- **Google Sheet:** `Finance OS` — spreadsheet ID `16vNm0PPxV-OP1Kp_INOKiBz33YcL-ZkowAyRw7HnwcI` (4 tabs seeded with Jan–Jun 2026 sample data)
- **Workflow 1:** `finance-data-aggregator` — n8n workflow ID `8GejOtDtsht0CfEJ`, active
- **Workflow 2:** `transaction-logger` — n8n workflow ID `WwmlYYISq5buXPYx`, active (validate incl. payee → append; 400 + error list on invalid, nothing written)
- **Workflow 3:** `ai-chat-handler` — n8n workflow ID `5RkSgctHtRNq3mIR`, active (fetch Workflow 1 JSON → gpt-4o-mini → parse intent → `{ reply, action, transaction }`; M7: log_transaction → Workflow 2 → Gmail confirmation after the webhook response)
- **Workflow 4:** `weekly-safe-to-spend-alert` — ID `9Ximk7fsIvpL5gYx`, active (Mon 8am Asia/Dhaka, always sends)
- **Workflow 5:** `budget-warning-alert` — ID `IJJC0nVE6XyQQBAo`, active (daily 12pm; sends if month expenses ≥80% of income — no per-category budgets exist in the Sheet, so the threshold applies to the total)
- **Workflow 6:** `asset-maturity-reminder` — ID `kb8JQk0TwWg7uRWg`, active (daily 9am; sends if any asset matures within 7 days)
- **Workflow 7:** `end-of-month-summary` — ID `LuDfz4YRFqRTjz8M`, active (cron 6pm days 28–31; Code node sends only on the actual last day; full P&L)
- **Workflow 8:** `record-remover` — ID `XBpyHnVzjOHulNje`, active (POST `{ tab, match }` → reads tab, finds first row matching every `match` field, deletes via Sheets `batchUpdate deleteDimension`; 400 if no match — nothing deleted)
- **Workflow 9:** `record-creator` — ID `uwl7mHJ8oBzvraqb`, active (POST `{ tab, values }` → validates tab + value count → appends to Goals/Assets/Categories; 400 + error list on invalid)
- **Webhook:** `GET https://asim.sg-node8n.serverdoor.com/webhook/finance-dashboard` → returns `DashboardData`
- **Webhook:** `POST https://asim.sg-node8n.serverdoor.com/webhook/finance-transaction` → `{ success, transaction }` or 400 `{ success: false, error }`
- **Webhook:** `POST https://asim.sg-node8n.serverdoor.com/webhook/finance-chat` → `{ reply, action, transaction }`
- **Webhook:** `POST https://asim.sg-node8n.serverdoor.com/webhook/finance-create` → `{ success: true }` or 400 (record-creator)
- **Webhook:** `POST https://asim.sg-node8n.serverdoor.com/webhook/finance-delete` → `{ success: true }` or 400 (record-remover)
- Workflow export: `n8n/finance-data-aggregator.json` · sample response: `n8n/sample-dashboard-response.json` · deploy script: `n8n/deploy-milestone2.js`
- Implementation note: reads use ONE Sheets `values:batchGet` call for all 4 tabs (quota-friendlier than 4 separate reads); dates seeded with `valueInputOption: RAW` so they stay strings, and the Code node converts serial numbers defensively anyway
- `safeToSpend` formula: current month `net` minus total `monthly_contribution` across all goals

## Google Sheets Structure (5 tabs)
- **Transactions** — `date, type, category, payee, amount, account, note`
- **Accounts** — `account_name, starting_balance`
- **Goals** — `goal_name, target_amount, saved_so_far, monthly_contribution, priority`
- **Assets** — `asset_name, type, value, institution, start_date, maturity_date, interest_rate, notes`
- **Categories** — `name, type, color` (M11; seeded from `lib/constants.ts`, drives the log-transaction dropdown)

## Category Taxonomy

Since M11 the live category list is **Sheet-driven**: the `Categories` tab is the source of truth, the aggregator returns it as `DashboardData.categories`, and `TransactionForm.tsx` builds its dropdown from that (filtered by `type`). `lib/constants.ts` (`CATEGORY_LIST` + `CATEGORY_COLORS`) is now the **seed + fallback** — used to seed the tab and as the default when live categories are absent (demo / first load). New categories are added in-app via `CategoryForm` → `/api/categories` → Workflow 9.

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
N8N_CREATE_WEBHOOK_URL   # M11 — record-creator (add goal/asset/category)
N8N_DELETE_WEBHOOK_URL   # M11 — record-remover (delete transaction/goal/asset row)
N8N_WEBHOOK_SECRET
NEXT_PUBLIC_DEMO_MODE   # only on the public demo project — see Demo Deployment below
```

## Demo Deployment
A second Vercel project (`finance-os-demo`) builds from the **same repo/branch** with one extra env var, `NEXT_PUBLIC_DEMO_MODE=true`, and **no** `N8N_*` vars. In demo mode the three API routes short-circuit to self-contained sample data (`lib/demo-data.ts`, sourced from `n8n/sample-dashboard-response.json` with time-sensitive fields recomputed): dashboard returns the sample, chat returns canned keyword replies (no OpenAI), transactions accept-without-writing, and `useTransactions` keeps the optimistic row until refresh. A "Demo — sample data" badge shows in the header. The M11 mutation routes (goals/assets/categories add, and all deletes) likewise short-circuit to `{ success: true }` in demo mode, and the add/remove hooks apply optimistic cache changes that reset on hard refresh. The real production project leaves the flag unset, so its behavior is unchanged.

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
- `DELETE /api/transactions` → calls Workflow 8, body: the transaction to remove (match = all 7 fields)
- `POST /api/chat` → calls n8n AI handler, body: `{ message: string, history: ChatMessage[] }`
- `POST /api/goals` → Workflow 9 (add); `DELETE /api/goals` → Workflow 8 (match `goal_name`)
- `POST /api/assets` → Workflow 9 (add); `DELETE /api/assets` → Workflow 8 (match `asset_name`)
- `POST /api/categories` → Workflow 9 (add a category)

Each route: try/catch + 10s AbortController timeout + 503 on failure. The mutation routes (transactions DELETE, goals, assets, categories) share `lib/n8n-proxy.ts` (`forwardToN8n`) and short-circuit to `{ success: true }` in demo mode.

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
