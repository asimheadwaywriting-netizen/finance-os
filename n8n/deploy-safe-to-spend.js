#!/usr/bin/env node
/**
 * Safe-to-Spend v2 — make the number honest about committed money.
 *
 *   safeToSpend = total account cash  − total monthly goal contributions  − UNPAID bills this month
 *   weeklySafeToSpend = safeToSpend / weeks left in the month (>= 1)
 *
 * Paid bills are already logged as transactions (they reduced cash), so only UNPAID
 * bills are subtracted — no double counting. Computed in the WF1 Code node AFTER the
 * bills block (where billsUnpaid is defined). Idempotent. Re-exports WF1 JSON.
 */
const fs = require('fs');
const path = require('path');

let BASE = process.env.N8N_API_URL;
let KEY = process.env.N8N_API_KEY;
if (!BASE || !KEY || /\$\{/.test(KEY)) {
  try {
    const s = JSON.parse(fs.readFileSync('C:/Users/User/.claude/settings.json', 'utf8'));
    const env = s.mcpServers['n8n-mcp'].env;
    BASE = BASE || env.N8N_API_URL;
    if (!KEY || /\$\{/.test(KEY)) KEY = process.env.N8N_API_KEY || env.N8N_API_KEY;
  } catch {}
}
BASE = BASE || 'https://asim.sg-node8n.serverdoor.com';
const WF1_ID = '8GejOtDtsht0CfEJ';

async function api(method, p, body) {
  const r = await fetch(`${BASE}/api/v1${p}`, {
    method, headers: { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${method} ${p} -> ${r.status}: ${await r.text()}`);
  const t = await r.text(); return t ? JSON.parse(t) : null;
}
async function httpGet(url) { const r = await fetch(url); const t = await r.text(); try { return JSON.parse(t); } catch { return null; } }

const STS_BLOCK = `
const totalCashForStS = accountBalances.reduce(function (s, a) { return s + a.balance; }, 0);
const safeToSpendAdj = Math.max(0, totalCashForStS - goalContrib - billsUnpaid);
const weeksLeft = Math.max(1, Math.ceil(daysLeftInMonth / 7));
const weeklySafeToSpend = Math.round(safeToSpendAdj / weeksLeft);
`;

async function main() {
  const wf1 = await api('GET', `/workflows/${WF1_ID}`);
  const code = wf1.nodes.find((n) => n.name === 'Compute Dashboard Metrics');
  let js = code.parameters.jsCode;

  if (js.indexOf('safeToSpendAdj') !== -1) {
    console.log('WF1 already has safe-to-spend v2 — skipped.');
  } else {
    const anchor = 'const billsUnpaid = billsOut.reduce(function (s, b) { return s + (b.paid ? 0 : b.amount); }, 0);';
    if (js.indexOf(anchor) === -1) throw new Error('anchor (billsUnpaid line) not found — is the bills feature deployed?');
    js = js.replace(anchor, anchor + '\n' + STS_BLOCK);
    js = js.replace('safeToSpend: safeToSpend, daysLeftInMonth:',
      'safeToSpend: safeToSpendAdj, weeklySafeToSpend: weeklySafeToSpend, daysLeftInMonth:');
    if (js.indexOf('safeToSpendAdj') === -1 || js.indexOf('weeklySafeToSpend: weeklySafeToSpend') === -1)
      throw new Error('patch failed');
    code.parameters.jsCode = js;
    await api('PUT', `/workflows/${WF1_ID}`, { name: wf1.name, nodes: wf1.nodes, connections: wf1.connections, settings: wf1.settings });
    if (!(await api('GET', `/workflows/${WF1_ID}`)).active) await api('POST', `/workflows/${WF1_ID}/activate`);
    console.log('WF1 patched.');
  }
  fs.writeFileSync(path.join(__dirname, 'finance-data-aggregator.json'), JSON.stringify(await api('GET', `/workflows/${WF1_ID}`), null, 2));

  await new Promise((r) => setTimeout(r, 1500));
  const d = await httpGet(`${BASE}/webhook/finance-dashboard`);
  console.log('  safeToSpend:', d.metrics.safeToSpend, ' weekly:', d.metrics.weeklySafeToSpend,
    ' (billsUnpaid', d.metrics.billsUnpaid, '/ daysLeft', d.metrics.daysLeftInMonth, ')');
  console.log('DONE.');
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
