#!/usr/bin/env node
/**
 * Recurring Bills feature — backend.
 * 1. CREATE TABLE bills (temp Postgres workflow: create -> activate -> fire -> delete).
 * 2. Patch WF1 finance-data-aggregator: read bills, compute paid/dueDate/daysToDue,
 *    return bills[] + metrics.billsCommitted / billsUnpaid.
 *    paid = a current-month Expense transaction exists with note = 'bill:'+name.
 * 3. Patch WF9 record-creator: allow Bills table (5 values, INSERT def).
 * 4. Patch WF8 record-remover: allow deleting from bills (matched by name).
 * Mark-paid / unmark reuse WF2 (transaction-logger) + WF8 transactions path — no change.
 *
 * Idempotent. Re-exports the three patched workflow JSONs into n8n/.
 * Reads N8N_API_URL / N8N_API_KEY from env (falls back to Claude settings).
 * Usage: node n8n/deploy-bills.js
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

const PG_CRED = { id: 'NVJk0SsDUL8En4zV', name: 'Postgres account' };
const WF1_ID = '8GejOtDtsht0CfEJ'; // finance-data-aggregator
const WF8_ID = 'XBpyHnVzjOHulNje'; // record-remover
const WF9_ID = 'uwl7mHJ8oBzvraqb'; // record-creator

async function api(method, p, body) {
  const r = await fetch(`${BASE}/api/v1${p}`, {
    method, headers: { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${method} ${p} -> ${r.status}: ${await r.text()}`);
  const t = await r.text(); return t ? JSON.parse(t) : null;
}
async function http(method, url, body) {
  const r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
  return { status: r.status, json: j, text: t };
}
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const put = (id, w) => api('PUT', `/workflows/${id}`, { name: w.name, nodes: w.nodes, connections: w.connections, settings: w.settings });
const reactivate = async (id) => { if (!(await api('GET', `/workflows/${id}`)).active) await api('POST', `/workflows/${id}/activate`); };
const exportWf = async (id, file) =>
  fs.writeFileSync(path.join(__dirname, file), JSON.stringify(await api('GET', `/workflows/${id}`), null, 2));

const DDL = `CREATE TABLE IF NOT EXISTS bills (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  amount NUMERIC NOT NULL,
  due_day INT NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  category TEXT,
  account TEXT
);`;

function tempCreateTableWf() {
  return {
    name: 'Finance OS - Create Bills Table (temporary)',
    settings: { executionOrder: 'v1', timezone: 'Asia/Dhaka' },
    nodes: [
      { id: 'wh1', name: 'Trigger', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, 0],
        parameters: { httpMethod: 'POST', path: 'finance-setup-bills', responseMode: 'responseNode', options: {} } },
      { id: 'pg1', name: 'Create Bills Table', type: 'n8n-nodes-base.postgres', typeVersion: 2.5, position: [220, 0],
        parameters: { operation: 'executeQuery', query: DDL, options: {} }, credentials: { postgres: PG_CRED } },
      { id: 'r1', name: 'Done', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [440, 0],
        parameters: { respondWith: 'json', responseBody: '={{ JSON.stringify({ ok: true }) }}', options: {} } },
    ],
    connections: {
      'Trigger': { main: [[{ node: 'Create Bills Table', type: 'main', index: 0 }]] },
      'Create Bills Table': { main: [[{ node: 'Done', type: 'main', index: 0 }]] },
    },
  };
}

// --- WF1 compute-node patch fragments ---
const BILLS_BLOCK = `
const BILL_TAG = 'bill:';
const paidBillNames = {};
curr.forEach(function (t) {
  if (t.type === 'Expense' && t.note && t.note.indexOf(BILL_TAG) === 0) {
    paidBillNames[t.note.slice(BILL_TAG.length)] = true;
  }
});
const billsOut = billsRaw.map(function (b) {
  const name = String(b.name || '');
  const dueDay = Math.min(Math.max(parseInt(b.due_day, 10) || 1, 1), today.daysInMonth);
  const dueDate = today.toFormat('yyyy-MM') + '-' + String(dueDay).padStart(2, '0');
  const paid = !!paidBillNames[name];
  return {
    name: name,
    amount: Number(b.amount) || 0,
    dueDay: dueDay,
    category: String(b.category || ''),
    account: String(b.account || ''),
    paid: paid,
    dueDate: dueDate,
    daysToDue: Math.ceil(DateTime.fromISO(dueDate).diff(today.startOf('day'), 'days').days)
  };
});
const billsCommitted = billsOut.reduce(function (s, b) { return s + b.amount; }, 0);
const billsUnpaid = billsOut.reduce(function (s, b) { return s + (b.paid ? 0 : b.amount); }, 0);
`;

async function main() {
  console.log('STEP 1: create bills table (temp Postgres workflow)...');
  const tmp = await api('POST', '/workflows', tempCreateTableWf());
  await api('POST', `/workflows/${tmp.id}/activate`);
  await sleep(2500);
  const fire = await http('POST', `${BASE}/webhook/finance-setup-bills`);
  console.log('  create table: status=' + fire.status + ' body=' + (fire.text || '').slice(0, 120));
  await api('DELETE', `/workflows/${tmp.id}`);

  console.log('\nSTEP 2: patch WF1 (read + compute bills)...');
  const wf1 = await api('GET', `/workflows/${WF1_ID}`);
  const pg = wf1.nodes.find((n) => n.name === 'Read From Postgres');
  const code = wf1.nodes.find((n) => n.name === 'Compute Dashboard Metrics');
  let changed = false;

  if (pg.parameters.query.indexOf('FROM bills') === -1) {
    pg.parameters.query = pg.parameters.query.replace(
      ') AS budgets;',
      ") AS budgets,\n  (SELECT COALESCE(json_agg(json_build_object('name', name, 'amount', amount, 'due_day', due_day, 'category', category, 'account', account)), '[]') FROM bills) AS bills;"
    );
    if (pg.parameters.query.indexOf('FROM bills') === -1) throw new Error('WF1 query patch failed');
    changed = true;
  }

  if (code.parameters.jsCode.indexOf('billsOut') === -1) {
    let js = code.parameters.jsCode;
    js = js.replace('const budgetsRaw = $json.budgets || [];',
      'const budgetsRaw = $json.budgets || [];\nconst billsRaw = $json.bills || [];');
    js = js.replace('return [{ json: {', BILLS_BLOCK + '\nreturn [{ json: {');
    js = js.replace('accountsStartingTotal: accountsStartingTotal },',
      'accountsStartingTotal: accountsStartingTotal, billsCommitted: billsCommitted, billsUnpaid: billsUnpaid },');
    js = js.replace('  budgets: budgets\n} }];', '  budgets: budgets,\n  bills: billsOut\n} }];');
    if (js.indexOf('bills: billsOut') === -1 || js.indexOf('billsCommitted: billsCommitted') === -1)
      throw new Error('WF1 compute patch failed');
    code.parameters.jsCode = js;
    changed = true;
  }

  if (changed) { await put(WF1_ID, wf1); await reactivate(WF1_ID); console.log('  WF1 patched'); }
  else console.log('  WF1 already has bills — skipped');
  await exportWf(WF1_ID, 'finance-data-aggregator.json');

  console.log('\nSTEP 3: patch WF9 record-creator (allow Bills)...');
  const wf9 = await api('GET', `/workflows/${WF9_ID}`);
  const validate = wf9.nodes.find((n) => n.name === 'Validate Create');
  const buildIns = wf9.nodes.find((n) => n.name === 'Build Insert SQL');
  let c9 = false;
  if (validate.parameters.jsCode.indexOf('Bills:') === -1) {
    validate.parameters.jsCode = validate.parameters.jsCode.replace('Budgets: 2 };', 'Budgets: 2, Bills: 5 };');
    if (validate.parameters.jsCode.indexOf('Bills: 5') === -1) throw new Error('WF9 validate patch failed');
    c9 = true;
  }
  if (buildIns.parameters.jsCode.indexOf("table: 'bills'") === -1) {
    buildIns.parameters.jsCode = buildIns.parameters.jsCode.replace(
      "  Budgets: { table: 'budgets', cols: ['category','monthly_limit'], types: ['text','numNotNull'], conflict: 'category' },",
      "  Budgets: { table: 'budgets', cols: ['category','monthly_limit'], types: ['text','numNotNull'], conflict: 'category' },\n  Bills: { table: 'bills', cols: ['name','amount','due_day','category','account'], types: ['text','numNotNull','numNotNull','text','text'], conflict: 'name' },"
    );
    if (buildIns.parameters.jsCode.indexOf("table: 'bills'") === -1) throw new Error('WF9 insert patch failed');
    c9 = true;
  }
  if (c9) { await put(WF9_ID, wf9); await reactivate(WF9_ID); console.log('  WF9 patched'); }
  else console.log('  WF9 already allows Bills — skipped');
  await exportWf(WF9_ID, 'record-creator.json');

  console.log('\nSTEP 4: patch WF8 record-remover (allow bills delete)...');
  const wf8 = await api('GET', `/workflows/${WF8_ID}`);
  const buildDel = wf8.nodes.find((n) => n.name === 'Build Delete SQL');
  if (buildDel.parameters.jsCode.indexOf("Bills:") === -1) {
    buildDel.parameters.jsCode = buildDel.parameters.jsCode.replace(
      "Accounts: 'accounts' };", "Accounts: 'accounts', Bills: 'bills' };");
    if (buildDel.parameters.jsCode.indexOf("Bills: 'bills'") === -1) throw new Error('WF8 delete patch failed');
    await put(WF8_ID, wf8); await reactivate(WF8_ID); console.log('  WF8 patched');
  } else console.log('  WF8 already allows bills — skipped');
  await exportWf(WF8_ID, 'record-remover.json');

  console.log('\nSTEP 5: verify dashboard webhook returns bills...');
  await sleep(1500);
  const d = (await http('GET', `${BASE}/webhook/finance-dashboard`)).json;
  console.log('  bills:', JSON.stringify(d.bills));
  console.log('  billsCommitted:', d.metrics && d.metrics.billsCommitted, ' billsUnpaid:', d.metrics && d.metrics.billsUnpaid);
  console.log('\nDONE.');
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
