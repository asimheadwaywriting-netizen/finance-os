#!/usr/bin/env node
/**
 * Swaps Workflow 8 (record-remover) from Google Sheets to Postgres.
 * The original spreadsheet logic (Get Sheet Meta -> Read Tab -> Find Row by
 * scanning for a matching row -> deleteDimension by row index) collapses
 * into one SQL statement: delete the lowest-id row matching every `match`
 * field, wrapped in a CTE that always returns exactly one row (a count) so
 * the workflow never produces zero output items downstream.
 */
const BASE = 'https://asim.sg-node8n.serverdoor.com';
const KEY = process.env.N8N_API_KEY;
if (!KEY) throw new Error('N8N_API_KEY not set in environment');
const WF8_ID = 'XBpyHnVzjOHulNje';
const PG_CRED = { id: 'NVJk0SsDUL8En4zV', name: 'Postgres account' };

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

const buildDeleteSqlCode = `
const TABLE_MAP = { Transactions: 'transactions', Goals: 'goals', Assets: 'assets', Categories: 'categories', Budgets: 'budgets', Accounts: 'accounts' };
const tab = $json.tab;
const match = $json.match || {};
const table = TABLE_MAP[tab];
const escText = (v) => "'" + String(v == null ? '' : v).replace(/'/g, "''") + "'";
const keys = Object.keys(match);
if (!table) {
  return [{ json: { query: 'SELECT 0 AS deleted_count;', error: 'tab not found: ' + tab } }];
}
if (keys.length === 0) {
  return [{ json: { query: 'SELECT 0 AS deleted_count;', error: 'no match fields provided' } }];
}
const where = keys.map(function (k) {
  const v = match[k];
  if (k === 'amount') return 'amount = ' + Number(v);
  return k + ' = ' + escText(v);
}).join(' AND ');
const query = 'WITH deleted AS (DELETE FROM ' + table + ' WHERE id = (SELECT id FROM ' + table + ' WHERE ' + where + ' ORDER BY id ASC LIMIT 1) RETURNING id) SELECT COUNT(*) AS deleted_count FROM deleted;';
return [{ json: { query, error: 'row not found' } }];
`.trim();

const nodes = [
  {
    id: 'note1', name: 'Overview', type: 'n8n-nodes-base.stickyNote', typeVersion: 1, position: [-80, -260],
    parameters: {
      content: '## Record Remover (Workflow 8)\nPOST /finance-delete { tab, match }. Deletes the lowest-id row in the matching Postgres table where every field in `match` is equal. 400 if no row matches — nothing is deleted.\n\nTransactions match on all 7 fields; Goals on goal_name; Assets on asset_name.',
      height: 240, width: 540, color: 4,
    },
  },
  {
    id: 'wh1', name: 'Delete Request', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, 0],
    parameters: { httpMethod: 'POST', path: 'finance-delete', responseMode: 'responseNode', options: {} },
    webhookId: 'e5544460-e0e0-4f6b-93eb-533f6e7ad0ea',
  },
  {
    id: 'prep1', name: 'Prep Delete', type: 'n8n-nodes-base.code', typeVersion: 2, position: [220, 0],
    parameters: { jsCode: "const b = $json.body || {};\nreturn [{ json: { tab: String(b.tab || ''), match: b.match || {} } }];" },
  },
  {
    id: 'codesql1', name: 'Build Delete SQL', type: 'n8n-nodes-base.code', typeVersion: 2, position: [440, 0],
    parameters: { jsCode: buildDeleteSqlCode },
  },
  {
    id: 'pg1', name: 'Run Delete', type: 'n8n-nodes-base.postgres', typeVersion: 2.5, position: [660, 0],
    parameters: { operation: 'executeQuery', query: '={{ $json.query }}', options: {} },
    credentials: { postgres: PG_CRED },
  },
  {
    id: 'if1', name: 'Found?', type: 'n8n-nodes-base.if', typeVersion: 2, position: [880, 0],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{ id: 'c1', leftValue: '={{ Number($json.deleted_count) > 0 }}', rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and',
      },
      options: {},
    },
  },
  {
    id: 'resp1', name: 'Respond Deleted', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [1100, -120],
    parameters: { respondWith: 'json', responseBody: '={{ JSON.stringify({ success: true }) }}', options: {} },
  },
  {
    id: 'resp2', name: 'Respond Not Found', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [1100, 120],
    parameters: { respondWith: 'json', responseBody: '={{ JSON.stringify({ success: false, error: $("Build Delete SQL").first().json.error }) }}', options: { responseCode: 400 } },
  },
];

const connections = {
  'Delete Request': { main: [[{ node: 'Prep Delete', type: 'main', index: 0 }]] },
  'Prep Delete': { main: [[{ node: 'Build Delete SQL', type: 'main', index: 0 }]] },
  'Build Delete SQL': { main: [[{ node: 'Run Delete', type: 'main', index: 0 }]] },
  'Run Delete': { main: [[{ node: 'Found?', type: 'main', index: 0 }]] },
  'Found?': { main: [[{ node: 'Respond Deleted', type: 'main', index: 0 }], [{ node: 'Respond Not Found', type: 'main', index: 0 }]] },
};

(async () => {
  const before = await api('GET', `/workflows/${WF8_ID}`);
  console.log('Current workflow active:', before.active);

  await api('PUT', `/workflows/${WF8_ID}`, { name: before.name, nodes, connections, settings: before.settings });
  console.log('Updated workflow 8 to use Postgres.');

  const after = await api('GET', `/workflows/${WF8_ID}`);
  if (!after.active) {
    await api('POST', `/workflows/${WF8_ID}/activate`);
    console.log('Re-activated.');
  } else {
    console.log('Still active.');
  }

  console.log('Testing delete of a non-existent goal (should 400, not found)...');
  const notFoundRes = await fetch(`${BASE}/webhook/finance-delete`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tab: 'Goals', match: { goal_name: 'this-goal-does-not-exist' } }),
  });
  console.log('Status:', notFoundRes.status, await notFoundRes.text());
})().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
