#!/usr/bin/env node
// Adds metrics.accountsStartingTotal (sum of Accounts starting_balance) to
// Workflow 1's output — used as "Total Income So Far" (money added to accounts).
// Idempotent. Reads N8N creds from settings.
const fs = require('fs');
const path = require('path');
const s = JSON.parse(fs.readFileSync('C:/Users/User/.claude/settings.json', 'utf8'));
const { N8N_API_URL: BASE, N8N_API_KEY: KEY } = s.mcpServers['n8n-mcp'].env;
const WF1_ID = '8GejOtDtsht0CfEJ';

async function api(method, p, body) {
  const r = await fetch(`${BASE}/api/v1${p}`, {
    method, headers: { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${method} ${p} -> ${r.status}: ${await r.text()}`);
  const t = await r.text(); return t ? JSON.parse(t) : null;
}

async function main() {
  const wf = await api('GET', `/workflows/${WF1_ID}`);
  const code = wf.nodes.find((n) => n.name === 'Compute Dashboard Metrics');
  if (code.parameters.jsCode.indexOf('accountsStartingTotal') !== -1) {
    console.log('WF1 already has accountsStartingTotal — skipped'); return exportWf(wf);
  }
  let js = code.parameters.jsCode;
  js = js.replace(
    'const accounts = toObjects(tabs.Accounts);',
    'const accounts = toObjects(tabs.Accounts);\nconst accountsStartingTotal = accounts.reduce(function (s, a) { return s + (Number(a.starting_balance) || 0); }, 0);'
  );
  js = js.replace(
    'metrics: { income: income, expenses: expenses, net: net, safeToSpend: safeToSpend, daysLeftInMonth: daysLeftInMonth },',
    'metrics: { income: income, expenses: expenses, net: net, safeToSpend: safeToSpend, daysLeftInMonth: daysLeftInMonth, accountsStartingTotal: accountsStartingTotal },'
  );
  if (js.indexOf('const accountsStartingTotal =') === -1) throw new Error('accounts calc insert failed');
  if (js.indexOf('accountsStartingTotal: accountsStartingTotal') === -1) throw new Error('metrics patch failed');
  code.parameters.jsCode = js;
  await api('PUT', `/workflows/${WF1_ID}`, {
    name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings,
  });
  if (!(await api('GET', `/workflows/${WF1_ID}`)).active) await api('POST', `/workflows/${WF1_ID}/activate`);
  console.log('WF1 patched with metrics.accountsStartingTotal');
  return exportWf(await api('GET', `/workflows/${WF1_ID}`));
}

function exportWf(wf) {
  fs.writeFileSync(path.join(__dirname, 'finance-data-aggregator.json'), JSON.stringify(wf, null, 2));
  console.log('exported finance-data-aggregator.json');
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
