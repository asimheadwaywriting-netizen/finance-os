#!/usr/bin/env node
/**
 * Milestone 5 deploy script (Claude Code half).
 *
 * 1. Creates + activates Workflow 2 (transaction-logger):
 *    POST webhook -> validate (incl. payee) -> append to Transactions tab -> respond.
 * 2. Tests the live webhook: valid transaction appends a row (verified via the
 *    dashboard aggregator webhook), invalid payload returns 400.
 * 3. Cleans up the test row with a temporary helper workflow (deletes the last
 *    row of the Transactions tab), then verifies it is gone.
 * 4. Exports the workflow JSON to this folder.
 *
 * Reads N8N_API_URL / N8N_API_KEY from Claude Code settings — never hardcoded.
 *
 * Usage: node deploy-milestone5.js
 */

const fs = require('fs');
const path = require('path');

const settings = JSON.parse(
  fs.readFileSync('C:/Users/User/.claude/settings.json', 'utf8')
);
const { N8N_API_URL: BASE, N8N_API_KEY: KEY } =
  settings.mcpServers['n8n-mcp'].env;

const SHEETS_CRED = { id: 'eo7uMjjFUzvjTAGi', name: 'Google Sheets account' };
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

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function callWebhook(method, p, body, attempts = 4) {
  let last;
  for (let i = 0; i < attempts; i++) {
    await sleep(2000);
    try {
      const r = await fetch(`${BASE}/webhook/${p}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await r.text();
      let json = null;
      try { json = JSON.parse(text); } catch {}
      return { status: r.status, json, text };
    } catch (e) {
      last = e;
      console.log(`  webhook attempt ${i + 1} failed: ${e.message}`);
    }
  }
  throw last;
}

// ---------------------------------------------------------------------------
// Validation code (runs inside Workflow 2's Code node)
// ---------------------------------------------------------------------------
const VALIDATE_CODE = `
const b = $json.body || {};
const errors = [];
const required = ['date', 'type', 'category', 'payee', 'amount', 'account'];
for (const f of required) {
  if (b[f] === undefined || b[f] === null || b[f] === '') errors.push('missing field: ' + f);
}
if (errors.length === 0) {
  if (b.type !== 'Income' && b.type !== 'Expense') errors.push('type must be Income or Expense');
  const amt = Number(b.amount);
  if (!isFinite(amt) || amt <= 0) errors.push('amount must be a positive number');
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(String(b.date))) errors.push('date must be YYYY-MM-DD');
}
const tx = {
  date: String(b.date || ''),
  type: String(b.type || ''),
  category: String(b.category || ''),
  payee: String(b.payee || ''),
  amount: Number(b.amount) || 0,
  account: String(b.account || ''),
  note: String(b.note || '')
};
return [{ json: { valid: errors.length === 0, errors: errors, tx: tx } }];
`.trim();

// ---------------------------------------------------------------------------
// Workflow 2: transaction-logger
// ---------------------------------------------------------------------------
function transactionLoggerWorkflow() {
  const appendUrl =
    'https://sheets.googleapis.com/v4/spreadsheets/' +
    SPREADSHEET_ID +
    '/values/Transactions!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS';
  return {
    name: 'transaction-logger',
    settings: { executionOrder: 'v1', timezone: 'Asia/Dhaka' },
    nodes: [
      {
        id: 'note1',
        name: 'Overview',
        type: 'n8n-nodes-base.stickyNote',
        typeVersion: 1,
        position: [-80, -280],
        parameters: {
          content:
            '## Transaction Logger (Workflow 2)\nCalled by the dashboard via POST /api/transactions. Validates the transaction (all fields incl. payee, positive amount, YYYY-MM-DD date) and appends it to the Transactions tab of the Finance OS Google Sheet.\n\nInvalid payloads get a 400 with the list of problems — nothing is written.',
          height: 240,
          width: 520,
          color: 4,
        },
      },
      {
        id: 'wh1',
        name: 'New Transaction Request',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 2,
        position: [0, 0],
        parameters: {
          httpMethod: 'POST',
          path: 'finance-transaction',
          responseMode: 'responseNode',
          options: {},
        },
      },
      {
        id: 'code1',
        name: 'Validate Transaction',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [220, 0],
        parameters: { jsCode: VALIDATE_CODE },
      },
      {
        id: 'if1',
        name: 'Is Valid?',
        type: 'n8n-nodes-base.if',
        typeVersion: 2,
        position: [440, 0],
        parameters: {
          conditions: {
            options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
            conditions: [
              {
                id: 'c1',
                leftValue: '={{ $json.valid }}',
                rightValue: '',
                operator: { type: 'boolean', operation: 'true', singleValue: true },
              },
            ],
            combinator: 'and',
          },
          options: {},
        },
      },
      {
        id: 'http1',
        name: 'Append to Transactions Tab',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4.2,
        position: [660, -100],
        parameters: {
          method: 'POST',
          url: appendUrl,
          authentication: 'predefinedCredentialType',
          nodeCredentialType: 'googleSheetsOAuth2Api',
          sendBody: true,
          specifyBody: 'json',
          jsonBody:
            '={{ JSON.stringify({ values: [[ $json.tx.date, $json.tx.type, $json.tx.category, $json.tx.payee, $json.tx.amount, $json.tx.account, $json.tx.note ]] }) }}',
          options: {},
        },
        credentials: { googleSheetsOAuth2Api: SHEETS_CRED },
      },
      {
        id: 'resp1',
        name: 'Respond Success',
        type: 'n8n-nodes-base.respondToWebhook',
        typeVersion: 1.1,
        position: [880, -100],
        parameters: {
          respondWith: 'json',
          responseBody:
            "={{ JSON.stringify({ success: true, transaction: $('Validate Transaction').first().json.tx }) }}",
          options: {},
        },
      },
      {
        id: 'resp2',
        name: 'Respond Validation Error',
        type: 'n8n-nodes-base.respondToWebhook',
        typeVersion: 1.1,
        position: [660, 120],
        parameters: {
          respondWith: 'json',
          responseBody:
            '={{ JSON.stringify({ success: false, error: $json.errors.join("; ") }) }}',
          options: { responseCode: 400 },
        },
      },
    ],
    connections: {
      'New Transaction Request': {
        main: [[{ node: 'Validate Transaction', type: 'main', index: 0 }]],
      },
      'Validate Transaction': {
        main: [[{ node: 'Is Valid?', type: 'main', index: 0 }]],
      },
      'Is Valid?': {
        main: [
          [{ node: 'Append to Transactions Tab', type: 'main', index: 0 }],
          [{ node: 'Respond Validation Error', type: 'main', index: 0 }],
        ],
      },
      'Append to Transactions Tab': {
        main: [[{ node: 'Respond Success', type: 'main', index: 0 }]],
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Temporary cleanup helper: deletes the LAST row of the Transactions tab
// ---------------------------------------------------------------------------
const CLEANUP_CODE = `
const meta = $('Get Sheet Meta').first().json;
const sheet = (meta.sheets || []).find(function (s) { return s.properties.title === 'Transactions'; });
if (!sheet) throw new Error('Transactions sheet not found');
const rows = ($json.values || []).length;
if (rows < 2) throw new Error('refusing to delete header row');
return [{ json: { body: { requests: [{ deleteDimension: { range: {
  sheetId: sheet.properties.sheetId, dimension: 'ROWS', startIndex: rows - 1, endIndex: rows
} } }] } } }];
`.trim();

function cleanupWorkflow() {
  const base = 'https://sheets.googleapis.com/v4/spreadsheets/' + SPREADSHEET_ID;
  const http = (id, name, pos, params) => ({
    id, name,
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: pos,
    parameters: {
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googleSheetsOAuth2Api',
      options: {},
      ...params,
    },
    credentials: { googleSheetsOAuth2Api: SHEETS_CRED },
  });
  return {
    name: 'Finance OS - Delete Last Transaction Row (temporary)',
    settings: { executionOrder: 'v1', timezone: 'Asia/Dhaka' },
    nodes: [
      {
        id: 'wh1', name: 'Cleanup Trigger', type: 'n8n-nodes-base.webhook', typeVersion: 2,
        position: [0, 0],
        parameters: { httpMethod: 'POST', path: 'finance-os-cleanup', responseMode: 'responseNode', options: {} },
      },
      http('http1', 'Get Sheet Meta', [220, 0], { url: base + '?fields=sheets.properties' }),
      http('http2', 'Get Row Count', [440, 0], { url: base + '/values/Transactions!A:A' }),
      {
        id: 'code1', name: 'Build Delete Request', type: 'n8n-nodes-base.code', typeVersion: 2,
        position: [660, 0], parameters: { jsCode: CLEANUP_CODE },
      },
      http('http3', 'Delete Last Row', [880, 0], {
        method: 'POST',
        url: base + ':batchUpdate',
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify($json.body) }}',
      }),
      {
        id: 'resp1', name: 'Respond Done', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1,
        position: [1100, 0], parameters: { options: {} },
      },
    ],
    connections: {
      'Cleanup Trigger': { main: [[{ node: 'Get Sheet Meta', type: 'main', index: 0 }]] },
      'Get Sheet Meta': { main: [[{ node: 'Get Row Count', type: 'main', index: 0 }]] },
      'Get Row Count': { main: [[{ node: 'Build Delete Request', type: 'main', index: 0 }]] },
      'Build Delete Request': { main: [[{ node: 'Delete Last Row', type: 'main', index: 0 }]] },
      'Delete Last Row': { main: [[{ node: 'Respond Done', type: 'main', index: 0 }]] },
    },
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const TEST_TX = {
  date: '2026-06-12',
  type: 'Expense',
  category: 'Miscellaneous',
  payee: 'M5-TEST-ROW',
  amount: 10,
  account: 'Cash',
  note: 'deploy-milestone5 test row - safe to delete',
};

async function dashboardHasPayee(payee) {
  const r = await callWebhook('GET', 'finance-dashboard');
  return (r.json.recentTransactions || []).some((t) => t.payee === payee);
}

async function main() {
  console.log('STEP 1: creating transaction-logger workflow...');
  const wf = await api('POST', '/workflows', transactionLoggerWorkflow());
  console.log(`  created workflow ${wf.id}`);
  await api('POST', `/workflows/${wf.id}/activate`);
  console.log('  activated');

  console.log('STEP 2: testing INVALID payload (missing amount) -> expect 400...');
  const bad = await callWebhook('POST', 'finance-transaction', {
    date: '2026-06-12', type: 'Expense', category: 'Groceries',
    payee: 'x', account: 'Cash',
  });
  console.log(`  status=${bad.status} body=${bad.text}`);
  if (bad.status !== 400) throw new Error('expected 400 for invalid payload');

  console.log('STEP 3: testing VALID payload -> expect 200 + row in Sheet...');
  const good = await callWebhook('POST', 'finance-transaction', TEST_TX);
  console.log(`  status=${good.status} body=${good.text}`);
  if (good.status !== 200 || !good.json.success) throw new Error('valid payload did not succeed');

  if (!(await dashboardHasPayee(TEST_TX.payee))) {
    throw new Error('test row not visible via dashboard webhook');
  }
  console.log('  confirmed: test row visible via dashboard aggregator');

  console.log('STEP 4: cleaning up test row via temporary helper...');
  const helper = await api('POST', '/workflows', cleanupWorkflow());
  try {
    await api('POST', `/workflows/${helper.id}/activate`);
    const del = await callWebhook('POST', 'finance-os-cleanup');
    console.log(`  cleanup status=${del.status}`);
  } finally {
    await api('DELETE', `/workflows/${helper.id}`);
    console.log('  helper workflow deleted');
  }
  if (await dashboardHasPayee(TEST_TX.payee)) {
    throw new Error('test row still present after cleanup');
  }
  console.log('  confirmed: test row removed');

  const exported = await api('GET', `/workflows/${wf.id}`);
  fs.writeFileSync(
    path.join(__dirname, 'transaction-logger.json'),
    JSON.stringify(exported, null, 2)
  );

  console.log('\n=== MILESTONE 5 (n8n half) DEPLOY OK ===');
  console.log(`workflow id : ${wf.id}`);
  console.log(`webhook URL : ${BASE}/webhook/finance-transaction`);
}

main().catch((e) => {
  console.error('\nDEPLOY FAILED:', e.message);
  process.exit(1);
});
