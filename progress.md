# Finance OS — Progress

Quick state-of-the-project file. Full task lists live in `MILESTONES.md`; this is the running log of what's actually live.

## Current State (2026-06-20)

**Progress: 100% — LAUNCHED, now on Postgres · Latest milestone: M12 (Postgres migration)**

| What | Status |
|------|--------|
| Live dashboard | https://finance-os-eight-delta.vercel.app/ |
| Data store | Postgres (Neon free tier) — 5 accounts, 18 categories, 1 goal, 0 assets, 58 transactions, 0 budgets |
| Old Google Sheet | `Finance OS` — ID `16vNm0PPxV-OP1Kp_INOKiBz33YcL-ZkowAyRw7HnwcI` — kept as inert backup, not read from |
| n8n Workflow 1 | `finance-data-aggregator` (ID `8GejOtDtsht0CfEJ`) — ACTIVE, Postgres-backed |
| Live webhook | `GET https://asim.sg-node8n.serverdoor.com/webhook/finance-dashboard` → `DashboardData` JSON |
| AI provider | OpenAI (`gpt-4o-mini`), n8n credential `OpenAi account` ID `9L3j2utOyiBJWa9S` — DeepSeek dropped 2026-06-12 |
| Postgres credential | `Postgres account` ID `NVJk0SsDUL8En4zV` |

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

## Milestone 9 — DONE (`v0.9-alerts`, 2026-06-13)

- **All 4 scheduled Gmail alert workflows live** (scripted in `n8n/deploy-milestone9.js`, JSONs exported): WF4 `weekly-safe-to-spend-alert` (Mon 8am, always sends), WF5 `budget-warning-alert` (daily 12pm), WF6 `asset-maturity-reminder` (daily 9am, ≤7-day filter), WF7 `end-of-month-summary` (cron 6pm days 28–31, Code node gates to the actual last day). All share the same shape: Schedule → fetch Workflow 1's pre-computed JSON → Code builds email + send decision → IF → Gmail. All have the global error handler set as `errorWorkflow`.
- **Decision:** no per-category budget amounts exist anywhere in the Sheet (4 tabs only), so WF5's 80% threshold (from `lib/constants.ts`) applies to total month expenses vs income. If a Budgets tab is ever added, extend Workflow 1 + WF5.
- **Tested before activating schedules:** each workflow carried a temporary `?force=true` GET webhook; all 4 fired, all 4 emails verified in the inbox (incl. real triggers: FDR at exactly 7 days to maturity sent naturally). Test triggers stripped afterwards.
- **Gotchas:** the n8n Code sandbox's `toLocaleString('en-IN')` produces broken grouping (partial ICU) — replaced with a manual Indian-grouping regex. Also: Gmail's *snippet* strips commas from numbers, which made the fix look like it hadn't worked — always check `plaintextBody`, not the snippet.

## Milestone 10 — DONE (`v1.0-launch`, 2026-06-13) — PRODUCTION

- **Error handling:** all 7 workflows now route crashes to `Error Handler - Global` (Error Trigger → Gmail) via `settings.errorWorkflow` (`deploy-milestone10.js` wired WF1–3; WF4–7 had it from M9).
- **Full production smoke test passed** (against the live Vercel URL): dashboard real data · invalid tx → 400 · form tx → row in Sheet · chat Q&A ("biggest expense" → Rent / Housing ৳18,000, correct) · chat log → row + confirmation email in inbox · WF4 manual fire → weekly email in inbox · n8n unreachable → 503/ErrorBanner · test rows cleaned up.
- **Deferred (documented in MILESTONES):** `N8N_WEBHOOK_SECRET` — webhook auth was never implemented in any milestone; doing it right needs secret checks in 3 workflows without leaking the secret into exported JSONs. Post-launch hardening.
- **Post-launch notes:** Sheet still holds Jan–Jun 2026 *sample* data — replace with real finances to start using it for real. Asim should eyeball the dashboard on his phone once.

## Milestone 11 — DONE (`v1.1-crud`, 2026-06-13) — CRUD + dynamic categories

Asim's 5-feature batch turning the append-only app into an editable one:
- **Remove buttons** on transactions, goals, and assets — each behind a confirm dialog (`components/ui/confirm-dialog.tsx`). New **Workflow 8 `record-remover`** (`XBpyHnVzjOHulNje`, POST `/finance-delete`): reads the tab, finds the first row matching every `match` field (aggregator-style normalisation for dates/amounts), deletes via Sheets `batchUpdate deleteDimension`. 400 if no match — nothing deleted. Solves the row-identity problem without a Sheet schema change.
- **Add goals / assets / categories** — new forms (`GoalForm`, `AssetForm`, `CategoryForm`) + **Workflow 9 `record-creator`** (`uwl7mHJ8oBzvraqb`, POST `/finance-create`): validates tab + value count, appends to Goals/Assets/Categories.
- **Dynamic categories** — new `Categories` tab (name, type, color) seeded from `lib/constants.ts`; aggregator (WF1) now reads 5 tabs and returns `categories[]`; `TransactionForm` builds its dropdown from live data (constants = fallback). Chat handler (WF3) derives its category lists from live `categories[]` too, so chat-logging knows custom categories.
- **No more per-transaction email** — removed WF3's `Email Confirmation?` + `Send Confirmation Email` nodes and the "confirmation email is on its way" reply text. The 4 scheduled digest workflows (WF4–7) are untouched and still active.
- **Frontend:** new routes `DELETE /api/transactions`, `/api/goals`, `/api/assets`, `/api/categories` (share `lib/n8n-proxy.ts`); hooks `useTransactions.removeTransaction`, `useGoals`, `useAssets`, `useCategories`; all demo-mode safe.
- **New env vars:** `N8N_CREATE_WEBHOOK_URL`, `N8N_DELETE_WEBHOOK_URL` — in `.env.local`; **must also be added to Vercel Production** or the add/remove buttons 503.
- Deployed via `n8n/deploy-milestone11.js`; verified end-to-end (17/17 checks: add/remove for all 4 record types, invalid-input 400s, delete-missing 400, chat-log reply has no email mention). Test rows cleaned up.

