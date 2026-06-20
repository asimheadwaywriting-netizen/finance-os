#!/usr/bin/env node
/**
 * Swaps Workflow 9 (record-creator) from Google Sheets to Postgres.
 * Validation logic is untouched. The Sheets append becomes a typed INSERT.
 * Categories/Accounts/Budgets have UNIQUE constraints in Postgres that the
 * Sheet never enforced, so duplicate-key inserts use ON CONFLICT DO NOTHING
 * + a count check, returning a clean 400 instead of crashing the workflow.
 */
const BASE = 'https://asim.sg-node8n.serverdoor.com';
const KEY = process.env.N8N_API_KEY;
if (!KEY) throw new Error('N8N_API_KEY not set in environment');
const WF9_ID = 'uwl7mHJ8oBzvraqb';
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

const buildInsertSqlCode = `
const TABLES = {
  Goals: { table: 'goals', cols: ['goal_name','target_amount','saved_so_far','monthly_contribution','priority'], types: ['text','numNotNull','numNotNull','numNotNull','text'], conflict: null },
  Assets: { table: 'assets', cols: ['asset_name','type','value','institution','start_date','maturity_date','interest_rate','notes'], types: ['text','text','numNotNull','text','date','date','num','text'], conflict: null },
  Categories: { table: 'categories', cols: ['name','type','color'], types: ['text','text','text'], conflict: 'name' },
  Accounts: { table: 'accounts', cols: ['account_name','starting_balance','as_of_date'], types: ['text','numNotNull','date'], conflict: 'account_name' },
  Budgets: { table: 'budgets', cols: ['category','monthly_limit'], types: ['text','numNotNull'], conflict: 'category' },
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
const conflictClause = def.conflict ? (' ON CONFLICT (' + def.conflict + ') DO NOTHING') : '';
const query = 'WITH ins AS (INSERT INTO ' + def.table + ' (' + def.cols.join(', ') + ') VALUES (' + rendered + ')' + conflictClause + ' RETURNING id) SELECT COUNT(*) AS inserted_count FROM ins;';
return [{ json: { query } }];
`.trim();

const nodes = [
  {
    id: 'note1', name: 'Overview', type: 'n8n-nodes-base.stickyNote', typeVersion: 1, position: [-80, -260],
    parameters: {
      content: '## Record Creator (Workflow 9)\nPOST /finance-create { tab, values }. Validates the tab + value count, then inserts the row into the matching Postgres table. 400 + error list on invalid input or duplicate key — nothing is written.\n\nTransactions still use Workflow 2 (transaction-logger).',
      height: 240, width: 540, color: 4,
    },
  },
  {
    id: 'wh1', name: 'Create Request', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, 0],
    parameters: { httpMethod: 'POST', path: 'finance-create', responseMode: 'responseNode', options: {} },
    webhookId: '422fe268-02a0-4800-bf84-9dbb32e340d4',
  },
  {
    id: 'code1', name: 'Validate Create', type: 'n8n-nodes-base.code', typeVersion: 2, position: [220, 0],
    parameters: {
      jsCode: "const b = $json.body || {};\nconst tab = String(b.tab || '');\nconst values = Array.isArray(b.values) ? b.values : null;\nconst allowed = { Goals: 5, Assets: 8, Categories: 3, Accounts: 3, Budgets: 2 };\nconst errors = [];\nif (!allowed[tab]) errors.push('invalid tab: ' + tab);\nif (!values) errors.push('values must be an array');\nelse if (allowed[tab] && values.length !== allowed[tab]) errors.push('expected ' + allowed[tab] + ' values for ' + tab + ', got ' + values.length);\nelse if (values[0] === undefined || String(values[0]).trim() === '') errors.push('first column is required');\nreturn [{ json: { valid: errors.length === 0, errors: errors, tab: tab, values: values || [] } }];",
    },
  },
  {
    id: 'if1', name: 'Is Valid?', type: 'n8n-nodes-base.if', typeVersion: 2, position: [440, 0],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{ id: 'c1', leftValue: '={{ $json.valid }}', rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and',
      },
      options: {},
    },
  },
  {
    id: 'codesql1', name: 'Build Insert SQL', type: 'n8n-nodes-base.code', typeVersion: 2, position: [660, -120],
    parameters: { jsCode: buildInsertSqlCode },
  },
  {
    id: 'pg1', name: 'Run Insert', type: 'n8n-nodes-base.postgres', typeVersion: 2.5, position: [880, -120],
    parameters: { operation: 'executeQuery', query: '={{ $json.query }}', options: {} },
    credentials: { postgres: PG_CRED },
  },
  {
    id: 'if2', name: 'Inserted?', type: 'n8n-nodes-base.if', typeVersion: 2, position: [1100, -120],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{ id: 'c2', leftValue: '={{ Number($json.inserted_count) > 0 }}', rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and',
      },
      options: {},
    },
  },
  {
    id: 'resp1', name: 'Respond Created', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [1320, -200],
    parameters: { respondWith: 'json', responseBody: '={{ JSON.stringify({ success: true }) }}', options: {} },
  },
  {
    id: 'resp3', name: 'Respond Duplicate', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [1320, -40],
    parameters: { respondWith: 'json', responseBody: '={{ JSON.stringify({ success: false, error: "a record with that key already exists" }) }}', options: { responseCode: 400 } },
  },
  {
    id: 'resp2', name: 'Respond Invalid', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [660, 120],
    parameters: { respondWith: 'json', responseBody: "={{ JSON.stringify({ success: false, error: $json.errors.join('; ') }) }}", options: { responseCode: 400 } },
  },
];

