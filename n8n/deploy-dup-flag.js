#!/usr/bin/env node
/**
 * Bills duplicate-warning flag — patch WF1 finance-data-aggregator.
 * Adds `possibleDuplicate` to each bill: true when the bill is UNPAID and a
 * current-month MANUAL (non-bill) expense of the same amount already exists —
 * a soft "did you already log this?" warning shown before marking paid.
 * Idempotent. Re-exports WF1 JSON. (Mirrors lib/dashboard.ts.)
 */
const fs = require('fs');
const path = require('path');
let BASE = process.env.N8N_API_URL, KEY = process.env.N8N_API_KEY;
if (!BASE || !KEY || /\$\{/.test(KEY)) {
  try { const s = JSON.parse(fs.readFileSync('C:/Users/User/.claude/settings.json', 'utf8')); const e = s.mcpServers['n8n-mcp'].env; BASE = BASE || e.N8N_API_URL; if (!KEY || /\$\{/.test(KEY)) KEY = process.env.N8N_API_KEY || e.N8N_API_KEY; } catch {}
}
BASE = BASE || 'https://asim.sg-node8n.serverdoor.com';
const WF1_ID = '8GejOtDtsht0CfEJ';

async function api(method, p, body) {
  const r = await fetch(`${BASE}/api/v1${p}`, { method, headers: { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(`${method} ${p} -> ${r.status}: ${await r.text()}`);
  const t = await r.text(); return t ? JSON.parse(t) : null;
}
async function httpGet(url) { const r = await fetch(url); const t = await r.text(); try { return JSON.parse(t); } catch { return null; } }

const MANUAL_BLOCK = `const manualExpenseAmounts = {};
curr.forEach(function (t) {
  if (t.type === 'Expense' && (!t.note || t.note.indexOf(BILL_TAG) !== 0)) { manualExpenseAmounts[t.amount] = true; }
});
const billsOut = billsRaw.map(function (b) {`;

async function main() {
  const wf1 = await api('GET', `/workflows/${WF1_ID}`);
  const code = wf1.nodes.find((n) => n.name === 'Compute Dashboard Metrics');
  let js = code.parameters.jsCode;

  if (js.indexOf('possibleDuplicate') !== -1) {
    console.log('WF1 already has possibleDuplicate — skipped.');
  } else {
    if (js.indexOf('const billsOut = billsRaw.map(function (b) {') === -1) throw new Error('billsOut anchor not found — is the bills feature deployed?');
    js = js.replace('const billsOut = billsRaw.map(function (b) {', MANUAL_BLOCK);
    const dueAnchor = "daysToDue: Math.ceil(DateTime.fromISO(dueDate).diff(today.startOf('day'), 'days').days)";
    if (js.indexOf(dueAnchor) === -1) throw new Error('daysToDue anchor not found');
    js = js.replace(dueAnchor, dueAnchor + ',\n    possibleDuplicate: (!paid && !!manualExpenseAmounts[Number(b.amount) || 0])');
    if (js.indexOf('possibleDuplicate') === -1 || js.indexOf('manualExpenseAmounts') === -1) throw new Error('patch failed');
    code.parameters.jsCode = js;
    await api('PUT', `/workflows/${WF1_ID}`, { name: wf1.name, nodes: wf1.nodes, connections: wf1.connections, settings: wf1.settings });
    if (!(await api('GET', `/workflows/${WF1_ID}`)).active) await api('POST', `/workflows/${WF1_ID}/activate`);
    console.log('WF1 patched.');
  }
  fs.writeFileSync(path.join(__dirname, 'finance-data-aggregator.json'), JSON.stringify(await api('GET', `/workflows/${WF1_ID}`), null, 2));

  await new Promise((r) => setTimeout(r, 1500));
  const d = await httpGet(`${BASE}/webhook/finance-dashboard`);
  console.log('sample bills possibleDuplicate flags:', JSON.stringify((d.bills || []).map((b) => ({ name: b.name, paid: b.paid, dup: b.possibleDuplicate }))));
  console.log('DONE.');
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
