#!/usr/bin/env node
/**
 * Account baseline + floor-at-0.
 * 1. Adds an internal `as_of_date` column to the Accounts tab and sets it to TODAY
 *    for every existing account (via a temp helper workflow). Hidden plumbing.
 * 2. Patches Workflow 1 so each account balance = starting_balance + only the txns
 *    dated AFTER its as_of_date, clamped to >= 0 (past expenses become history-only).
 * 3. Patches Workflow 9 (record-creator) to allow the Accounts tab with 3 values.
 * Idempotent. Reads N8N creds from settings.
 */
const fs = require('fs');
const path = require('path');
const s = JSON.parse(fs.readFileSync('C:/Users/User/.claude/settings.json', 'utf8'));
const { N8N_API_URL: BASE, N8N_API_KEY: KEY } = s.mcpServers['n8n-mcp'].env;
const SPREADSHEET_ID = '16vNm0PPxV-OP1Kp_INOKiBz33YcL-ZkowAyRw7HnwcI';
const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets/' + SPREADSHEET_ID;
const SHEETS_CRED = { id: 'eo7uMjjFUzvjTAGi', name: 'Google Sheets account' };
const WF1_ID = '8GejOtDtsht0CfEJ';
const TODAY = new Date().toISOString().slice(0, 10);

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Temp workflow: read Accounts col A, write as_of_date header + TODAY for each data row.
const SETUP_CODE = `
const rows = ($json.values || []).length; // includes header row
const dataRows = Math.max(0, rows - 1);
const col = [['as_of_date']];
for (let i = 0; i < dataRows; i++) col.push(['${TODAY}']);
return [{ json: { body: { values: col } } }];
`.trim();

function setupWorkflow() {
  const sh = (id, name, pos, params) => ({
    id, name, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: pos,
    parameters: { authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', options: {}, ...params },
    credentials: { googleSheetsOAuth2Api: SHEETS_CRED },
  });
  return {
    name: 'Finance OS - Set Accounts as_of_date (temporary)',
    settings: { executionOrder: 'v1', timezone: 'Asia/Dhaka' },
    nodes: [
      { id: 'wh1', name: 'Trigger', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, 0], parameters: { httpMethod: 'POST', path: 'finance-set-asof', responseMode: 'responseNode', options: {} } },
      sh('h1', 'Read Accounts A', [220, 0], { url: SHEETS_BASE + '/values/Accounts!A:A' }),
      { id: 'c1', name: 'Build Column', type: 'n8n-nodes-base.code', typeVersion: 2, position: [440, 0], parameters: { jsCode: SETUP_CODE } },
      sh('h2', 'Write as_of_date', [660, 0], { method: 'PUT', url: SHEETS_BASE + '/values/Accounts!C1?valueInputOption=RAW', sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.body) }}' }),
      { id: 'r1', name: 'Done', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [880, 0], parameters: { respondWith: 'json', responseBody: '={{ JSON.stringify({ ok: true }) }}', options: {} } },
    ],
    connections: {
      'Trigger': { main: [[{ node: 'Read Accounts A', type: 'main', index: 0 }]] },
      'Read Accounts A': { main: [[{ node: 'Build Column', type: 'main', index: 0 }]] },
      'Build Column': { main: [[{ node: 'Write as_of_date', type: 'main', index: 0 }]] },
      'Write as_of_date': { main: [[{ node: 'Done', type: 'main', index: 0 }]] },
    },
  };
}

const OLD_BAL = `const accountBalances = accounts.map(function (a) {\n  const name = String(a.account_name || '');\n  const delta = txs.reduce(function (s, t) {\n    if (t.account !== name) return s;\n    return s + (t.type === 'Income' ? t.amount : -t.amount);\n  }, 0);\n  return { name: name, balance: (Number(a.starting_balance) || 0) + delta };\n});`;
const NEW_BAL = `const accountBalances = accounts.map(function (a) {\n  const name = String(a.account_name || '');\n  const asOf = a.as_of_date ? toISO(a.as_of_date) : '';\n  const delta = txs.reduce(function (s, t) {\n    if (t.account !== name) return s;\n    if (asOf && t.date <= asOf) return s;\n    return s + (t.type === 'Income' ? t.amount : -t.amount);\n  }, 0);\n  const bal = (Number(a.starting_balance) || 0) + delta;\n  return { name: name, balance: bal < 0 ? 0 : bal };\n});`;

