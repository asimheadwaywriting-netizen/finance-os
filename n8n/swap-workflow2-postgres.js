#!/usr/bin/env node
/**
 * Swaps Workflow 2 (transaction-logger) from Google Sheets to Postgres.
 * Inserts a "Build Insert SQL" Code node before the Postgres write, using
 * the same escText/escNum string-escaping already proven in the migration
 * script (avoids guessing at the Postgres node's parameterized-query field
 * names for a live, user-input-driven write path).
 */
const BASE = 'https://asim.sg-node8n.serverdoor.com';
const KEY = process.env.N8N_API_KEY;
if (!KEY) throw new Error('N8N_API_KEY not set in environment');
const WF2_ID = 'WwmlYYISq5buXPYx';
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

const buildSqlCode = `
const t = $json.tx;
const escText = (v) => (v === undefined || v === null || v === '') ? 'NULL' : "'" + String(v).replace(/'/g, "''") + "'";
const escNum = (v) => (v === undefined || v === null || v === '') ? 0 : Number(v);
const query = "INSERT INTO transactions (date, type, category, payee, amount, account, note) VALUES (" +
  escText(t.date) + ", " + escText(t.type) + ", " + escText(t.category) + ", " + escText(t.payee) + ", " +
  escNum(t.amount) + ", " + escText(t.account) + ", " + escText(t.note) + ");";
return [{ json: { query } }];
`.trim();

const nodes = [
  {
    id: 'note1', name: 'Overview', type: 'n8n-nodes-base.stickyNote', typeVersion: 1, position: [-80, -280],
    parameters: {
      content: '## Transaction Logger (Workflow 2)\nCalled by the dashboard via POST /api/transactions. Validates the transaction (all fields incl. payee, positive amount, YYYY-MM-DD date) and inserts it into the Postgres transactions table.\n\nInvalid payloads get a 400 with the list of problems — nothing is written.',
      height: 240, width: 520, color: 4,
    },
  },
  {
    id: 'wh1', name: 'New Transaction Request', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, 0],
    parameters: { httpMethod: 'POST', path: 'finance-transaction', responseMode: 'responseNode', options: {} },
    webhookId: '596f6dcb-98d4-41ec-9cad-bdcfc86c12e7',
  },
  {
    id: 'code1', name: 'Validate Transaction', type: 'n8n-nodes-base.code', typeVersion: 2, position: [220, 0],
    parameters: {
      jsCode: "const b = $json.body || {};\nconst errors = [];\nconst required = ['date', 'type', 'category', 'payee', 'amount', 'account'];\nfor (const f of required) {\n  if (b[f] === undefined || b[f] === null || b[f] === '') errors.push('missing field: ' + f);\n}\nif (errors.length === 0) {\n  if (b.type !== 'Income' && b.type !== 'Expense') errors.push('type must be Income or Expense');\n  const amt = Number(b.amount);\n  if (!isFinite(amt) || amt <= 0) errors.push('amount must be a positive number');\n  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(String(b.date))) errors.push('date must be YYYY-MM-DD');\n}\nconst tx = {\n  date: String(b.date || ''),\n  type: String(b.type || ''),\n  category: String(b.category || ''),\n  payee: String(b.payee || ''),\n  amount: Number(b.amount) || 0,\n  account: String(b.account || ''),\n  note: String(b.note || '')\n};\nreturn [{ json: { valid: errors.length === 0, errors: errors, tx: tx } }];",
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
    id: 'codesql1', name: 'Build Insert SQL', type: 'n8n-nodes-base.code', typeVersion: 2, position: [660, -100],
    parameters: { jsCode: buildSqlCode },
  },
  {
    id: 'pg1', name: 'Insert Transaction', type: 'n8n-nodes-base.postgres', typeVersion: 2.5, position: [880, -100],
    parameters: { operation: 'executeQuery', query: '={{ $json.query }}', options: {} },
    credentials: { postgres: PG_CRED },
  },
  {
    id: 'resp1', name: 'Respond Success', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [1100, -100],
    parameters: { respondWith: 'json', responseBody: '={{ JSON.stringify({ success: true, transaction: $(\'Validate Transaction\').first().json.tx }) }}', options: {} },
  },
  {
    id: 'resp2', name: 'Respond Validation Error', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [660, 120],
    parameters: { respondWith: 'json', responseBody: '={{ JSON.stringify({ success: false, error: $json.errors.join("; ") }) }}', options: { responseCode: 400 } },
  },
];

const connections = {
  'New Transaction Request': { main: [[{ node: 'Validate Transaction', type: 'main', index: 0 }]] },
  'Validate Transaction': { main: [[{ node: 'Is Valid?', type: 'main', index: 0 }]] },
  'Is Valid?': { main: [[{ node: 'Build Insert SQL', type: 'main', index: 0 }], [{ node: 'Respond Validation Error', type: 'main', index: 0 }]] },
  'Build Insert SQL': { main: [[{ node: 'Insert Transaction', type: 'main', index: 0 }]] },
  'Insert Transaction': { main: [[{ node: 'Respond Success', type: 'main', index: 0 }]] },
};

(async () => {
  const before = await api('GET', `/workflows/${WF2_ID}`);
  console.log('Current workflow active:', before.active);

  await api('PUT', `/workflows/${WF2_ID}`, { name: before.name, nodes, connections, settings: before.settings });
  console.log('Updated workflow 2 to use Postgres.');

  const after = await api('GET', `/workflows/${WF2_ID}`);
  if (!after.active) {
    await api('POST', `/workflows/${WF2_ID}/activate`);
    console.log('Re-activated.');
  } else {
    console.log('Still active.');
  }

  console.log('Testing with an invalid payload (should 400, nothing written)...');
  const badRes = await fetch(`${BASE}/webhook/finance-transaction`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: '2026-06-20' }),
  });
  console.log('Invalid payload status:', badRes.status, await badRes.text());

  console.log('Testing with a valid payload (should insert + return success)...');
  const goodRes = await fetch(`${BASE}/webhook/finance-transaction`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: '2026-06-20', type: 'Expense', category: 'Miscellaneous', payee: 'postgres-swap-test', amount: 1, account: 'Cash', note: 'temporary test row, will be deleted' }),
  });
  console.log('Valid payload status:', goodRes.status, await goodRes.text());
})().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