## Milestone 12 — DONE (2026-06-20) — Postgres migration

Moved off Google Sheets entirely. Data now lives in Postgres (Neon free tier), still accessed only through n8n — the Next.js frontend is unchanged since it only ever talked to n8n webhooks, never to the data store directly.

- **Schema:** 6 tables (`accounts`, `categories`, `transactions`, `goals`, `assets`, `budgets`) mirroring the old 6 Sheet tabs column-for-column, plus real foreign keys (`transactions.category`/`account` reference `categories`/`accounts`) and `UNIQUE` constraints the Sheet never had.
- **Data copy:** one-time migration workflow (`n8n/migrate-to-postgres.js`) read all tabs and inserted them in dependency order (accounts/categories before transactions). First attempt silently inserted 0 rows because `bKash`'s blank starting balance violated a `NOT NULL` constraint — caught by checking real `COUNT(*)` in Postgres rather than trusting the workflow's own success message, fixed by defaulting blank required numerics to 0, re-ran clean: 5 accounts, 18 categories, 1 goal, 0 assets, 58 transactions.
- **Workflow swaps** (each tested against the live webhook before moving to the next):
  - **Workflow 1** (`finance-data-aggregator`): the Sheets `batchGet` + header-mapping Code became one Postgres query using `json_agg`/`json_build_object` per table, with dates formatted via `to_char(..., 'YYYY-MM-DD')` — raw date/timestamp columns serialize with a timezone shift otherwise (a `DATE` of `2026-06-13` round-tripped as `2026-06-12T18:00:00.000Z`, which is the wrong calendar day if you just slice the string).
  - **Workflow 2** (`transaction-logger`): Sheets append → `INSERT`, same validation Code node untouched.
  - **Workflow 8** (`record-remover`): the old "fetch sheet metadata → read tab → scan rows → delete by row index" (3 nodes) collapsed into one `DELETE ... WHERE id = (SELECT id ... ORDER BY id LIMIT 1)` query wrapped in a CTE that always returns a count, so n8n never gets zero output items even when nothing matches.
  - **Workflow 9** (`record-creator`): Sheets append → `INSERT`, with `ON CONFLICT DO NOTHING` + a count check on `categories`/`accounts`/`budgets` (which now have unique constraints the Sheet never enforced) — a duplicate-key attempt now returns a clean 400 instead of crashing the workflow.
- **Workflows 3–7** needed no changes — they only ever called Workflow 1/2's webhooks, never touched Sheets directly.
- **Discovered along the way:** the live Sheet actually had 6 tabs, not the 5 documented in CLAUDE.md (`Budgets` was added later, undocumented) and `Accounts` had an undocumented third column (`as_of_date`) that the balance-calculation logic depends on. Both were added to the Postgres schema and backfilled before any workflow was switched over, so nothing was silently dropped.
- **Sheet status:** left fully intact as a backup, not wired into anything anymore.

## Demo Deployment — IN PROGRESS (2026-06-13)

- New `lib/demo-data.ts` + `NEXT_PUBLIC_DEMO_MODE` flag gate `/api/dashboard`, `/api/transactions`, `/api/chat` and `useTransactions` to serve self-contained sample data, canned chat replies, and no-persist transactions — documented in CLAUDE.md.
- Plan: deploy a second Vercel project `finance-os-demo` from the same repo/branch with `NEXT_PUBLIC_DEMO_MODE=true` and no `N8N_*` vars, for sharing publicly (Upwork/portfolio) without exposing real finances.
- Next: verify demo build + real build locally, then commit/push and create the second Vercel project.

## Verified 2026-06-12 (end of session)

- End-to-end pipeline confirmed with a real edit: Asim added a ৳48,000 income row to the Sheet → dashboard recalculated income/net/safe-to-spend/balances correctly within the 60s poll. Sheet → n8n → API → SWR all live.
- Sample data note: bKash balance is negative (−5,600) by design of the seed; delete the 2026-06-12 Upwork 48,000 test row in the Sheet to return to baseline numbers (income 103,000).
- **For Milestone 8 (Antigravity):** negative account balances currently render blue with a minus sign in the Accounts placeholder — design system says negatives must be orange (`brand-expense`). Fix when building AccountBalances.tsx.

## Notes / Decisions

- `safeToSpend` = current-month net − total monthly goal contributions (defined in Workflow 1 Code node).
- All financial math lives in the Workflow 1 Code node — the AI never computes numbers.
- n8n public API can't execute manual workflows → one-off jobs run as temporary webhook workflows (create → activate → call → delete).
- Sheet seeded with `valueInputOption: RAW` so dates stay strings; reader still converts date serials defensively.
