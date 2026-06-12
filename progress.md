# Finance OS — Progress

Quick state-of-the-project file. Full task lists live in `MILESTONES.md`; this is the running log of what's actually live.

## Current State (2026-06-13)

**Progress: ~96% · Latest tag: `v0.8-full-dashboard`**

| What | Status |
|------|--------|
| Live dashboard | https://finance-os-eight-delta.vercel.app/ (dark shell, stub data) |
| Google Sheet | `Finance OS` — ID `16vNm0PPxV-OP1Kp_INOKiBz33YcL-ZkowAyRw7HnwcI`, 4 tabs, ~70 sample transactions Jan–Jun 2026 |
| n8n Workflow 1 | `finance-data-aggregator` (ID `8GejOtDtsht0CfEJ`) — ACTIVE |
| Live webhook | `GET https://asim.sg-node8n.serverdoor.com/webhook/finance-dashboard` → `DashboardData` JSON |
| AI provider | OpenAI (`gpt-4o-mini`), n8n credential `OpenAi account` ID `9L3j2utOyiBJWa9S` — DeepSeek dropped 2026-06-12 |
| Sheets credential | `Google Sheets account` ID `eo7uMjjFUzvjTAGi` (reused) |

## Milestone Log

- **2026-06-09 — Milestone 0** (`v0.0-init`): repo, CLAUDE.md / gemini.md / MILESTONES.md constitutions.
- **2026-06-12 — Milestone 1** (`v0.1-shell`): Claude Code scaffolded Next.js 14.2.35 + lib contract + stub API routes; Antigravity built the dark shell (shadcn, AppShell, MetricGrid, SafeToSpendCard); deployed to Vercel.
- **2026-06-12 — Milestone 2** (`v0.2-n8n-sheets`): Google Sheet created + seeded via temporary n8n helper workflow (scripted in `n8n/deploy-milestone2.js`); Workflow 1 live — webhook → Sheets `batchGet` (all 4 tabs, 1 call) → Code node math → respond. Tested: June metrics income 103,000 / expenses 33,400 / safeToSpend 34,600; FDR maturing in 8 days flagged correctly.
- **2026-06-12 — Provider switch**: DeepSeek → OpenAI everywhere (docs, comments, live workflow sticky note). No architecture change.

## Milestone 3 — DONE (`v0.3-live-data`, 2026-06-12)

- **Claude Code:** `/api/dashboard` proxies the n8n webhook (try/catch, 10s AbortController, 503 on failure). `N8N_DASHBOARD_WEBHOOK_URL` in Vercel Production + `.env.local` locally.
- **Antigravity:** `hooks/useDashboardData.ts` (SWR, 60s polling, keepPreviousData), three-state UX in page.tsx (skeletons on first load / normal / ErrorBanner above stale data on refresh failure, centered banner + retry on first-load failure).
- **Also fixed:** transparent AI Assistant Sheet panel — shadcn token colors (bg-card/bg-popover) were never mapped in tailwind.config.ts on Tailwind v3, so the classes generated no CSS.

## Milestone 4 — DONE (`v0.4-charts`, 2026-06-12)

