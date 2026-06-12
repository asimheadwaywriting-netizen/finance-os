# Finance OS — Antigravity Constitution + Handoff Doc

> This file is Antigravity's project bible. Read it fully before writing any code.
> The backend (n8n, API routes, types) is already built by Claude Code. Your job is the frontend.

## What This Project Is
A personal finance dashboard for one user (Asim). Dark, minimal, flat design. Built on Next.js 14 + Tailwind + shadcn/ui + Recharts. Data comes from n8n webhooks — you never call Google Sheets directly.

## Ownership — What Antigravity Builds

**You own:**
- `app/page.tsx` — dashboard layout and composition
- `app/layout.tsx` — root layout, font config, dark background
- `app/globals.css` — base styles beyond Tailwind defaults
- `components/**` — every UI component (see full list below)
- `hooks/**` — all React hooks (data fetching, chat state, transaction mutations)

**Do NOT modify:**
- `app/api/**` — Claude Code's API routes, do not touch
- `lib/types.ts` — read this, use these interfaces, do not change them
- `lib/utils.ts` — use `formatCurrency()`, `formatDate()`, `cn()` from here
- `lib/constants.ts` — use `CATEGORY_COLORS` from here
- Anything in `n8n/`

## Tech Stack
```
Next.js 14 (App Router)
TypeScript
Tailwind CSS
shadcn/ui        ← component primitives (Card, Button, Input, Table, Badge, Sheet, Skeleton)
Recharts         ← charts only (wrapped in ResponsiveContainer)
```

Install shadcn/ui: `npx shadcn@latest init` then add components as needed:
```bash
npx shadcn@latest add card button input table badge sheet skeleton separator
```

## Confirmed Scaffold (Milestone 1 — built by Claude Code)

Exact versions: Next.js `14.2.35`, React 18, TypeScript 5, Tailwind `3.4.1`, ESLint 8. App Router, no `src/` directory, `@/*` path alias configured in `tsconfig.json`.

```
finance-os/
├── app/
│   ├── api/
│   │   ├── dashboard/route.ts     # GET — returns stub DashboardData (Claude Code)
│   │   ├── transactions/route.ts  # POST — validates + echoes transaction (Claude Code)
│   │   └── chat/route.ts          # POST — canned stub reply (Claude Code)
│   ├── globals.css                # ← yours: set #0b0f17 background here
│   ├── layout.tsx                 # ← yours: root layout, fonts
│   └── page.tsx                   # ← yours: dashboard composition
├── lib/
│   ├── types.ts                   # DashboardData, Transaction, ChatMessage
│   ├── utils.ts                   # formatCurrency, formatDate, cn
│   └── constants.ts               # CATEGORY_LIST, CATEGORY_COLORS, categoriesForType, COLORS
├── tailwind.config.ts             # brand colors configured (see below)
└── package.json
```

