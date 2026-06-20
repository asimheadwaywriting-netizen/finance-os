#!/usr/bin/env node
/**
 * One-time migration: copy the 5 Sheet tabs into the new Postgres tables.
 *
 * Creates a temporary webhook-triggered helper workflow, activates it,
 * calls it once, prints the result (real COUNT(*) from Postgres), then
 * deletes the workflow.
 *
 * Reads N8N_API_KEY from the environment. N8N_API_URL is hardcoded to the
 * same host every other deploy script in this folder uses.
 */

const BASE = 'https://asim.sg-node8n.serverdoor.com';
const KEY = process.env.N8N_API_KEY;
if (!KEY) throw new Error('N8N_API_KEY not set in environment');

const SHEETS_CRED = { id: 'eo7uMjjFUzvjTAGi', name: 'Google Sheets account' };
const PG_CRED = { id: 'NVJk0SsDUL8En4zV', name: 'Postgres account' };
const SPREADSHEET_ID = '16vNm0PPxV-OP1Kp_INOKiBz33YcL-ZkowAyRw7HnwcI';

async function api(method, p, body) {
  const r = await fetch(`${BASE}/api/v1${p}`, {
    method,
    headers: { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${method} ${p} -> ${r.status}: ${await r.text()}`);
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

function sheetsGet(name, tab) {
  return {
    id: `http_${tab}`,
    name,
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [0, 0],
    parameters: {
      method: 'GET',
      url: `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${tab}!A:Z?valueRenderOption=UNFORMATTED_VALUE`,
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googleSheetsOAuth2Api',
      options: {},
    },
    credentials: { googleSheetsOAuth2Api: SHEETS_CRED },
  };
}

// Builds the Code node that turns Sheet rows into a single INSERT statement.
function buildSql(name, id, table, cols, conflictCol) {
  const fieldList = cols.map((c) => c.col).join(', ');
  const rowExpr = cols
    .map((c) => {
      const fn = c.type === 'numberNotNull' ? 'escNumNotNull' : c.type === 'number' ? 'escNum' : c.type === 'date' ? 'escDate' : 'escText';
      return `${fn}(r[idx(${JSON.stringify(c.col)})])`;
    })
    .join(', ');
  const conflict = conflictCol ? ` ON CONFLICT (${conflictCol}) DO NOTHING` : '';
  const jsCode = `
const values = $input.first().json.values || [];
const headers = values[0] || [];
const rows = values.slice(1).filter(r => r && r.length > 0);
const idx = (n) => headers.indexOf(n);
const escText = (v) => (v === undefined || v === null || v === '') ? 'NULL' : "'" + String(v).replace(/'/g, "''") + "'";
const escNum = (v) => (v === undefined || v === null || v === '') ? 'NULL' : Number(v);
const escNumNotNull = (v) => (v === undefined || v === null || v === '') ? 0 : Number(v);
const escDate = (v) => (v === undefined || v === null || v === '') ? 'NULL' : "'" + String(v) + "'";
const lines = rows.map(r => '(' + [${rowExpr}].join(', ') + ')');
const query = rows.length ? "INSERT INTO ${table} (${fieldList}) VALUES " + lines.join(', ') + "${conflict};" : "SELECT 1;";
return [{ json: { query, count: rows.length } }];
`.trim();
  return {
    id,
    name,
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [0, 0],
    parameters: { jsCode },
  };
}

function pgExec(name, id) {
  return {
    id,
    name,
    type: 'n8n-nodes-base.postgres',
    typeVersion: 2.5,
    position: [0, 0],
    parameters: { operation: 'executeQuery', query: '={{ $json.query }}', options: {} },
    credentials: { postgres: PG_CRED },
  };
}

const tables = [
  { tab: 'Accounts', table: 'accounts', conflict: 'account_name', cols: [
    { col: 'account_name', type: 'text' }, { col: 'starting_balance', type: 'numberNotNull' },
  ]},
  { tab: 'Categories', table: 'categories', conflict: 'name', cols: [
    { col: 'name', type: 'text' }, { col: 'type', type: 'text' }, { col: 'color', type: 'text' },
  ]},
  { tab: 'Goals', table: 'goals', conflict: null, cols: [
    { col: 'goal_name', type: 'text' }, { col: 'target_amount', type: 'numberNotNull' },
    { col: 'saved_so_far', type: 'numberNotNull' }, { col: 'monthly_contribution', type: 'numberNotNull' },
    { col: 'priority', type: 'text' },
  ]},
  { tab: 'Assets', table: 'assets', conflict: null, cols: [
    { col: 'asset_name', type: 'text' }, { col: 'type', type: 'text' }, { col: 'value', type: 'numberNotNull' },
    { col: 'institution', type: 'text' }, { col: 'start_date', type: 'date' },
    { col: 'maturity_date', type: 'date' }, { col: 'interest_rate', type: 'number' }, { col: 'notes', type: 'text' },
  ]},
  { tab: 'Transactions', table: 'transactions', conflict: null, cols: [
    { col: 'date', type: 'date' }, { col: 'type', type: 'text' }, { col: 'category', type: 'text' },
    { col: 'payee', type: 'text' }, { col: 'amount', type: 'numberNotNull' }, { col: 'account', type: 'text' },
    { col: 'note', type: 'text' },
  ]},
];

const nodes = [];
const connections = {};
let prevName = 'Migrate Trigger';

nodes.push({
  id: 'wh1',
  name: prevName,
  type: 'n8n-nodes-base.webhook',
  typeVersion: 2,
  position: [0, 0],
  parameters: { httpMethod: 'GET', path: 'migrate-finance-os-onetime', responseMode: 'responseNode', options: {} },
  webhookId: 'migrate-finance-os-onetime-id',
});

function chain(node) {
  connections[prevName] = { main: [[{ node: node.name, type: 'main', index: 0 }]] };
  nodes.push(node);
  prevName = node.name;
}

for (const t of tables) {
  chain(sheetsGet(`Get ${t.tab} Tab`, t.tab));
  chain(buildSql(`Build ${t.tab} Insert SQL`, `code_${t.tab}`, t.table, t.cols, t.conflict));
  chain(pgExec(`Insert ${t.tab}`, `pg_${t.tab}`));
}

chain(pgExec('Verify Row Counts', 'pg_verify'));
nodes[nodes.length - 1].parameters.query =
  "SELECT (SELECT COUNT(*) FROM accounts) AS accounts, (SELECT COUNT(*) FROM categories) AS categories, (SELECT COUNT(*) FROM goals) AS goals, (SELECT COUNT(*) FROM assets) AS assets, (SELECT COUNT(*) FROM transactions) AS transactions;";

chain({
  id: 'resp1',
  name: 'Respond With Counts',
  type: 'n8n-nodes-base.respondToWebhook',
  typeVersion: 1.1,
  position: [0, 0],
  parameters: { respondWith: 'json', responseBody: '={{ JSON.stringify($json) }}', options: {} },
});

// lay out positions left to right so it's readable if opened in the editor
nodes.forEach((n, i) => { n.position = [i * 220, 0]; });

(async () => {
  console.log('Creating temporary migration workflow...');
  const wf = await api('POST', '/workflows', {
    name: 'migrate-to-postgres-onetime',
    nodes,
    connections,
    settings: { executionOrder: 'v1' },
  });
  console.log('Created workflow id:', wf.id);

  await api('POST', `/workflows/${wf.id}/activate`);
  console.log('Activated. Calling webhook...');

  const res = await fetch(`${BASE}/webhook/migrate-finance-os-onetime`);
  const bodyText = await res.text();
  console.log('Webhook response status:', res.status);
  console.log('Webhook response body:', bodyText);

  await api('POST', `/workflows/${wf.id}/deactivate`);

  // Inspect the real execution record before deciding whether to delete the workflow.
  const execs = await api('GET', `/executions?workflowId=${wf.id}&limit=1&includeData=true`);
  const exec = execs && execs.data && execs.data[0];
  if (exec) {
    console.log('Execution status:', exec.status);
    const runData = exec.data && exec.data.resultData && exec.data.resultData.runData;
    if (runData) {
      for (const nodeName of Object.keys(runData)) {
        const run = runData[nodeName][0];
        const err = run.error ? `ERROR: ${run.error.message}` : 'ok';
        console.log(`  ${nodeName}: ${err}`);
      }
    }
  } else {
    console.log('No execution record found for this workflow.');
  }

  if (exec && exec.status === 'success') {
    await api('DELETE', `/workflows/${wf.id}`);
    console.log('Workflow succeeded, deleted.');
  } else {
    console.log(`Workflow left in place for inspection: id ${wf.id} (still deactivated).`);
  }
})().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
