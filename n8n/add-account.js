#!/usr/bin/env node
// Extends record-creator (WF9) to allow the Accounts tab (account_name,
// starting_balance), then adds a new account. Idempotent on the allow-list patch.
// Usage: node add-account.js "Sonali Bank" 0
const fs = require('fs');
const path = require('path');
const s = JSON.parse(fs.readFileSync('C:/Users/User/.claude/settings.json', 'utf8'));
const { N8N_API_URL: BASE, N8N_API_KEY: KEY } = s.mcpServers['n8n-mcp'].env;

const NAME = process.argv[2] || 'Sonali Bank';
const START = Number(process.argv[3] || 0);

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

async function main() {
  // 1. allow the Accounts tab in WF9
  const list = await api('GET', '/workflows?limit=250');
  const wf9meta = (list.data || []).find((w) => w.name === 'record-creator');
  if (!wf9meta) throw new Error('record-creator not found');
  const wf9 = await api('GET', `/workflows/${wf9meta.id}`);
  const validate = wf9.nodes.find((n) => n.name === 'Validate Create');
  if (validate.parameters.jsCode.indexOf('Accounts:') === -1) {
    validate.parameters.jsCode = validate.parameters.jsCode.replace(
      'const allowed = { Goals: 5, Assets: 8, Categories: 3 };',
      'const allowed = { Goals: 5, Assets: 8, Categories: 3, Accounts: 2 };'
    );
    if (validate.parameters.jsCode.indexOf('Accounts: 2') === -1) throw new Error('WF9 allow-list patch failed');
    await api('PUT', `/workflows/${wf9meta.id}`, {
      name: wf9.name, nodes: wf9.nodes, connections: wf9.connections, settings: wf9.settings,
    });
    if (!(await api('GET', `/workflows/${wf9meta.id}`)).active) await api('POST', `/workflows/${wf9meta.id}/activate`);
    console.log('WF9 now allows the Accounts tab');
  } else {
    console.log('WF9 already allows Accounts — skipped');
  }
  await sleep(1500);

  // 2. add the account
  const res = await http('POST', `${BASE}/webhook/finance-create`, { tab: 'Accounts', values: [NAME, START] });
  console.log(`add account "${NAME}" (start ${START}): status=${res.status} ${JSON.stringify(res.json)}`);

  // 3. verify via aggregator
  await sleep(1500);
  const dash = await http('GET', `${BASE}/webhook/finance-dashboard`);
  const found = (dash.json.accountBalances || []).find((a) => a.name === NAME);
  console.log('verify in dashboard:', found ? `FOUND (balance ${found.balance})` : 'NOT FOUND');

  // 4. re-export WF9
  const wf9after = await api('GET', `/workflows/${wf9meta.id}`);
  fs.writeFileSync(path.join(__dirname, 'record-creator.json'), JSON.stringify(wf9after, null, 2));
  console.log('exported record-creator.json');
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
