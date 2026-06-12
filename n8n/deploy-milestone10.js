#!/usr/bin/env node
/**
 * Milestone 10 — production readiness + end-to-end smoke test.
 *
 * 1. Wires the global error handler (Error Trigger -> Gmail) into Workflows
 *    1-3 via settings.errorWorkflow (4-7 already have it from M9).
 * 2. Smoke tests against PRODUCTION (Vercel URL):
 *      - GET  /api/dashboard            -> real data
 *      - POST /api/transactions invalid -> 400 (validation holds)
 *      - POST /api/transactions valid   -> row visible via aggregator
 *      - POST /api/chat question        -> correct biggest-expense answer
 *      - POST /api/chat log command     -> logged + confirmation email
 *      - WF4 manual trigger             -> weekly summary email
 *    Test rows are cleaned up afterwards (temp helper workflow, M5 pattern).
 *
 * Reads N8N_API_URL / N8N_API_KEY from Claude Code settings — never hardcoded.
 * Usage: node deploy-milestone10.js
 */

const fs = require('fs');

const settings = JSON.parse(
  fs.readFileSync('C:/Users/User/.claude/settings.json', 'utf8')
);
const { N8N_API_URL: BASE, N8N_API_KEY: KEY } =
  settings.mcpServers['n8n-mcp'].env;

const PROD = 'https://finance-os-eight-delta.vercel.app';
const ERROR_HANDLER_ID = '17zUtE9de19ejvvA';
const CORE_WORKFLOWS = [
  { id: '8GejOtDtsht0CfEJ', name: 'finance-data-aggregator' },
  { id: 'WwmlYYISq5buXPYx', name: 'transaction-logger' },
  { id: '5RkSgctHtRNq3mIR', name: 'ai-chat-handler' },
];
const WF4_ID_NAME = 'weekly-safe-to-spend-alert';
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

async function http(method, url, body) {
  const r = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, text };
}

async function dashboardHasPayee(payee) {
  const r = await http('GET', `${BASE}/webhook/finance-dashboard`);
  return (r.json.recentTransactions || []).some((t) => t.payee === payee);
}

