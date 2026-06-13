#!/usr/bin/env node
/**
 * Milestone 11 — CRUD + dynamic categories.
 *
 * 1. Creates + seeds a `Categories` tab (name, type, color) in the Finance OS Sheet
 *    via a temporary helper workflow (M2/M10 pattern).
 * 2. Creates Workflow 8 `record-remover` (POST /finance-delete) and Workflow 9
 *    `record-creator` (POST /finance-create) — generic delete/append by tab.
 * 3. Patches Workflow 1 (aggregator) to read the Categories tab and return
 *    `categories[]` in DashboardData.
 * 4. Patches Workflow 3 (chat handler): removes the per-transaction confirmation
 *    email, and derives the OpenAI category lists from live `categories[]`.
 *
 * Idempotent: re-running updates existing WF8/WF9 and skips already-applied patches.
 * Reads N8N_API_URL / N8N_API_KEY from Claude Code settings — never hardcoded.
 * Usage: node deploy-milestone11.js
 */

const fs = require('fs');
const path = require('path');

const settings = JSON.parse(
  fs.readFileSync('C:/Users/User/.claude/settings.json', 'utf8')
);
const { N8N_API_URL: BASE, N8N_API_KEY: KEY } =
  settings.mcpServers['n8n-mcp'].env;

const SPREADSHEET_ID = '16vNm0PPxV-OP1Kp_INOKiBz33YcL-ZkowAyRw7HnwcI';
const SHEETS_CRED = { id: 'eo7uMjjFUzvjTAGi', name: 'Google Sheets account' };
const ERROR_HANDLER_ID = '17zUtE9de19ejvvA';
const WF1_ID = '8GejOtDtsht0CfEJ'; // finance-data-aggregator
const WF3_ID = '5RkSgctHtRNq3mIR'; // ai-chat-handler
const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets/' + SPREADSHEET_ID;
const OUT_DIR = __dirname;

// Seed categories — mirrors lib/constants.ts CATEGORY_LIST.
const SEED_CATEGORIES = [
  ['name', 'type', 'color'],
  ['Groceries', 'Expense', '#f97316'],
  ['Food & Dining', 'Expense', '#fb923c'],
  ['Bills & Utilities', 'Expense', '#3b82f6'],
  ['Rent / Housing', 'Expense', '#60a5fa'],
  ['Transportation', 'Expense', '#a78bfa'],
  ['Home Repair', 'Expense', '#f59e0b'],
  ['Health & Medical', 'Expense', '#ef4444'],
  ['Date Night / Entertainment', 'Expense', '#ec4899'],
  ['Shopping & Personal', 'Expense', '#06b6d4'],
  ['Education', 'Expense', '#8b5cf6'],
  ['Family & Gifts', 'Expense', '#14b8a6'],
  ['Subscriptions', 'Expense', '#6366f1'],
  ['Savings & Investments', 'Expense', '#10b981'],
  ['Debt Payment', 'Expense', '#dc2626'],
  ['Miscellaneous', 'Expense', '#6b7280'],
  ['Salary', 'Income', '#3b82f6'],
  ['Freelance Income', 'Income', '#0ea5e9'],
  ['Other Income', 'Income', '#10b981'],
];

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

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// --- node helpers ----------------------------------------------------------
const sheetsHttp = (id, name, pos, params) => ({
  id, name, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: pos,
  parameters: {
    authentication: 'predefinedCredentialType',
    nodeCredentialType: 'googleSheetsOAuth2Api',
    options: {}, ...params,
  },
  credentials: { googleSheetsOAuth2Api: SHEETS_CRED },
});

const codeNode = (id, name, pos, jsCode) => ({
  id, name, type: 'n8n-nodes-base.code', typeVersion: 2, position: pos,
  parameters: { jsCode },
});

const boolIf = (id, name, pos, leftExpr) => ({
  id, name, type: 'n8n-nodes-base.if', typeVersion: 2, position: pos,
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
      conditions: [{
        id: 'c1', leftValue: leftExpr, rightValue: '',
        operator: { type: 'boolean', operation: 'true', singleValue: true },
      }],
      combinator: 'and',
    },
    options: {},
  },
});

const respond = (id, name, pos, bodyExpr, code) => ({
  id, name, type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: pos,
  parameters: { respondWith: 'json', responseBody: bodyExpr, options: code ? { responseCode: code } : {} },
});

