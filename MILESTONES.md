# Finance OS — Milestones & Daily Checklist

Each milestone ends with a git commit and version tag so every working state is saved.

After completing a milestone, run:
```bash
git add .
git commit -m "Milestone X: [title]"
git tag vX.Y-[slug]
git push && git push --tags
```

---

## Milestone 0 — Project Setup
**Who:** Claude Code | **Tag:** `v0.0-init`

- [x] Create `F:\Nn8\finance-os\` project folder
- [x] Write `CLAUDE.md` (Claude Code constitution)
- [x] Write `gemini.md` (Antigravity constitution + handoff doc)
- [x] Write `MILESTONES.md` (this file)
- [x] Create `.gitignore`
- [x] Initialize git + create GitHub repo
- [x] Push initial commit with tag `v0.0-init`

---

## Milestone 1 — Dark Shell on Vercel
**Who:** Claude Code scaffolds → Antigravity styles | **Tag:** `v0.1-shell`
**Goal:** Dark dashboard visible at a live Vercel URL with placeholder data.

### Claude Code
- [x] Scaffold: `npx create-next-app@14 . --typescript --tailwind --eslint --app`
- [x] Configure `tailwind.config.ts` with brand colors (`#0b0f17` bg, blue-500, orange-500, amber-500)
- [x] Create `lib/types.ts` with all interfaces from CLAUDE.md
- [x] Create `lib/utils.ts` — `formatCurrency()`, `formatDate()`, `cn()`
- [x] Create `lib/constants.ts` — `CATEGORY_COLORS`, `CATEGORY_LIST` (use the finalized taxonomy in CLAUDE.md "Category Taxonomy")
- [x] Create stub API routes returning hardcoded JSON (dashboard, transactions, chat)
- [x] Update `gemini.md` with confirmed scaffold structure

### Antigravity
- [x] Install shadcn/ui: `npx shadcn@latest init`
- [x] Add components: `card button input table badge sheet skeleton separator`
- [x] Build `AppShell.tsx` + `Sidebar.tsx`
- [x] Build `MetricCard.tsx` + `MetricGrid.tsx` with hardcoded data
- [x] Build `SafeToSpendCard.tsx` — large blue mono number
- [x] Set dark background in `globals.css`
- [x] Push to GitHub → Vercel auto-deploys → live at https://finance-os-eight-delta.vercel.app/

**Commit & tag when:** Dashboard loads at Vercel URL with fake numbers and dark layout.
```bash
git add . && git commit -m "Milestone 1: Dark shell on Vercel" && git tag v0.1-shell && git push && git push --tags
```

---

## Milestone 2 — n8n Reads Sheets, Returns JSON
**Who:** Claude Code only | **Tag:** `v0.2-n8n-sheets`
**Goal:** `curl` the n8n webhook and get real aggregated JSON back.

- [x] Create Google Sheet with 4 tabs (exact column names from CLAUDE.md) — ID `16vNm0PPxV-OP1Kp_INOKiBz33YcL-ZkowAyRw7HnwcI`
- [x] Add 15+ rows of realistic sample data across all tabs (~70 transactions, Jan–Jun 2026)
- [x] In n8n: create Google Sheets OAuth2 credential — reused existing `Google Sheets account` credential
- [x] Build Workflow 1 (`finance-data-aggregator`): Webhook → batchGet (all 4 tabs, one call) → Code node → Respond
- [x] Write aggregation JavaScript in Code node (income, expenses, net, safe-to-spend, balances, goals %, assets maturing, last 10 transactions, 6-month trend)
- [x] Test: webhook returns valid `DashboardData` JSON
- [x] Copy real JSON sample into `gemini.md` under "Sample API Response" section
- [x] Update `gemini.md` with real n8n webhook URL

**Commit & tag when:** Webhook returns correct JSON with real Sheets data.
```bash
git add . && git commit -m "Milestone 2: n8n reads Sheets" && git tag v0.2-n8n-sheets && git push && git push --tags
```

---

## Milestone 3 — Dashboard Shows Real Data
**Who:** Claude Code (API routes) → Antigravity (hooks + wiring) | **Tag:** `v0.3-live-data`
**Goal:** Every metric card and component shows real Google Sheets data.

### Claude Code
- [x] Replace stub in `app/api/dashboard/route.ts` with real n8n proxy call
- [x] Add try/catch + 10s AbortController timeout + 503 response
- [x] Verify TypeScript types match n8n response exactly (tested locally against live webhook)
- [x] `N8N_DASHBOARD_WEBHOOK_URL` set in Vercel (Production) + `.env.local` for local dev