// Temp cleanup helper (M5 pattern): deletes the LAST row of Transactions, N times
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
  const h = (id, name, pos, params) => ({
    id, name, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: pos,
    parameters: {
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googleSheetsOAuth2Api',
      options: {}, ...params,
    },
    credentials: { googleSheetsOAuth2Api: SHEETS_CRED },
  });
  return {
    name: 'Finance OS - Delete Last Transaction Row (temporary M10)',
    settings: { executionOrder: 'v1', timezone: 'Asia/Dhaka' },
    nodes: [
      {
        id: 'wh1', name: 'Cleanup Trigger', type: 'n8n-nodes-base.webhook', typeVersion: 2,
        position: [0, 0],
        parameters: { httpMethod: 'POST', path: 'finance-os-cleanup-m10', responseMode: 'responseNode', options: {} },
      },
      h('http1', 'Get Sheet Meta', [220, 0], { url: base + '?fields=sheets.properties' }),
      h('http2', 'Get Row Count', [440, 0], { url: base + '/values/Transactions!A:A' }),
      {
        id: 'code1', name: 'Build Delete Request', type: 'n8n-nodes-base.code', typeVersion: 2,
        position: [660, 0], parameters: { jsCode: CLEANUP_CODE },
      },
      h('http3', 'Delete Last Row', [880, 0], {
        method: 'POST', url: base + ':batchUpdate', sendBody: true, specifyBody: 'json',
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

const today = new Date().toISOString().slice(0, 10);

async function main() {
  const results = [];
  const ok = (name, pass, detail) => {
    results.push({ name, pass, detail });
    console.log(`  ${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' (' + detail + ')' : ''}`);
    if (!pass) throw new Error(`smoke test failed: ${name}`);
  };

  console.log('STEP 1: wiring global error handler into Workflows 1-3...');
  for (const { id, name } of CORE_WORKFLOWS) {
    const wf = await api('GET', `/workflows/${id}`);
    if ((wf.settings || {}).errorWorkflow === ERROR_HANDLER_ID) {
      console.log(`  ${name}: already set`);
      continue;
    }
    await api('PUT', `/workflows/${id}`, {
      name: wf.name,
      nodes: wf.nodes,
      connections: wf.connections,
      settings: { ...wf.settings, errorWorkflow: ERROR_HANDLER_ID },
    });
    const after = await api('GET', `/workflows/${id}`);
    if (!after.active) await api('POST', `/workflows/${id}/activate`);
    console.log(`  ${name}: errorWorkflow set, active=${(await api('GET', `/workflows/${id}`)).active}`);
  }

  console.log('\nSTEP 2: production smoke tests...');

  // 2a. Dashboard real data
  const dash = await http('GET', `${PROD}/api/dashboard`);
  ok('dashboard loads with real data',
    dash.status === 200 && dash.json && typeof dash.json.metrics.income === 'number' && dash.json.accountBalances.length > 0,
    `income=${dash.json && dash.json.metrics.income}`);

  // 2b. Invalid transaction rejected
  const bad = await http('POST', `${PROD}/api/transactions`, {
    date: today, type: 'Expense', category: 'Groceries', payee: 'x', account: 'Cash',
  });
  ok('invalid transaction -> 400', bad.status === 400, `status=${bad.status}`);

  // 2c. Valid transaction via the same API the form uses
  const tx = {
    date: today, type: 'Expense', category: 'Miscellaneous', payee: 'M10-TEST-ROW',
    amount: 10, account: 'Cash', note: 'deploy-milestone10 smoke test, safe to delete',
  };
  const good = await http('POST', `${PROD}/api/transactions`, tx);
  ok('form transaction -> 200 success', good.status === 200 && good.json.success === true);
  await sleep(2000);
  ok('form transaction visible in Sheet (via aggregator)', await dashboardHasPayee('M10-TEST-ROW'));

  // 2d. Chat question
  const q = await http('POST', `${PROD}/api/chat`, {
    message: "What's my biggest expense this month?", history: [],
  });
  ok('chat answers biggest expense', q.status === 200 && /rent/i.test(q.json.reply) && /18,?000/.test(q.json.reply),
    `reply="${q.json && q.json.reply}"`);

  // 2e. Chat logs a transaction (+ confirmation email fires)
  const log = await http('POST', `${PROD}/api/chat`, {
    message: 'Log 500 taka transport expense on bKash today. Payee is M10-CHAT-TEST, note: smoke test, safe to delete.',
    history: [],
  });
  ok('chat log command -> Logged reply', log.status === 200 && log.json.action === 'log_transaction' && /^Logged:/.test(log.json.reply),
    `reply="${log.json && log.json.reply}"`);
  await sleep(2000);
  ok('chat-logged row visible in Sheet', await dashboardHasPayee('M10-CHAT-TEST'));

  // 2f. Manual trigger of Workflow 4 (re-attach temp webhook, fire, detach)
  console.log('  manually triggering Workflow 4...');
  const list = await api('GET', '/workflows?limit=250');
  const wf4meta = (list.data || []).find((w) => w.name === WF4_ID_NAME);
  const wf4 = await api('GET', `/workflows/${wf4meta.id}`);
  const trigNode = {
    id: 'whtmp', name: 'Manual Test Trigger', type: 'n8n-nodes-base.webhook', typeVersion: 2,
    position: [0, 180],
    parameters: { httpMethod: 'GET', path: 'finance-m10-wf4-test', options: {} },
  };
  await api('PUT', `/workflows/${wf4meta.id}`, {
    name: wf4.name,
    nodes: [...wf4.nodes, trigNode],
    connections: { ...wf4.connections, 'Manual Test Trigger': { main: [[{ node: 'Fetch Dashboard Data', type: 'main', index: 0 }]] } },
    settings: wf4.settings,
  });
  if (!(await api('GET', `/workflows/${wf4meta.id}`)).active) await api('POST', `/workflows/${wf4meta.id}/activate`);
  await sleep(3000);
  const wf4fire = await http('GET', `${BASE}/webhook/finance-m10-wf4-test`);
  ok('Workflow 4 manual trigger -> 200', wf4fire.status === 200, `status=${wf4fire.status}`);
  await api('PUT', `/workflows/${wf4meta.id}`, {
    name: wf4.name, nodes: wf4.nodes, connections: wf4.connections, settings: wf4.settings,
  });
  if (!(await api('GET', `/workflows/${wf4meta.id}`)).active) await api('POST', `/workflows/${wf4meta.id}/activate`);
  console.log('  Workflow 4 test trigger removed again');

  // STEP 3: clean up the two test rows (delete last row twice)
  console.log('\nSTEP 3: cleaning up the 2 test rows...');
  const helper = await api('POST', '/workflows', cleanupWorkflow());
  await api('POST', `/workflows/${helper.id}/activate`);
  await sleep(3000);
  for (let i = 0; i < 2; i++) {
    const cl = await http('POST', `${BASE}/webhook/finance-os-cleanup-m10`);
    console.log(`  cleanup ${i + 1}: status=${cl.status}`);
    await sleep(1500);
  }
  await api('DELETE', `/workflows/${helper.id}`);
  const gone1 = !(await dashboardHasPayee('M10-TEST-ROW'));
  const gone2 = !(await dashboardHasPayee('M10-CHAT-TEST'));
  ok('test rows cleaned up', gone1 && gone2);

  console.log('\nALL SMOKE TESTS PASSED.');
  console.log('Still to verify by hand: chat confirmation email + WF4 weekly email in inbox.');
}

main().catch((e) => {
  console.error('\nFAILED:', e.message);
  process.exit(1);
});