const webhook = (id, name, pos, path) => ({
  id, name, type: 'n8n-nodes-base.webhook', typeVersion: 2, position: pos,
  parameters: { httpMethod: 'POST', path, responseMode: 'responseNode', options: {} },
});

const STD_SETTINGS = {
  executionOrder: 'v1', timezone: 'Asia/Dhaka',
  callerPolicy: 'workflowsFromSameOwner', errorWorkflow: ERROR_HANDLER_ID,
};

// --- Workflow 8: record-remover -------------------------------------------
const FIND_ROW_CODE = `
const prep = $('Prep Delete').first().json;
const tab = prep.tab;
const match = prep.match || {};
const meta = $('Get Sheet Meta').first().json;
const sheet = (meta.sheets || []).find(function (s) { return s.properties.title === tab; });
if (!sheet) return [{ json: { found: false, error: 'tab not found: ' + tab } }];
const sheetId = sheet.properties.sheetId;
const values = ($('Read Tab').first().json.values) || [];
if (values.length < 2) return [{ json: { found: false, error: 'no data rows in ' + tab } }];
function toISO(d){ if (typeof d === 'number') return new Date(Math.round((d-25569)*86400000)).toISOString().slice(0,10); return String(d).slice(0,10); }
const head = values[0];
let foundIndex = -1;
for (let i = 1; i < values.length; i++) {
  const o = {};
  head.forEach(function (h, j) { o[h] = values[i][j] === undefined ? '' : values[i][j]; });
  let ok = true;
  for (const k of Object.keys(match)) {
    let a = o[k]; let b = match[k];
    if (k === 'amount') { a = Number(a); b = Number(b); }
    else if (k === 'date') { a = toISO(a); b = toISO(b); }
    else { a = String(a == null ? '' : a); b = String(b == null ? '' : b); }
    if (String(a) !== String(b)) { ok = false; break; }
  }
  if (ok) { foundIndex = i; break; }
}
if (foundIndex === -1) return [{ json: { found: false, error: 'row not found' } }];
return [{ json: { found: true, body: { requests: [{ deleteDimension: { range: {
  sheetId: sheetId, dimension: 'ROWS', startIndex: foundIndex, endIndex: foundIndex + 1
} } }] } } }];
`.trim();

function recordRemoverWorkflow() {
  const readTabUrl = "={{ '" + SHEETS_BASE + "/values/' + encodeURIComponent($('Prep Delete').first().json.tab) + '?valueRenderOption=UNFORMATTED_VALUE' }}";
  return {
    name: 'record-remover',
    settings: STD_SETTINGS,
    nodes: [
      {
        id: 'note1', name: 'Overview', type: 'n8n-nodes-base.stickyNote', typeVersion: 1,
        position: [-80, -260],
        parameters: {
          content: '## Record Remover (Workflow 8)\nPOST /finance-delete { tab, match }. Reads the tab, finds the FIRST row matching every field in `match`, and deletes it via Sheets batchUpdate deleteDimension. 400 if no row matches — nothing is deleted.\n\nTransactions match on all 7 fields; Goals on goal_name; Assets on asset_name.',
          height: 240, width: 540, color: 4,
        },
      },
      webhook('wh1', 'Delete Request', [0, 0], 'finance-delete'),
      codeNode('prep1', 'Prep Delete', [220, 0],
        "const b = $json.body || {};\nreturn [{ json: { tab: String(b.tab || ''), match: b.match || {} } }];"),
      sheetsHttp('http1', 'Get Sheet Meta', [440, 0], { url: SHEETS_BASE + '?fields=sheets.properties' }),
      sheetsHttp('http2', 'Read Tab', [660, 0], { url: readTabUrl }),
      codeNode('code1', 'Find Row', [880, 0], FIND_ROW_CODE),
      boolIf('if1', 'Found?', [1100, 0], '={{ $json.found }}'),
      sheetsHttp('http3', 'Delete Row', [1320, -120], {
        method: 'POST', url: SHEETS_BASE + ':batchUpdate',
        sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.body) }}',
      }),
      respond('resp1', 'Respond Deleted', [1540, -120], "={{ JSON.stringify({ success: true }) }}"),
      respond('resp2', 'Respond Not Found', [1320, 120], "={{ JSON.stringify({ success: false, error: $json.error }) }}", 400),
    ],
    connections: {
      'Delete Request': { main: [[{ node: 'Prep Delete', type: 'main', index: 0 }]] },
      'Prep Delete': { main: [[{ node: 'Get Sheet Meta', type: 'main', index: 0 }]] },
      'Get Sheet Meta': { main: [[{ node: 'Read Tab', type: 'main', index: 0 }]] },
      'Read Tab': { main: [[{ node: 'Find Row', type: 'main', index: 0 }]] },
      'Find Row': { main: [[{ node: 'Found?', type: 'main', index: 0 }]] },
      'Found?': { main: [
        [{ node: 'Delete Row', type: 'main', index: 0 }],
        [{ node: 'Respond Not Found', type: 'main', index: 0 }],
      ] },
      'Delete Row': { main: [[{ node: 'Respond Deleted', type: 'main', index: 0 }]] },
    },
  };
}

