#!/usr/bin/env node
/**
 * Budget section backend.
 * 1. Create + header the `Budgets` tab (category, monthly_limit) via temp workflow.
 * 2. Patch WF1: read Budgets, return budgets[] (spent from current-month catTotals).
 * 3. WF9 record-creator: allow Budgets tab (2 values).
 * 4. Deactivate WF5 budget-warning-alert (in-app only now; income-based threshold misfires).
 * Idempotent. Exports updated workflow JSONs.
 */
const fs = require('fs');
const path = require('path');
const s = JSON.parse(fs.readFileSync('C:/Users/User/.claude/settings.json', 'utf8'));
const { N8N_API_URL: BASE, N8N_API_KEY: KEY } = s.mcpServers['n8n-mcp'].env;
const SPREADSHEET_ID = '16vNm0PPxV-OP1Kp_INOKiBz33YcL-ZkowAyRw7HnwcI';
const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets/' + SPREADSHEET_ID;
const SHEETS_CRED = { id: 'eo7uMjjFUzvjTAGi', name: 'Google Sheets account' };
const WF1_ID = '8GejOtDtsht0CfEJ';

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

function setupBudgetsTab() {
  const sh = (id, name, pos, params) => ({
    id, name, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: pos,
    parameters: { authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', options: {}, ...params },
    credentials: { googleSheetsOAuth2Api: SHEETS_CRED },
  });
  const addSheet = sh('h1', 'Add Budgets Tab', [220, 0], {
    method: 'POST', url: SHEETS_BASE + ':batchUpdate', sendBody: true, specifyBody: 'json',
    jsonBody: '={{ JSON.stringify({ requests: [{ addSheet: { properties: { title: "Budgets" } } }] }) }}',
  });
  addSheet.onError = 'continueRegularOutput';
  return {
    name: 'Finance OS - Setup Budgets Tab (temporary)',
    settings: { executionOrder: 'v1', timezone: 'Asia/Dhaka' },
    nodes: [
      { id: 'wh1', name: 'Trigger', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, 0], parameters: { httpMethod: 'POST', path: 'finance-setup-budgets', responseMode: 'responseNode', options: {} } },
      addSheet,
      sh('h2', 'Header', [440, 0], { method: 'PUT', url: SHEETS_BASE + '/values/Budgets!A1?valueInputOption=RAW', sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify({ values: [["category","monthly_limit"]] }) }}' }),
      { id: 'r1', name: 'Done', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [660, 0], parameters: { respondWith: 'json', responseBody: '={{ JSON.stringify({ ok: true }) }}', options: {} } },
    ],
    connections: {
      'Trigger': { main: [[{ node: 'Add Budgets Tab', type: 'main', index: 0 }]] },
      'Add Budgets Tab': { main: [[{ node: 'Header', type: 'main', index: 0 }]] },
      'Header': { main: [[{ node: 'Done', type: 'main', index: 0 }]] },
    },
  };
}

const BUDGETS_CALC = `const budgets = toObjects(tabs.Budgets).map(function (b) {\n  const cat = String(b.category || '');\n  const limit = Number(b.monthly_limit) || 0;\n  const spent = catTotals[cat] || 0;\n  return { category: cat, limit: limit, spent: spent, remaining: limit - spent, pct: limit > 0 ? Math.round((spent / limit) * 100) : 0 };\n});\n`;

