#!/usr/bin/env node
/**
 * Patches Workflow 9 (record-creator)'s "Build Insert SQL" node so the
 * Budgets table upserts instead of silently no-op'ing on a duplicate
 * category. Goals/Assets/Categories/Accounts keep their existing
 * ON CONFLICT DO NOTHING behavior — only Budgets changes.
 *
 * Needed so re-setting a budget (from the form, or from the AI chat's new
 * set_budget action) actually updates the limit instead of doing nothing
 * and returning a misleading "already exists" for a category you can't see
 * the effect of changing.
 */
require('dotenv').config({ path: process.env.HOME + '/.env' })
const BASE = 'https://asim.sg-node8n.serverdoor.com'
const KEY = process.env.N8N_API_KEY
if (!KEY) throw new Error('N8N_API_KEY not set in environment')
const WF9_ID = 'uwl7mHJ8oBzvraqb'

async function api(method, p, body) {
  const r = await fetch(`${BASE}/api/v1${p}`, {
    method,
    headers: { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!r.ok) throw new Error(`${method} ${p} -> ${r.status}: ${await r.text()}`)
  const text = await r.text()
  return text ? JSON.parse(text) : null
}

const buildInsertSqlCode = `
const TABLES = {
  Goals: { table: 'goals', cols: ['goal_name','target_amount','saved_so_far','monthly_contribution','priority'], types: ['text','numNotNull','numNotNull','numNotNull','text'], conflict: null, onConflict: null },
  Assets: { table: 'assets', cols: ['asset_name','type','value','institution','start_date','maturity_date','interest_rate','notes'], types: ['text','text','numNotNull','text','date','date','num','text'], conflict: null, onConflict: null },
  Categories: { table: 'categories', cols: ['name','type','color'], types: ['text','text','text'], conflict: 'name', onConflict: 'DO NOTHING' },
  Accounts: { table: 'accounts', cols: ['account_name','starting_balance','as_of_date'], types: ['text','numNotNull','date'], conflict: 'account_name', onConflict: 'DO NOTHING' },
  Budgets: { table: 'budgets', cols: ['category','monthly_limit'], types: ['text','numNotNull'], conflict: 'category', onConflict: 'DO UPDATE SET monthly_limit = EXCLUDED.monthly_limit' },
};
const tab = $json.tab;
const values = $json.values || [];
const def = TABLES[tab];
const escText = (v) => (v === undefined || v === null || v === '') ? 'NULL' : "'" + String(v).replace(/'/g, "''") + "'";
const escNum = (v) => (v === undefined || v === null || v === '') ? 'NULL' : Number(v);
const escNumNotNull = (v) => (v === undefined || v === null || v === '') ? 0 : Number(v);
const escDate = (v) => (v === undefined || v === null || v === '') ? 'NULL' : "'" + String(v) + "'";
const esc = { text: escText, num: escNum, numNotNull: escNumNotNull, date: escDate };
const rendered = def.cols.map(function (c, i) { return esc[def.types[i]](values[i]); }).join(', ');
const conflictClause = def.conflict ? (' ON CONFLICT (' + def.conflict + ') ' + def.onConflict) : '';
const query = 'WITH ins AS (INSERT INTO ' + def.table + ' (' + def.cols.join(', ') + ') VALUES (' + rendered + ')' + conflictClause + ' RETURNING id) SELECT COUNT(*) AS inserted_count FROM ins;';
return [{ json: { query } }];
`.trim()

;(async () => {
  const wf = await api('GET', `/workflows/${WF9_ID}`)
  const node = wf.nodes.find((n) => n.name === 'Build Insert SQL')
  if (!node) throw new Error('Build Insert SQL node not found')
  node.parameters.jsCode = buildInsertSqlCode

  await api('PUT', `/workflows/${WF9_ID}`, { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings })
  console.log('Patched Workflow 9 Build Insert SQL node — Budgets now upserts.')

  console.log('Testing: create a throwaway budget category+budget, then update the budget limit...')
  const catRes = await fetch(`${BASE}/webhook/finance-create`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tab: 'Categories', values: ['__upsert-test-cat__', 'Expense', '#000000'] }),
  })
  console.log('category create status:', catRes.status, await catRes.text())

  const b1 = await fetch(`${BASE}/webhook/finance-create`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tab: 'Budgets', values: ['__upsert-test-cat__', 100] }),
  })
  console.log('first budget create status:', b1.status, await b1.text())

  const b2 = await fetch(`${BASE}/webhook/finance-create`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tab: 'Budgets', values: ['__upsert-test-cat__', 250] }),
  })
  console.log('second budget create (should now UPDATE, not 400) status:', b2.status, await b2.text())
})().catch((e) => {
  console.error('FAILED:', e.message)
  process.exit(1)
})