- Antigravity built SpendingByCategory (horizontal bar, CATEGORY_COLORS + gray fallback), MonthlyTrend (blue/orange 2-line), GoalsProgress (progressPct bars, amber #f59e0b reference line at 80%, domain [0,100]); shared dark chart config, ৳ tooltips, skeletons. Verified against gemini.md spec by Claude Code.

## Milestone 5 — Claude Code half DONE (2026-06-12)

- [x] **Workflow 2 `transaction-logger`** (ID `WwmlYYISq5buXPYx`) live: POST webhook → validate (required fields incl. payee, Income/Expense type, positive amount, YYYY-MM-DD date) → Sheets append (RAW) → respond. 400 + error list on invalid, nothing written.
- [x] **`/api/transactions`** is a real proxy now: cheap missing-field pre-check, 10s timeout, n8n 400s passed through, 503 if n8n unreachable.
- [x] Tested end-to-end by script (`n8n/deploy-milestone5.js`): invalid → 400; valid → row in Sheet, visible via aggregator; test row auto-deleted by temp helper workflow.
- [x] **Antigravity UI half DONE (2026-06-12):** TransactionForm (all fields incl. Amount, accounts from live cache), TransactionList (category badges, color-coded amounts), useTransactions (optimistic cache patch with current-month guard, rollbackOnError). All 4 plan-review corrections verified in code by Claude Code.
- [x] All 3 env vars in Vercel Production (dashboard, transaction, chat). Tagged `v0.5-transactions` 2026-06-12 — form + list + optimistic UI live in production.

## Milestone 6 — DONE (`v0.6-chat`, 2026-06-13)

- [x] **Workflow 3 `ai-chat-handler`** (ID `5RkSgctHtRNq3mIR`) live: webhook → fetches Workflow 1's pre-computed JSON → gpt-4o-mini (existing `OpenAi account` credential) with strict never-compute-numbers system prompt → parse intent → `{ reply, action, transaction }`.
- [x] **`/api/chat`** real proxy: 30s timeout, graceful `"AI temporarily unavailable"` fallback (rendered as a normal AI bubble).
- [x] Tested live: groceries question answered with correct ৳6,400; "log 500 taka transport on bKash" parsed to perfect action JSON (logging itself activates in Milestone 7).
- [x] **Chat UI (2026-06-13, built by Claude Code with Asim's OK instead of Antigravity):** `hooks/useChat.ts` (messages seeded with welcome, last-10 history sent, fallback bubble on any failure), `components/chat/ChatMessage.tsx` (user right/blue tint, AI left/neutral), `ChatInput.tsx` (send disabled while loading or empty), `ChatPanel.tsx` (Sheet from right, auto-scroll to newest, `animate-pulse` "Thinking..." bubble — no spinner). Mock Sheet block removed from page.tsx.
- [x] Verified before tagging: clean `npm run build`, then local prod server — "What did I spend on groceries this month?" → "You spent ৳6,400 on groceries this month." (correct).

## Milestone 7 — DONE (`v0.7-chat-log`, 2026-06-13)

- **Workflow 3 extended** (scripted in `n8n/deploy-milestone7.js`): `Parse Intent → Is Log Request?` IF; true branch POSTs the parsed transaction to Workflow 2's webhook (`neverError` + `fullResponse` so a 400 becomes a friendly chat reply, not a crash) → `Build Logged Reply` → respond. Gmail confirmation node sits AFTER `Return Chat Reply` behind an `Email Confirmation?` IF, with `onError: continue` — email latency or failure can never delay or break the chat reply.
- **Tested live end to end:** regression (groceries → ৳6,400 still correct); "Log a 10 taka Miscellaneous expense in Cash" → reply "Logged: Expense of ৳10 — Miscellaneous via Cash on 2026-06-13..." → row confirmed via aggregator → confirmation email verified in inbox (subject "Finance OS: Expense ৳10 logged (Miscellaneous)") → test row deleted by temp helper workflow, helper removed.
- IF nodes use always-boolean expressions (`{{ $json.action === "log_transaction" }}`) — strict type validation errors on null/undefined left values otherwise.

## Milestone 8 — DONE (`v0.8-full-dashboard`, 2026-06-13)

- Built by Claude Code with Asim's OK (normally Antigravity's half): `components/accounts/AccountBalances.tsx` (negative balances now orange — fixed the M5-era inline list that rendered everything blue) and `components/assets/AssetMaturityTracker.tsx` (sorted by daysToMaturity with nulls last, amber ≤30 days, orange + AlertTriangle ≤7 days). Tracker shows on both the dashboard (Row 3) and the Assets tab.
- Goals and Assets placeholder tabs replaced with real views (goal cards: progress bar, priority badge, saved/target/contribution in mono; three-state loading/error/data UX like the other views). `renderPlaceholderView` removed.
- SafeToSpendCard was already wired to real metrics since M3 — verified. Responsive audit passed: grids stack to 1 col, tables `overflow-x-auto`, sidebar drawer, chat sheet full-width on mobile.
- Verified locally on a prod build: page 200, real data (bKash −5,600 orange case, FDR 7 days out hits the urgent threshold).

## Verified 2026-06-12 (end of session)

- End-to-end pipeline confirmed with a real edit: Asim added a ৳48,000 income row to the Sheet → dashboard recalculated income/net/safe-to-spend/balances correctly within the 60s poll. Sheet → n8n → API → SWR all live.
- Sample data note: bKash balance is negative (−5,600) by design of the seed; delete the 2026-06-12 Upwork 48,000 test row in the Sheet to return to baseline numbers (income 103,000).
- **For Milestone 8 (Antigravity):** negative account balances currently render blue with a minus sign in the Accounts placeholder — design system says negatives must be orange (`brand-expense`). Fix when building AccountBalances.tsx.

## Notes / Decisions

- `safeToSpend` = current-month net − total monthly goal contributions (defined in Workflow 1 Code node).
- All financial math lives in the Workflow 1 Code node — the AI never computes numbers.
- n8n public API can't execute manual workflows → one-off jobs run as temporary webhook workflows (create → activate → call → delete).
- Sheet seeded with `valueInputOption: RAW` so dates stay strings; reader still converts date serials defensively.