const connections = {
  'Create Request': { main: [[{ node: 'Validate Create', type: 'main', index: 0 }]] },
  'Validate Create': { main: [[{ node: 'Is Valid?', type: 'main', index: 0 }]] },
  'Is Valid?': { main: [[{ node: 'Build Insert SQL', type: 'main', index: 0 }], [{ node: 'Respond Invalid', type: 'main', index: 0 }]] },
  'Build Insert SQL': { main: [[{ node: 'Run Insert', type: 'main', index: 0 }]] },
  'Run Insert': { main: [[{ node: 'Inserted?', type: 'main', index: 0 }]] },
  'Inserted?': { main: [[{ node: 'Respond Created', type: 'main', index: 0 }], [{ node: 'Respond Duplicate', type: 'main', index: 0 }]] },
};

(async () => {
  const before = await api('GET', `/workflows/${WF9_ID}`);
  console.log('Current workflow active:', before.active);

  await api('PUT', `/workflows/${WF9_ID}`, { name: before.name, nodes, connections, settings: before.settings });
  console.log('Updated workflow 9 to use Postgres.');

  const after = await api('GET', `/workflows/${WF9_ID}`);
  if (!after.active) {
    await api('POST', `/workflows/${WF9_ID}/activate`);
    console.log('Re-activated.');
  } else {
    console.log('Still active.');
  }

  console.log('Testing invalid input (wrong value count, should 400)...');
  const badRes = await fetch(`${BASE}/webhook/finance-create`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tab: 'Goals', values: ['too', 'few'] }),
  });
  console.log('Status:', badRes.status, await badRes.text());

  console.log('Testing valid goal creation...');
  const goodRes = await fetch(`${BASE}/webhook/finance-create`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tab: 'Goals', values: ['postgres-swap-test-goal', 100, 0, 0, 'Low'] }),
  });
  console.log('Status:', goodRes.status, await goodRes.text());

  console.log('Testing duplicate category (should 400, already exists)...');
  const dupRes = await fetch(`${BASE}/webhook/finance-create`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tab: 'Categories', values: ['Groceries', 'Expense', '#000000'] }),
  });
  console.log('Status:', dupRes.status, await dupRes.text());
})().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