// --- Workflow 9: record-creator -------------------------------------------
const VALIDATE_CREATE_CODE = `
const b = $json.body || {};
const tab = String(b.tab || '');
const values = Array.isArray(b.values) ? b.values : null;
const allowed = { Goals: 5, Assets: 8, Categories: 3 };
const errors = [];
if (!allowed[tab]) errors.push('invalid tab: ' + tab);
if (!values) errors.push('values must be an array');
else if (allowed[tab] && values.length !== allowed[tab]) errors.push('expected ' + allowed[tab] + ' values for ' + tab + ', got ' + values.length);
else if (values[0] === undefined || String(values[0]).trim() === '') errors.push('first column is required');
return [{ json: { valid: errors.length === 0, errors: errors, tab: tab, values: values || [] } }];
`.trim();

function recordCreatorWorkflow() {
  const appendUrl = "={{ '" + SHEETS_BASE + "/values/' + encodeURIComponent($json.tab) + '!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS' }}";
  return {
    name: 'record-creator',
    settings: STD_SETTINGS,
    nodes: [
      {
        id: 'note1', name: 'Overview', type: 'n8n-nodes-base.stickyNote', typeVersion: 1,
        position: [-80, -260],
        parameters: {
          content: '## Record Creator (Workflow 9)\nPOST /finance-create { tab, values }. Validates the tab + value count, then appends the row to the Goals / Assets / Categories tab. 400 + error list on invalid input — nothing is written.\n\nTransactions still use Workflow 2 (transaction-logger).',
          height: 240, width: 540, color: 4,
        },
      },
      webhook('wh1', 'Create Request', [0, 0], 'finance-create'),
      codeNode('code1', 'Validate Create', [220, 0], VALIDATE_CREATE_CODE),
      boolIf('if1', 'Is Valid?', [440, 0], '={{ $json.valid }}'),
      sheetsHttp('http1', 'Append Row', [660, -100], {
        method: 'POST', url: appendUrl,
        sendBody: true, specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ values: [ $json.values ] }) }}',
      }),
      respond('resp1', 'Respond Created', [880, -100], "={{ JSON.stringify({ success: true }) }}"),
      respond('resp2', 'Respond Invalid', [660, 120], "={{ JSON.stringify({ success: false, error: $json.errors.join('; ') }) }}", 400),
    ],
    connections: {
      'Create Request': { main: [[{ node: 'Validate Create', type: 'main', index: 0 }]] },
      'Validate Create': { main: [[{ node: 'Is Valid?', type: 'main', index: 0 }]] },
      'Is Valid?': { main: [
        [{ node: 'Append Row', type: 'main', index: 0 }],
        [{ node: 'Respond Invalid', type: 'main', index: 0 }],
      ] },
      'Append Row': { main: [[{ node: 'Respond Created', type: 'main', index: 0 }]] },
    },
  };
}

