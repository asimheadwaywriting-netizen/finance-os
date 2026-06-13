#!/usr/bin/env node
// Adds a per-day income/expense breakdown (`dailyTrend`) to Workflow 1's output,
// for the current month up to today. Idempotent. Reads N8N creds from settings.
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

const DAILY_CODE = [
  "const byDay = {};",
  "curr.forEach(function (t) {",
  "  const dd = t.date.slice(8, 10);",
  "  if (!byDay[dd]) byDay[dd] = { income: 0, expenses: 0 };",
  "  byDay[dd][t.type === 'Income' ? 'income' : 'expenses'] += t.amount;",
  "});",
  "const daysToShow = Math.min(today.daysInMonth, today.day);",
  "const dailyTrend = [];",
  "for (let i = 1; i <= daysToShow; i++) {",
  "  const k = String(i).padStart(2, '0');",
  "  const e = byDay[k] || { income: 0, expenses: 0 };",
  "  dailyTrend.push({ day: String(i), income: e.income, expenses: e.expenses });",
  "}",
  "",
].join('\n');

async function main() {
  const wf = await api('GET', `/workflows/${WF1_ID}`);
  const code = wf.nodes.find((n) => n.name === 'Compute Dashboard Metrics');
  if (code.parameters.jsCode.indexOf('dailyTrend') !== -1) {
    console.log('WF1 already has dailyTrend — skipped'); return exportWf(wf);
  }
  let js = code.parameters.jsCode;
  js = js.replace('return [{ json: {', DAILY_CODE + 'return [{ json: {');
  js = js.replace(
    '  monthlyTrend: monthlyTrend,\n  categories: categories',
    '  monthlyTrend: monthlyTrend,\n  dailyTrend: dailyTrend,\n  categories: categories'
  );
  if (js.indexOf('const dailyTrend = [];') === -1) throw new Error('daily code insert failed');
  if (js.indexOf('dailyTrend: dailyTrend') === -1) throw new Error('return patch failed');
  code.parameters.jsCode = js;
  await api('PUT', `/workflows/${WF1_ID}`, {
    name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings,
  });
  if (!(await api('GET', `/workflows/${WF1_ID}`)).active) await api('POST', `/workflows/${WF1_ID}/activate`);
  console.log('WF1 patched with dailyTrend');
  return exportWf(await api('GET', `/workflows/${WF1_ID}`));
}

function exportWf(wf) {
  fs.writeFileSync(path.join(__dirname, 'finance-data-aggregator.json'), JSON.stringify(wf, null, 2));
  console.log('exported finance-data-aggregator.json');
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