### Antigravity
- [x] Build `hooks/useDashboardData.ts` — SWR, `refreshInterval: 60000`, `keepPreviousData: true`
- [x] Wire `MetricGrid` to real data
- [x] Build `ErrorBanner.tsx` — shows on 503 (stale data stays visible below banner; centered + retry on first-load failure)
- [x] Add skeleton loaders to all cards

**Commit & tag when:** Dashboard shows live Sheets data and handles errors gracefully.
```bash
git add . && git commit -m "Milestone 3: Dashboard shows real data" && git tag v0.3-live-data && git push && git push --tags
```

---

## Milestone 4 — Three Charts Live
**Who:** Antigravity | **Tag:** `v0.4-charts`
**Goal:** Three Recharts components rendering with real data and correct visual config.

- [x] Install Recharts: `npm install recharts`
- [x] Build `SpendingByCategory.tsx` — horizontal bar, sorted desc, CATEGORY_COLORS
- [x] Build `MonthlyTrend.tsx` — line chart, 2 lines, no fill, blue/orange
- [x] Build `GoalsProgress.tsx` — horizontal bar, progressPct, amber reference line at 80%
- [x] Apply shared chart config (axis colors, tooltip style, font-mono ticks, ৳ formatting)
- [x] All charts wrapped in `<ResponsiveContainer width="100%" height={240}>`

**Commit & tag when:** Three charts render with real data, correct colors, and tooltips.
```bash
git add . && git commit -m "Milestone 4: Charts live" && git tag v0.4-charts && git push && git push --tags
```

---

## Milestone 5 — Transaction Form + Optimistic UI
**Who:** Claude Code (n8n + API) → Antigravity (UI + hooks) | **Tag:** `v0.5-transactions`
**Goal:** Submit a transaction → appears instantly in list → row in Google Sheets.

### Claude Code
- [ ] Build Workflow 2 (`transaction-logger`): Webhook → validate (incl. `payee`) → Sheets append → Respond
- [ ] Build `app/api/transactions/route.ts` — POST proxy to n8n, try/catch
- [ ] Test: POST to `/api/transactions` adds row to Sheets

### Antigravity
- [ ] Build `TransactionForm.tsx` — dropdowns for type/category/account, date picker, + Payee text input
- [ ] Build `TransactionList.tsx` — table of last 10 transactions, color-coded amounts
- [ ] Build `hooks/useTransactions.ts` — POST + optimistic state update + rollback on failure

**Commit & tag when:** Fill form, submit, row appears in list instantly and in Google Sheets.
```bash
git add . && git commit -m "Milestone 5: Transaction form + optimistic UI" && git tag v0.5-transactions && git push && git push --tags
```

---

## Milestone 6 — AI Chatbot Answers Questions
**Who:** Claude Code (n8n + API) → Antigravity (UI + hooks) | **Tag:** `v0.6-chat`
**Goal:** Open chat, ask a financial question, get a correct answer.

### Claude Code
- [x] ~~Get DeepSeek API key~~ → **using OpenAI instead** (existing n8n credential `OpenAi account`, ID `9L3j2utOyiBJWa9S` — no new key needed)
- [ ] Build Workflow 3 (`ai-chat-handler`): Webhook → OpenAI (`gpt-4o-mini`) → Code (parse intent) → Respond
- [ ] Write system prompt (financial assistant personality + `action=log_transaction` JSON format)
- [ ] Build `app/api/chat/route.ts` — POST proxy, pass message + history

### Antigravity
- [ ] Build `ChatPanel.tsx` — shadcn `Sheet`, slides in from right
- [ ] Build `ChatMessage.tsx` — user (right, blue tint) vs AI (left, neutral)
- [ ] Build `ChatInput.tsx` — input + send, disabled while loading
- [ ] Build `hooks/useChat.ts` — history array, loading state, sendMessage()

**Commit & tag when:** Ask "What did I spend on food this month?" and get correct answer.
```bash
git add . && git commit -m "Milestone 6: AI chatbot answers questions" && git tag v0.6-chat && git push && git push --tags
```

---

## Milestone 7 — Chatbot Logs Transactions
**Who:** Claude Code | **Tag:** `v0.7-chat-log`
**Goal:** Tell AI to log a transaction → it appears in Sheets → confirmation email arrives.

- [ ] Extend Workflow 3: IF node detects `action=log_transaction` → internal call to Workflow 2
- [ ] Add Gmail confirmation node (transaction fields in email body)
- [ ] Test: "Log ৳850 food expense on bKash today" → logged in Sheets → email received