**Tailwind brand tokens available now** (`tailwind.config.ts` → `theme.extend.colors.brand`): `brand-bg` (#0b0f17), `brand-income` (blue-500), `brand-expense` (orange-500), `brand-warning` (amber-500), `brand-neutral` (gray-500), `brand-success` (emerald-500). Use e.g. `bg-brand-bg`, `text-brand-income`.

**`lib/constants.ts` exports:**
- `CATEGORY_LIST: CategoryDef[]` — `{ name, type: 'Income' | 'Expense', color }`, all 18 categories
- `CATEGORY_COLORS: Record<string, string>` — category name → hex
- `categoriesForType(type)` — filtered list for the TransactionForm dropdown
- `COLORS` — the design-system hex tokens
- `BUDGET_WARNING_THRESHOLD` — `0.8`

**Stub API routes are live** — `GET /api/dashboard` already returns realistic fake `DashboardData`, so every component and hook can be built and tested against real responses before n8n is wired up. `POST /api/transactions` validates required fields (400 on missing) and echoes back `{ success: true, transaction }`. `POST /api/chat` returns a canned `{ reply }`.

## Design System

**Background:** `#0b0f17` (set on `<body>` and `html` in globals.css)
**Dividers:** `border-white/10` (1px, 10% opacity white)
**Text:** neutral whites and grays — avoid Tailwind's default saturated blue-grays

**Color tokens (colorblind-safe — use these everywhere):**
| Purpose | Hex | Tailwind |
|---------|-----|---------|
| Income / positive | `#3b82f6` | `blue-500` |
| Expenses / negative | `#f97316` | `orange-500` |
| Warning (≥80% budget) | `#f59e0b` | `amber-500` |
| Neutral / labels | `#6b7280` | `gray-500` |
| Success text | `#10b981` | `emerald-500` |

**Typography:**
- Body: `font-normal` or `font-medium` — never bold in dark mode
- Numbers / amounts: `font-mono` always, 1px smaller than surrounding text
- Labels: sentence case, never all-caps

## Category Taxonomy (CATEGORY_LIST / CATEGORY_COLORS)

Full list + colors are defined in CLAUDE.md "Category Taxonomy" — Claude Code builds `lib/constants.ts` from it in Milestone 1. Summary: ~15 expense categories (Groceries, Food & Dining, Bills & Utilities, Rent / Housing, Transportation, Home Repair, Health & Medical, Date Night / Entertainment, Shopping & Personal, Education, Family & Gifts, Subscriptions, Savings & Investments, Debt Payment, Miscellaneous) + 3 income categories (Salary, Freelance Income, Other Income), each with a colorblind-safe hex color for `SpendingByCategory` bar fills and category badges. `TransactionForm.tsx` filters `CATEGORY_LIST` by the selected `type`.

**Design rules:**
- Flat and minimal — no heavy shadows or gradients
- Elements sit on the dark background, sections separated by `border-white/10` lines
- No spinning loaders — use Tailwind `animate-pulse` skeletons instead
- Optimistic UI: update local state instantly on user action, rollback if API fails

## Data Contract — Read from `lib/types.ts`

The API at `/api/dashboard` returns this shape. Wire every component to it:

```typescript
interface DashboardData {
  metrics: {
    income: number           // current month total income
    expenses: number         // current month total expenses
    net: number              // income - expenses
    safeToSpend: number      // what Asim can still spend
    daysLeftInMonth: number  // days remaining this month
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
```

**Currency:** Always format as BDT (Bangladeshi Taka). Use `formatCurrency(amount)` from `lib/utils.ts`.

## n8n Webhook Endpoints

> You always call the Next.js `/api/*` routes — never the n8n URLs directly.
> n8n URLs listed here are documentation for Claude Code's proxy layer.

| Endpoint | Method | Purpose | n8n webhook behind it |
|----------|--------|---------|----------------------|
| `GET /api/dashboard` | GET | Full dashboard data (polls every 60s) | `https://asim.sg-node8n.serverdoor.com/webhook/finance-dashboard` ✅ LIVE |
| `POST /api/transactions` | POST | Log a new transaction | `https://asim.sg-node8n.serverdoor.com/webhook/finance-transaction` ✅ LIVE |
| `POST /api/chat` | POST | Send message to AI assistant | not built yet (Milestone 6) |

## Sample API Response (real data from the live n8n webhook)

Full response saved at `n8n/sample-dashboard-response.json`. Trimmed sample (captured 2026-06-12):

```json
{
  "metrics": { "income": 103000, "expenses": 33400, "net": 69600, "safeToSpend": 34600, "daysLeftInMonth": 18 },
  "accountBalances": [
    { "name": "Cash", "balance": 2000 },
    { "name": "bKash", "balance": -5600 },
    { "name": "Bank - DBBL", "balance": 465000 }
  ],
  "goals": [
    { "name": "Emergency Fund", "target": 300000, "saved": 120000, "contribution": 15000, "priority": "High", "progressPct": 40 }
  ],
  "assets": [
    { "name": "FDR - BRAC Bank", "type": "FDR", "value": 50000, "institution": "BRAC Bank", "daysToMaturity": 8, "interestRate": 8, "maturityDate": "2026-06-20" }
  ],
  "recentTransactions": [
    { "date": "2026-06-11", "type": "Expense", "category": "Transportation", "payee": "Uber / CNG", "amount": 1100, "account": "Cash", "note": "" }
  ],
  "spendingByCategory": [
    { "category": "Rent / Housing", "amount": 18000 },
    { "category": "Groceries", "amount": 6400 }
  ],
  "monthlyTrend": [
    { "month": "May", "income": 110000, "expenses": 34600 },
    { "month": "Jun", "income": 103000, "expenses": 33400 }
  ]
}
```

Note: `safeToSpend` = current month net minus total planned goal contributions. `accountBalances` can go negative (bKash above) — render negatives in orange.

## POST /api/transactions contract (for TransactionForm + useTransactions)

Request body (all fields required except `note`):
```json
{ "date": "2026-06-12", "type": "Expense", "category": "Groceries", "payee": "Shwapno", "amount": 850, "account": "bKash", "note": "optional" }
```
Responses:
- `200` → `{ "success": true, "transaction": { ...echoed normalized tx } }`
- `400` → `{ "success": false, "error": "amount must be a positive number" }` (validation — show inline, rollback optimistic row)
- `503` → `{ "error": "Transaction service unavailable" }` (n8n down — show ErrorBanner-style message, rollback optimistic row)

Validation enforced server-side: type must be `Income`/`Expense`, amount positive number, date `YYYY-MM-DD`, payee required.

## Component List to Build

### Layout
- `components/layout/AppShell.tsx` — sidebar + main content wrapper, 2-column grid
- `components/layout/Sidebar.tsx` — nav links: Dashboard, Transactions, Goals, Assets, Chat

### Dashboard
- `components/dashboard/MetricCard.tsx` — label + large mono number + optional delta badge
- `components/dashboard/MetricGrid.tsx` — 4-column responsive grid of MetricCards
- `components/dashboard/SafeToSpendCard.tsx` — prominent display: large blue mono number + "X days left"
- `components/dashboard/ErrorBanner.tsx` — shows when `/api/dashboard` returns 503

### Charts (Recharts — all inside `<ResponsiveContainer width="100%" height={240}>`)
- `components/charts/SpendingByCategory.tsx` — horizontal `BarChart`, sorted largest→smallest
- `components/charts/MonthlyTrend.tsx` — `LineChart` with 2 lines (income=blue, expenses=orange), no fill
- `components/charts/GoalsProgress.tsx` — horizontal `BarChart`, shows saved vs target per goal

### Accounts & Assets
- `components/accounts/AccountBalances.tsx` — list, balance in mono, positive=blue, negative=orange
- `components/assets/AssetMaturityTracker.tsx` — table sorted by daysToMaturity; amber if ≤30 days, orange if ≤7 days

### Transactions
- `components/transactions/TransactionList.tsx` — table: date, category badge, payee, amount (blue/orange), account, note
- `components/transactions/TransactionForm.tsx` — form with dropdowns for type/category/account, date picker, plus a Payee text input; submit triggers optimistic UI update

### Chat
- `components/chat/ChatPanel.tsx` — full chat interface, slide in from right as a `Sheet` (shadcn)
- `components/chat/ChatMessage.tsx` — single bubble: user (right, blue tint) vs AI (left, neutral)
- `components/chat/ChatInput.tsx` — input + send button, disabled while loading

### Hooks
- `hooks/useDashboardData.ts` — `fetch /api/dashboard` with SWR, `refreshInterval: 60000`, `keepPreviousData: true`
- `hooks/useTransactions.ts` — POST `/api/transactions`, optimistic state update, rollback on 4xx/5xx
- `hooks/useChat.ts` — message history array, loading bool, `sendMessage()` function

## Chart Config (validated against Storytelling with Data)

All chart axes: `tick={{ fill: '#6b7280', fontSize: 11, fontFamily: 'monospace' }}`
All tooltips: `contentStyle={{ background: '#0b0f17', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6 }}`
Grid lines: `stroke="rgba(255,255,255,0.05)"`

**SpendingByCategory:**
```tsx
<BarChart layout="vertical" data={[...spendingByCategory].sort((a,b) => b.amount - a.amount)}>
  <XAxis type="number" tickFormatter={v => `৳${(v/1000).toFixed(0)}k`} />
  <YAxis type="category" dataKey="category" width={110} />
  <Bar dataKey="amount" radius={[0,4,4,0]}>
    {data.map((entry, i) => <Cell key={i} fill={CATEGORY_COLORS[entry.category] ?? '#6b7280'} />)}
  </Bar>
</BarChart>
```

**MonthlyTrend:**
```tsx
<LineChart data={monthlyTrend}>
  <Line type="monotone" dataKey="income" stroke="#3b82f6" strokeWidth={2} dot={false} />
  <Line type="monotone" dataKey="expenses" stroke="#f97316" strokeWidth={2} dot={false} />
  <XAxis dataKey="month" />
  <YAxis tickFormatter={v => `৳${(v/1000).toFixed(0)}k`} />
</LineChart>
```

**GoalsProgress:**
```tsx
<BarChart layout="vertical" data={goals}>
  <XAxis type="number" domain={[0,100]} tickFormatter={v => `${v}%`} />
  <YAxis type="category" dataKey="name" width={130} />
  <Bar dataKey="progressPct" fill="#3b82f6" radius={[0,4,4,0]}
       background={{ fill: 'rgba(255,255,255,0.05)', radius: [0,4,4,0] }} />
  <ReferenceLine x={80} stroke="#f59e0b" strokeDasharray="4 4" />
</BarChart>
```

## Visual References to Use
Before building, find 2-3 dark finance dashboard screenshots from:
- Dribbble: search "finance dashboard dark"
- Mobbin: search "finance app dark"
- 21st.dev: for individual animated components (stat cards, tables)

Upload the screenshots into Antigravity alongside this file. Tell the agent: "Match this visual hierarchy and spacing. Apply our design system colors instead of the reference colors."

## Global Rules for Antigravity
1. Always use `font-mono` for any number that represents money or a percentage
2. Never show a blank/white screen — use skeleton loaders (`animate-pulse`) while data loads
3. Never expose `/api` route details in client-side code — just call `fetch('/api/dashboard')`
4. When `useDashboardData` returns an error, show `<ErrorBanner>` — do not crash
5. All form submissions use optimistic UI — update state first, confirm on success, rollback on failure
6. shadcn/ui components are the base — customize with Tailwind, do not write custom CSS classes
7. The `cn()` utility from `lib/utils.ts` handles conditional class merging — use it everywhere