// --- temp helper: create + seed the Categories tab ------------------------
function setupCategoriesWorkflow() {
  const addSheetNode = sheetsHttp('http1', 'Add Categories Tab', [220, 0], {
    method: 'POST', url: SHEETS_BASE + ':batchUpdate',
    sendBody: true, specifyBody: 'json',
    jsonBody: '={{ JSON.stringify({ requests: [{ addSheet: { properties: { title: "Categories" } } }] }) }}',
  });
  addSheetNode.onError = 'continueRegularOutput'; // tab may already exist
  const writeNode = sheetsHttp('http2', 'Seed Categories', [440, 0], {
    method: 'PUT', url: SHEETS_BASE + '/values/Categories!A1?valueInputOption=RAW',
    sendBody: true, specifyBody: 'json',
    jsonBody: '={{ JSON.stringify({ values: ' + JSON.stringify(SEED_CATEGORIES) + ' }) }}',
  });
  return {
    name: 'Finance OS - Setup Categories Tab (temporary M11)',
    settings: { executionOrder: 'v1', timezone: 'Asia/Dhaka' },
    nodes: [
      webhook('wh1', 'Setup Trigger', [0, 0], 'finance-m11-setup-categories'),
      addSheetNode,
      writeNode,
      respond('resp1', 'Respond Done', [660, 0], "={{ JSON.stringify({ success: true }) }}"),
    ],
    connections: {
      'Setup Trigger': { main: [[{ node: 'Add Categories Tab', type: 'main', index: 0 }]] },
      'Add Categories Tab': { main: [[{ node: 'Seed Categories', type: 'main', index: 0 }]] },
      'Seed Categories': { main: [[{ node: 'Respond Done', type: 'main', index: 0 }]] },
    },
  };
}

// --- create or update a workflow by name ----------------------------------
async function upsertWorkflow(def) {
  const list = await api('GET', '/workflows?limit=250');
  const existing = (list.data || []).find((w) => w.name === def.name);
  if (existing) {
    await api('PUT', `/workflows/${existing.id}`, {
      name: def.name, nodes: def.nodes, connections: def.connections, settings: def.settings,
    });
    if (!(await api('GET', `/workflows/${existing.id}`)).active) {
      await api('POST', `/workflows/${existing.id}/activate`);
    }
    console.log(`  updated + active: ${def.name} (${existing.id})`);
    return existing.id;
  }
  const created = await api('POST', '/workflows', def);
  await api('POST', `/workflows/${created.id}/activate`);
  console.log(`  created + active: ${def.name} (${created.id})`);
  return created.id;
}

function exportWorkflow(id, filename) {
  return api('GET', `/workflows/${id}`).then((wf) => {
    fs.writeFileSync(path.join(OUT_DIR, filename), JSON.stringify(wf, null, 2));
    console.log(`  exported ${filename}`);
  });
}