async function main() {
  console.log('STEP 1: create + header Budgets tab...');
  const setup = await api('POST', '/workflows', setupBudgetsTab());
  await api('POST', `/workflows/${setup.id}/activate`);
  await sleep(2500);
  const fire = await http('POST', `${BASE}/webhook/finance-setup-budgets`);
  console.log('  setup: status=' + fire.status);
  await api('DELETE', `/workflows/${setup.id}`);

  console.log('\nSTEP 2: patch WF1 (read Budgets, return budgets[])...');
  const wf1 = await api('GET', `/workflows/${WF1_ID}`);
  const read = wf1.nodes.find((n) => n.name === 'Read All 4 Sheet Tabs');
  const code = wf1.nodes.find((n) => n.name === 'Compute Dashboard Metrics');
  let changed = false;
  if (read.parameters.url.indexOf('ranges=Budgets') === -1) {
    read.parameters.url = read.parameters.url.replace('ranges=Categories&valueRenderOption', 'ranges=Categories&ranges=Budgets&valueRenderOption');
    changed = true;
  }
  if (code.parameters.jsCode.indexOf('tabs.Budgets') === -1) {
    code.parameters.jsCode = code.parameters.jsCode
      .replace('return [{ json: {', BUDGETS_CALC + 'return [{ json: {')
      .replace('  categories: categories\n} }];', '  categories: categories,\n  budgets: budgets\n} }];');
    changed = true;
  }
  if (changed) {
    if (read.parameters.url.indexOf('ranges=Budgets') === -1) throw new Error('WF1 URL patch failed');
    if (code.parameters.jsCode.indexOf('budgets: budgets') === -1) throw new Error('WF1 return patch failed');
    await api('PUT', `/workflows/${WF1_ID}`, { name: wf1.name, nodes: wf1.nodes, connections: wf1.connections, settings: wf1.settings });
    if (!(await api('GET', `/workflows/${WF1_ID}`)).active) await api('POST', `/workflows/${WF1_ID}/activate`);
    console.log('  WF1 patched');
  } else { console.log('  WF1 already has Budgets — skipped'); }
  fs.writeFileSync(path.join(__dirname, 'finance-data-aggregator.json'), JSON.stringify(await api('GET', `/workflows/${WF1_ID}`), null, 2));

  console.log('\nSTEP 3: WF9 allow Budgets...');
  const list = await api('GET', '/workflows?limit=250');
  const wf9meta = (list.data || []).find((w) => w.name === 'record-creator');
  const wf9 = await api('GET', `/workflows/${wf9meta.id}`);
  const validate = wf9.nodes.find((n) => n.name === 'Validate Create');
  if (validate.parameters.jsCode.indexOf('Budgets:') === -1) {
    validate.parameters.jsCode = validate.parameters.jsCode.replace('Accounts: 3 };', 'Accounts: 3, Budgets: 2 };');
    if (validate.parameters.jsCode.indexOf('Budgets: 2') === -1) throw new Error('WF9 allow patch failed');
    await api('PUT', `/workflows/${wf9meta.id}`, { name: wf9.name, nodes: wf9.nodes, connections: wf9.connections, settings: wf9.settings });
    if (!(await api('GET', `/workflows/${wf9meta.id}`)).active) await api('POST', `/workflows/${wf9meta.id}/activate`);
    console.log('  WF9 patched');
  } else { console.log('  WF9 already allows Budgets — skipped'); }
  fs.writeFileSync(path.join(__dirname, 'record-creator.json'), JSON.stringify(await api('GET', `/workflows/${wf9meta.id}`), null, 2));

  console.log('\nSTEP 4: deactivate WF5 budget-warning-alert...');
  const wf5meta = (list.data || []).find((w) => w.name === 'budget-warning-alert');
  if (wf5meta) {
    const before = await api('GET', `/workflows/${wf5meta.id}`);
    console.log('  WF5 active before:', before.active);
    if (before.active) { await api('POST', `/workflows/${wf5meta.id}/deactivate`); }
    console.log('  WF5 active after:', (await api('GET', `/workflows/${wf5meta.id}`)).active);
  } else { console.log('  WF5 not found'); }

  console.log('\nSTEP 5: verify dashboard...');
  await sleep(1500);
  const d = (await http('GET', `${BASE}/webhook/finance-dashboard`)).json;
  console.log('  budgets:', JSON.stringify(d.budgets));
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
