# Finance OS — Progress

Quick state-of-the-project file. Full task lists live in `MILESTONES.md`; this is the running log of what's actually live.

## Current State (2026-06-12)

**Progress: ~65% · Latest tag: `v0.3-live-data`**

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

## Next Up — Milestone 4 (`v0.4-charts`, Antigravity only)

- `npm install recharts`; build SpendingByCategory (horizontal bar, CATEGORY_COLORS), MonthlyTrend (2-line chart), GoalsProgress (bar + 80% reference line); shared chart config from gemini.md; all in ResponsiveContainer.

## Notes / Decisions

- `safeToSpend` = current-month net − total monthly goal contributions (defined in Workflow 1 Code node).
- All financial math lives in the Workflow 1 Code node — the AI never computes numbers.
- n8n public API can't execute manual workflows → one-off jobs run as temporary webhook workflows (create → activate → call → delete).
- Sheet seeded with `valueInputOption: RAW` so dates stay strings; reader still converts date serials defensively.