async function main() {
  console.log('STEP 1: create + seed the Categories tab...');
  const setup = await api('POST', '/workflows', setupCategoriesWorkflow());
  await api('POST', `/workflows/${setup.id}/activate`);
  await sleep(2500);
  const seed = await http('POST', `${BASE}/webhook/finance-m11-setup-categories`);
  console.log(`  seed trigger: status=${seed.status}`);
  await api('DELETE', `/workflows/${setup.id}`);

  console.log('\nSTEP 2: create / update Workflow 8 (record-remover) + Workflow 9 (record-creator)...');
  const wf8 = await upsertWorkflow(recordRemoverWorkflow());
  const wf9 = await upsertWorkflow(recordCreatorWorkflow());

  console.log('\nSTEP 3: patch Workflow 1 (aggregator) to read Categories...');
  const wf1 = await api('GET', `/workflows/${WF1_ID}`);
  const readNode = wf1.nodes.find((n) => n.name === 'Read All 4 Sheet Tabs');
  const codeNode1 = wf1.nodes.find((n) => n.name === 'Compute Dashboard Metrics');
  let patched1 = false;
  if (readNode.parameters.url.indexOf('ranges=Categories') === -1) {
    readNode.parameters.url = readNode.parameters.url.replace(
      'ranges=Assets&valueRenderOption', 'ranges=Assets&ranges=Categories&valueRenderOption');
    patched1 = true;
  }
  if (codeNode1.parameters.jsCode.indexOf('tabs.Categories') === -1) {
    codeNode1.parameters.jsCode = codeNode1.parameters.jsCode
      .replace('const assets = toObjects(tabs.Assets);',
        "const assets = toObjects(tabs.Assets);\nconst categories = toObjects(tabs.Categories).map(function (c) { return { name: String(c.name || ''), type: c.type === 'Income' ? 'Income' : 'Expense', color: String(c.color || '#6b7280') }; });")
      .replace('  monthlyTrend: monthlyTrend\n} }];',
        '  monthlyTrend: monthlyTrend,\n  categories: categories\n} }];');
    patched1 = true;
  }
  if (patched1) {
    if (readNode.parameters.url.indexOf('ranges=Categories') === -1) throw new Error('WF1 URL patch failed');
    if (codeNode1.parameters.jsCode.indexOf('categories: categories') === -1) throw new Error('WF1 code return patch failed');
    await api('PUT', `/workflows/${WF1_ID}`, {
      name: wf1.name, nodes: wf1.nodes, connections: wf1.connections, settings: wf1.settings,
    });
    if (!(await api('GET', `/workflows/${WF1_ID}`)).active) await api('POST', `/workflows/${WF1_ID}/activate`);
    console.log('  WF1 patched (Categories range + categories[] output)');
  } else {
    console.log('  WF1 already reads Categories — skipped');
  }

  console.log('\nSTEP 4: patch Workflow 3 (chat handler) — remove per-transaction email + dynamic categories...');
  const wf3 = await api('GET', `/workflows/${WF3_ID}`);
  // 4a. remove the email nodes + their connections
  wf3.nodes = wf3.nodes.filter((n) => n.name !== 'Email Confirmation?' && n.name !== 'Send Confirmation Email');
  delete wf3.connections['Return Chat Reply'];
  delete wf3.connections['Email Confirmation?'];
  // 4b. drop the "confirmation email is on its way" sentence
  const buildLogged = wf3.nodes.find((n) => n.name === 'Build Logged Reply');
  if (buildLogged) {
    buildLogged.parameters.jsCode = buildLogged.parameters.jsCode
      .replace("'). A confirmation email is on its way.';", "').';");
  }
  // 4c. derive category lists from live data
  const buildMsgs = wf3.nodes.find((n) => n.name === 'Build OpenAI Messages');
  if (buildMsgs && buildMsgs.parameters.jsCode.indexOf('dash.categories') === -1) {
    buildMsgs.parameters.jsCode = buildMsgs.parameters.jsCode
      .replace(
        "const expenseCats = 'Groceries, Food & Dining, Bills & Utilities, Rent / Housing, Transportation, Home Repair, Health & Medical, Date Night / Entertainment, Shopping & Personal, Education, Family & Gifts, Subscriptions, Savings & Investments, Debt Payment, Miscellaneous';\nconst incomeCats = 'Salary, Freelance Income, Other Income';",
        "const allCats = Array.isArray(dash.categories) ? dash.categories : [];\nconst expenseCats = allCats.filter(function (c) { return c.type === 'Expense'; }).map(function (c) { return c.name; }).join(', ') || 'Groceries, Food & Dining, Bills & Utilities, Rent / Housing, Transportation, Home Repair, Health & Medical, Date Night / Entertainment, Shopping & Personal, Education, Family & Gifts, Subscriptions, Savings & Investments, Debt Payment, Miscellaneous';\nconst incomeCats = allCats.filter(function (c) { return c.type === 'Income'; }).map(function (c) { return c.name; }).join(', ') || 'Salary, Freelance Income, Other Income';");
  }
  // verify the string patches actually applied (replace is a silent no-op on mismatch)
  if (buildLogged && buildLogged.parameters.jsCode.indexOf('confirmation email is on its way') !== -1) {
    throw new Error('WF3 Build Logged Reply email-sentence patch did not apply');
  }
  if (buildMsgs && buildMsgs.parameters.jsCode.indexOf('dash.categories') === -1) {
    throw new Error('WF3 Build OpenAI Messages category patch did not apply');
  }
  await api('PUT', `/workflows/${WF3_ID}`, {
    name: wf3.name, nodes: wf3.nodes, connections: wf3.connections, settings: wf3.settings,
  });
  if (!(await api('GET', `/workflows/${WF3_ID}`)).active) await api('POST', `/workflows/${WF3_ID}/activate`);
  const wf3After = await api('GET', `/workflows/${WF3_ID}`);
  const stillHasEmail = wf3After.nodes.some((n) => n.name === 'Send Confirmation Email');
  if (stillHasEmail) throw new Error('WF3 email node not removed');
  console.log('  WF3 patched (email node removed, categories dynamic)');

  console.log('\nSTEP 5: export updated workflow JSONs...');
  await exportWorkflow(wf8, 'record-remover.json');
  await exportWorkflow(wf9, 'record-creator.json');
  await exportWorkflow(WF1_ID, 'finance-data-aggregator.json');
  await exportWorkflow(WF3_ID, 'ai-chat-handler.json');

  console.log('\nDONE. New webhooks:');
  console.log(`  N8N_DELETE_WEBHOOK_URL=${BASE}/webhook/finance-delete`);
  console.log(`  N8N_CREATE_WEBHOOK_URL=${BASE}/webhook/finance-create`);
}

main().catch((e) => {
  console.error('\nFAILED:', e.message);
  process.exit(1);
});
