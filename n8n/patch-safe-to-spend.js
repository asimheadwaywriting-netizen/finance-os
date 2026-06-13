#!/usr/bin/env node
// Re-base Safe to Spend = sum(account balances) - goal contributions, floored at 0
// (was net - goalContrib, which went negative with no logged income). Idempotent.
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

const OLD = `// Safe to spend = this month's net minus planned goal contributions\nconst safeToSpend = net - goalContrib;\n`;
const NEW_AFTER_BAL = `\nconst safeToSpend = Math.max(0, accountBalances.reduce(function (s, a) { return s + a.balance; }, 0) - goalContrib);`;

async function main() {
  const wf = await api('GET', `/workflows/${WF1_ID}`);
  const code = wf.nodes.find((n) => n.name === 'Compute Dashboard Metrics');
  let js = code.parameters.jsCode;
  if (js.indexOf('accountBalances.reduce(function (s, a) { return s + a.balance; }, 0) - goalContrib') !== -1) {
    console.log('WF1 safeToSpend already re-based — skipped');
  } else {
    if (js.indexOf(OLD) === -1) throw new Error('old safeToSpend line not found');
    // remove old definition
    js = js.replace(OLD, '');
    // add new definition right after the accountBalances block closes
    const anchor = 'return { name: name, balance: bal < 0 ? 0 : bal };\n});';
    if (js.indexOf(anchor) === -1) throw new Error('accountBalances anchor not found');
    js = js.replace(anchor, anchor + NEW_AFTER_BAL);
    if (js.indexOf('const safeToSpend = Math.max(0,') === -1) throw new Error('new safeToSpend insert failed');
    code.parameters.jsCode = js;
    await api('PUT', `/workflows/${WF1_ID}`, { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings });
    if (!(await api('GET', `/workflows/${WF1_ID}`)).active) await api('POST', `/workflows/${WF1_ID}/activate`);
    console.log('WF1 safeToSpend re-based');
  }
  fs.writeFileSync(path.join(__dirname, 'finance-data-aggregator.json'), JSON.stringify(await api('GET', `/workflows/${WF1_ID}`), null, 2));

  // verify
  const r = await fetch(`${BASE}/webhook/finance-dashboard`); const d = await r.json();
  console.log('safeToSpend =', d.metrics.safeToSpend, '| sum(balances) =', (d.accountBalances || []).reduce((s, a) => s + a.balance, 0));
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