**Commit & tag when:** Chat logs transaction + Gmail confirmation arrives.
```bash
git add . && git commit -m "Milestone 7: Chatbot logs transactions" && git tag v0.7-chat-log && git push && git push --tags
```

---

## Milestone 8 — Accounts + Assets + Full Picture
**Who:** Antigravity | **Tag:** `v0.8-full-dashboard`
**Goal:** Complete financial picture on one screen.

- [ ] Build `AccountBalances.tsx` — account list, balance in mono, blue/orange
- [ ] Build `AssetMaturityTracker.tsx` — table, sorted by daysToMaturity, amber ≤30 days, orange ≤7 days
- [ ] Wire `SafeToSpendCard.tsx` to real `metrics.safeToSpend` + `metrics.daysLeftInMonth`
- [ ] Responsive layout audit — all sections readable on mobile

**Commit & tag when:** Dashboard shows accounts, assets, and safe-to-spend with real data.
```bash
git add . && git commit -m "Milestone 8: Full dashboard picture" && git tag v0.8-full-dashboard && git push && git push --tags
```

---

## Milestone 9 — Gmail Alerts (All 4 Types)
**Who:** Claude Code | **Tag:** `v0.9-alerts`
**Goal:** All 4 email types arrive in inbox.

- [ ] In n8n: create Gmail OAuth2 credential
- [ ] Build Workflow 4 (`weekly-safe-to-spend-alert`) — Mon 8am schedule
- [ ] Build Workflow 5 (`budget-warning-alert`) — daily 12pm, threshold check
- [ ] Build Workflow 6 (`asset-maturity-reminder`) — daily 9am, 7-day filter
- [ ] Build Workflow 7 (`end-of-month-summary`) — last day 6pm, full P&L
- [ ] Test each manually before activating schedules
- [ ] Activate all schedules

**Commit & tag when:** All 4 email types received in asim.headwaywriting@gmail.com.
```bash
git add . && git commit -m "Milestone 9: Gmail alerts live" && git tag v0.9-alerts && git push && git push --tags
```

---

## Milestone 10 — Production Ready
**Who:** Claude Code (error handling) + Antigravity (polish) | **Tag:** `v1.0-launch`
**Goal:** End-to-end smoke test passes. Live at Vercel URL.

### Claude Code
- [ ] Add n8n Error Trigger nodes to all 7 workflows → Gmail alert on crash
- [ ] Verify all Vercel env vars set: `N8N_DASHBOARD_WEBHOOK_URL`, `N8N_TRANSACTION_WEBHOOK_URL`, `N8N_CHAT_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET`
- [ ] Final API route audit — all have try/catch + timeout + 503

### Antigravity
- [ ] Mobile responsiveness pass — Tailwind `md:` breakpoints on grid and sidebar
- [ ] Loading skeleton on every data section
- [ ] Final visual polish — spacing, font sizes, dividers

### End-to-End Smoke Test
- [ ] Dashboard loads at Vercel URL with real data
- [ ] Add transaction via form → appears instantly → visible in Sheets
- [ ] Ask chatbot "What's my biggest expense this month?" → correct answer
- [ ] Tell chatbot "Log ৳500 transport expense on bKash today" → logged + email arrives
- [ ] Manually trigger Workflow 4 → Monday summary email arrives
- [ ] Open dashboard on mobile browser → all sections readable
- [ ] Check that n8n unreachable → ErrorBanner shows (not blank/crash)

**Commit & tag when:** All smoke tests pass.
```bash
git add . && git commit -m "Milestone 10: v1.0 launch" && git tag v1.0-launch && git push && git push --tags
```

---

## Version History

| Tag | Milestone | Date |
|-----|-----------|------|
| `v0.0-init` | Project setup | 2026-06-09 |
| `v0.1-shell` | Dark shell on Vercel | 2026-06-12 |
| `v0.2-n8n-sheets` | n8n reads Sheets | 2026-06-12 |
| `v0.3-live-data` | Dashboard shows real data | 2026-06-12 |
| `v0.4-charts` | Charts live | 2026-06-12 |
| `v0.5-transactions` | Transaction form | — |
| `v0.6-chat` | AI chatbot | — |
| `v0.7-chat-log` | Chatbot logs transactions | — |
| `v0.8-full-dashboard` | Full dashboard | — |
| `v0.9-alerts` | Gmail alerts | — |
| `v1.0-launch` | Production launch | — |