async function main() {
  console.log('STEP 1: add internal as_of_date column = ' + TODAY + ' to existing accounts...');
  const setup = await api('POST', '/workflows', setupWorkflow());
  await api('POST', `/workflows/${setup.id}/activate`);
  await sleep(2500);
  const fire = await http('POST', `${BASE}/webhook/finance-set-asof`);
  console.log('  set as_of: status=' + fire.status + ' ' + (fire.text || ''));
  await api('DELETE', `/workflows/${setup.id}`);

  console.log('\nSTEP 2: patch WF1 accountBalances (baseline + floor 0)...');
  const wf1 = await api('GET', `/workflows/${WF1_ID}`);
  const code = wf1.nodes.find((n) => n.name === 'Compute Dashboard Metrics');
  if (code.parameters.jsCode.indexOf('if (asOf && t.date <= asOf)') !== -1) {
    console.log('  WF1 already patched — skipped');
  } else {
    if (code.parameters.jsCode.indexOf(OLD_BAL) === -1) throw new Error('WF1 accountBalances block not found (was it changed?)');
    code.parameters.jsCode = code.parameters.jsCode.replace(OLD_BAL, NEW_BAL);
    await api('PUT', `/workflows/${WF1_ID}`, { name: wf1.name, nodes: wf1.nodes, connections: wf1.connections, settings: wf1.settings });
    if (!(await api('GET', `/workflows/${WF1_ID}`)).active) await api('POST', `/workflows/${WF1_ID}/activate`);
    console.log('  WF1 patched');
  }
  fs.writeFileSync(path.join(__dirname, 'finance-data-aggregator.json'), JSON.stringify(await api('GET', `/workflows/${WF1_ID}`), null, 2));

  console.log('\nSTEP 3: WF9 allow Accounts with 3 values...');
  const list = await api('GET', '/workflows?limit=250');
  const wf9meta = (list.data || []).find((w) => w.name === 'record-creator');
  const wf9 = await api('GET', `/workflows/${wf9meta.id}`);
  const validate = wf9.nodes.find((n) => n.name === 'Validate Create');
  if (validate.parameters.jsCode.indexOf('Accounts: 3') !== -1) {
    console.log('  WF9 already Accounts:3 — skipped');
  } else {
    validate.parameters.jsCode = validate.parameters.jsCode.replace('Accounts: 2', 'Accounts: 3');
    if (validate.parameters.jsCode.indexOf('Accounts: 3') === -1) throw new Error('WF9 allow patch failed');
    await api('PUT', `/workflows/${wf9meta.id}`, { name: wf9.name, nodes: wf9.nodes, connections: wf9.connections, settings: wf9.settings });
    if (!(await api('GET', `/workflows/${wf9meta.id}`)).active) await api('POST', `/workflows/${wf9meta.id}/activate`);
    console.log('  WF9 patched');
  }
  fs.writeFileSync(path.join(__dirname, 'record-creator.json'), JSON.stringify(await api('GET', `/workflows/${wf9meta.id}`), null, 2));

  console.log('\nSTEP 4: verify dashboard...');
  await sleep(1500);
  const d = (await http('GET', `${BASE}/webhook/finance-dashboard`)).json;
  for (const a of d.accountBalances || []) console.log('  ' + a.name + ' = ' + a.balance);
  console.log('  Cash in Hand (sum) =', (d.accountBalances || []).reduce((s, a) => s + a.balance, 0));
  console.log('  accountsStartingTotal =', d.metrics.accountsStartingTotal, '| expenses =', d.metrics.expenses);
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
