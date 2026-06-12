#!/usr/bin/env node
/**
 * Milestone 9 deploy script — 4 scheduled Gmail alert workflows.
 *
 *   WF4 weekly-safe-to-spend-alert  — Mon 8am, always sends
 *   WF5 budget-warning-alert        — daily 12pm, sends if expenses >= 80% of income
 *                                     (no per-category budgets exist in the Sheet,
 *                                     so the 80% threshold applies to the month total)
 *   WF6 asset-maturity-reminder     — daily 9am, sends if any asset matures in <= 7 days
 *   WF7 end-of-month-summary        — 6pm on days 28-31, sends only on the actual last day
 *
 * Every workflow: Schedule Trigger + temporary Manual Test Trigger (GET webhook,
 * ?force=true overrides the send condition) -> fetch Workflow 1's pre-computed
 * dashboard JSON -> Code builds subject/body + send decision -> IF -> Gmail.
 *
 * Phases:
 *   node deploy-milestone9.js         create + activate + fire all 4 test webhooks
 *   node deploy-milestone9.js strip   remove the test triggers, export workflow JSONs
 *
 * Reads N8N_API_URL / N8N_API_KEY from Claude Code settings — never hardcoded.
 */

const fs = require('fs');
const path = require('path');

const settings = JSON.parse(
  fs.readFileSync('C:/Users/User/.claude/settings.json', 'utf8')
);
const { N8N_API_URL: BASE, N8N_API_KEY: KEY } =
  settings.mcpServers['n8n-mcp'].env;

const GMAIL_CRED = { id: '0KVFYj5t0Jons8bA', name: 'Gmail account' };
const EMAIL_TO = 'asim.headwaywriting@gmail.com';
const DASHBOARD_URL = `${BASE}/webhook/finance-dashboard`;
const APP_URL = 'https://finance-os-eight-delta.vercel.app/';

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

async function callWebhook(p, attempts = 4) {
  let last;
  for (let i = 0; i < attempts; i++) {
    await sleep(2000);
    try {
      const r = await fetch(`${BASE}/webhook/${p}`);
      return { status: r.status, text: await r.text() };
    } catch (e) {
      last = e;
      console.log(`  webhook attempt ${i + 1} failed: ${e.message}`);
    }
  }
  throw last;
}

// ---------------------------------------------------------------------------
// Shared code-node helpers (string-injected into each Build Email node)
// ---------------------------------------------------------------------------
const COMMON_HELPERS = `
let force = false;
try { force = String($('Manual Test Trigger').first().json.query.force) === 'true'; } catch (e) { force = false; }
const d = $json;
const m = d.metrics || {};
const taka = function (n) {
  n = Number(n) || 0;
  // Manual Indian-style grouping (12,34,567) — the n8n sandbox's
  // toLocaleString('en-IN') is unreliable (partial ICU).
  const s = String(Math.round(Math.abs(n)));
  const grouped = s.length > 3
    ? s.slice(0, -3).replace(/\\B(?=(\\d{2})+(?!\\d))/g, ',') + ',' + s.slice(-3)
    : s;
  return (n < 0 ? '-' : '') + '\\u09f3' + grouped;
};
`;

const COMMON_FOOTER = `
if (forced) lines.push('', '(sent by manual test trigger \\u2014 the normal condition was not met)');
lines.push('', 'Dashboard: ${APP_URL}');
return [{ json: { send: send || force, forced: forced, subject: subject, body: lines.join('\\n') } }];
`;

const WF4_CODE = COMMON_HELPERS + `
const send = true;
const forced = false;
const subject = 'Finance OS weekly: ' + taka(m.safeToSpend) + ' safe to spend';
const lines = [
  'Weekly Finance OS summary',
  '',
  'Safe to spend: ' + taka(m.safeToSpend) + ' (' + m.daysLeftInMonth + ' days left this month)',
  'Income this month: ' + taka(m.income),
  'Expenses this month: ' + taka(m.expenses),
  'Net: ' + taka(m.net),
  '',
  'Accounts:'
];
for (const a of d.accountBalances || []) lines.push('- ' + a.name + ': ' + taka(a.balance));
lines.push('', 'Top spending this month:');
for (const c of (d.spendingByCategory || []).slice(0, 5)) lines.push('- ' + c.category + ': ' + taka(c.amount));
` + COMMON_FOOTER;

const WF5_CODE = COMMON_HELPERS + `
// No per-category budgets exist in the Sheet, so the 80% threshold
// (BUDGET_WARNING_THRESHOLD in lib/constants.ts) applies to the month total.
const ratio = Number(m.income) > 0 ? Number(m.expenses) / Number(m.income) : 1;
const pct = Math.round(ratio * 100);
const send = ratio >= 0.8;
const forced = force && !send;
const subject = 'Finance OS warning: spending at ' + pct + '% of income';
const lines = [
  'Budget warning from Finance OS',
  '',
  'Expenses this month are ' + pct + '% of income (alert threshold: 80%).',
  '',
  'Income: ' + taka(m.income),
  'Expenses: ' + taka(m.expenses),
  'Net: ' + taka(m.net),
  'Safe to spend: ' + taka(m.safeToSpend) + ' (' + m.daysLeftInMonth + ' days left)',
  '',
  'Spending by category:'
];
for (const c of d.spendingByCategory || []) lines.push('- ' + c.category + ': ' + taka(c.amount));
` + COMMON_FOOTER;

const WF6_CODE = COMMON_HELPERS + `
const assets = d.assets || [];
const soon = assets.filter(function (a) {
  return a.daysToMaturity !== null && a.daysToMaturity >= 0 && a.daysToMaturity <= 7;
});
const send = soon.length > 0;
const forced = force && !send;
const list = send ? soon : assets;
const subject = send
  ? 'Finance OS: ' + soon.length + ' asset' + (soon.length === 1 ? '' : 's') + ' maturing within 7 days'
  : 'Finance OS: no assets maturing within 7 days';
const lines = [send ? 'Assets maturing within 7 days:' : 'All assets (none within 7 days):', ''];
for (const a of list) {
  lines.push(
    '- ' + a.name + ' (' + a.type + ', ' + a.institution + '): ' + taka(a.value) +
    ' at ' + a.interestRate + '%' +
    (a.maturityDate ? ' \\u2014 matures ' + a.maturityDate + ' (' + a.daysToMaturity + ' days)' : ' \\u2014 no maturity date')
  );
}
` + COMMON_FOOTER;

const WF7_CODE = COMMON_HELPERS + `
const now = DateTime.now().setZone('Asia/Dhaka');
const isLastDay = now.day === now.endOf('month').day;
const send = isLastDay;
const forced = force && !send;
const subject = 'Finance OS: ' + now.toFormat('LLLL yyyy') + ' monthly summary';
const goals = d.goals || [];
const assets = d.assets || [];
let assetTotal = 0;
for (const a of assets) assetTotal += Number(a.value) || 0;
const lines = [
  now.toFormat('LLLL yyyy') + ' \\u2014 monthly P&L from Finance OS',
  '',
  'Income: ' + taka(m.income),
  'Expenses: ' + taka(m.expenses),
  'Net: ' + taka(m.net),
  'Safe to spend remaining: ' + taka(m.safeToSpend),
  '',
  'Spending by category:'
];
for (const c of d.spendingByCategory || []) lines.push('- ' + c.category + ': ' + taka(c.amount));
lines.push('', 'Goals:');
for (const g of goals) lines.push('- ' + g.name + ': ' + taka(g.saved) + ' of ' + taka(g.target) + ' (' + Math.round(g.progressPct) + '%, ' + g.priority + ' priority)');
lines.push('', 'Accounts:');
for (const a of d.accountBalances || []) lines.push('- ' + a.name + ': ' + taka(a.balance));
lines.push('', 'Assets (total ' + taka(assetTotal) + '):');
for (const a of assets) lines.push('- ' + a.name + ': ' + taka(a.value));
` + COMMON_FOOTER;

// ---------------------------------------------------------------------------
// Workflow factory
// ---------------------------------------------------------------------------
function alertWorkflow({ name, sticky, schedule, testPath, code, errorWorkflowId }) {
  const settingsObj = { executionOrder: 'v1', timezone: 'Asia/Dhaka' };
  if (errorWorkflowId) settingsObj.errorWorkflow = errorWorkflowId;
  return {
    name,
    settings: settingsObj,
    nodes: [
      {
        id: 'note1', name: 'Overview', type: 'n8n-nodes-base.stickyNote', typeVersion: 1,
        position: [-80, -260],
        parameters: { content: sticky, height: 220, width: 520, color: 4 },
      },
      {
        id: 'sched1', name: 'Schedule', type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2,
        position: [0, 0],
        parameters: { rule: { interval: [schedule] } },
      },
      {
        id: 'wh1', name: 'Manual Test Trigger', type: 'n8n-nodes-base.webhook', typeVersion: 2,
        position: [0, 180],
        parameters: { httpMethod: 'GET', path: testPath, options: {} },
      },
      {
        id: 'http1', name: 'Fetch Dashboard Data', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2,
        position: [220, 90],
        parameters: { url: DASHBOARD_URL, options: { timeout: 15000 } },
      },
      {
        id: 'code1', name: 'Build Email', type: 'n8n-nodes-base.code', typeVersion: 2,
        position: [440, 90],
        parameters: { jsCode: code },
      },
      {
        id: 'if1', name: 'Should Send?', type: 'n8n-nodes-base.if', typeVersion: 2,
        position: [660, 90],
        parameters: {
          conditions: {
            options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
            conditions: [{
              id: 'c1',
              leftValue: '={{ $json.send === true }}',
              rightValue: '',
              operator: { type: 'boolean', operation: 'true', singleValue: true },
            }],
            combinator: 'and',
          },
          options: {},
        },
      },
      {
        id: 'gmail1', name: 'Send Alert Email', type: 'n8n-nodes-base.gmail', typeVersion: 2.1,
        position: [880, 0],
        parameters: {
          sendTo: EMAIL_TO,
          subject: '={{ $json.subject }}',
          emailType: 'text',
          message: '={{ $json.body }}',
          options: { appendAttribution: false },
        },
        credentials: { gmailOAuth2: GMAIL_CRED },
      },
    ],
    connections: {
      'Schedule': { main: [[{ node: 'Fetch Dashboard Data', type: 'main', index: 0 }]] },
      'Manual Test Trigger': { main: [[{ node: 'Fetch Dashboard Data', type: 'main', index: 0 }]] },
      'Fetch Dashboard Data': { main: [[{ node: 'Build Email', type: 'main', index: 0 }]] },
      'Build Email': { main: [[{ node: 'Should Send?', type: 'main', index: 0 }]] },
      'Should Send?': { main: [[{ node: 'Send Alert Email', type: 'main', index: 0 }]] },
    },
  };
}

const WORKFLOWS = [
  {
    name: 'weekly-safe-to-spend-alert',
    sticky: '## Weekly Safe-to-Spend Alert (Workflow 4)\nEvery Monday 8am (Asia/Dhaka): fetches Workflow 1\'s pre-computed dashboard JSON and emails the weekly summary (safe to spend, income/expenses/net, accounts, top spending). Always sends.',
    schedule: { field: 'weeks', weeksInterval: 1, triggerAtDay: [1], triggerAtHour: 8, triggerAtMinute: 0 },
    testPath: 'finance-alert-test-w4',
    code: WF4_CODE,
    expectSubject: 'safe to spend',
  },
  {
    name: 'budget-warning-alert',
    sticky: '## Budget Warning Alert (Workflow 5)\nDaily 12pm (Asia/Dhaka): sends ONLY if month expenses >= 80% of month income (no per-category budgets exist in the Sheet, so the threshold from lib/constants.ts applies to the total). Numbers come pre-computed from Workflow 1.',
    schedule: { field: 'days', daysInterval: 1, triggerAtHour: 12, triggerAtMinute: 0 },
    testPath: 'finance-alert-test-w5',
    code: WF5_CODE,
    expectSubject: 'spending at',
  },
  {
    name: 'asset-maturity-reminder',
    sticky: '## Asset Maturity Reminder (Workflow 6)\nDaily 9am (Asia/Dhaka): sends ONLY if any asset matures within 7 days (daysToMaturity 0-7 from Workflow 1).',
    schedule: { field: 'days', daysInterval: 1, triggerAtHour: 9, triggerAtMinute: 0 },
    testPath: 'finance-alert-test-w6',
    code: WF6_CODE,
    expectSubject: 'maturing within 7 days',
  },
  {
    name: 'end-of-month-summary',
    sticky: '## End-of-Month Summary (Workflow 7)\n6pm on days 28-31 (Asia/Dhaka); the Code node sends ONLY when today is actually the last day of the month. Full P&L: income/expenses/net, all categories, goals, accounts, assets.',
    schedule: { field: 'cronExpression', expression: '0 18 28-31 * *' },
    testPath: 'finance-alert-test-w7',
    code: WF7_CODE,
    expectSubject: 'monthly summary',
  },
];

async function findWorkflowByName(name) {
  const list = await api('GET', `/workflows?limit=250`);
  return (list.data || []).find((w) => w.name === name);
}

// ---------------------------------------------------------------------------
// Phase 1: create + activate + test
// ---------------------------------------------------------------------------
async function deploy() {
  console.log('STEP 0: locating global error handler workflow...');
  const errWf = await findWorkflowByName('Error Handler - Global');
  const errorWorkflowId = errWf ? errWf.id : undefined;
  console.log(errorWorkflowId ? `  found (${errorWorkflowId})` : '  not found — skipping errorWorkflow setting');

  for (const spec of WORKFLOWS) {
    console.log(`\nCREATING ${spec.name}...`);
    const existing = await findWorkflowByName(spec.name);
    if (existing) {
      console.log(`  already exists (${existing.id}) — skipping create`);
      continue;
    }
    const wf = await api('POST', '/workflows', alertWorkflow({ ...spec, errorWorkflowId }));
    await api('POST', `/workflows/${wf.id}/activate`);
    console.log(`  created + activated (${wf.id})`);
  }

  console.log('\nTESTING: firing all 4 manual test triggers (?force=true)...');
  for (const spec of WORKFLOWS) {
    const r = await callWebhook(`${spec.testPath}?force=true`);
    console.log(`  ${spec.name}: webhook status=${r.status}`);
    if (r.status !== 200) throw new Error(`${spec.name} test webhook returned ${r.status}`);
  }

  console.log('\nDONE (phase 1). Verify 4 emails arrived, then run: node deploy-milestone9.js strip');
}

// ---------------------------------------------------------------------------
// Phase 1.5: push updated Build Email code into existing workflows + retest WF4
// ---------------------------------------------------------------------------
async function patch() {
  for (const spec of WORKFLOWS) {
    const found = await findWorkflowByName(spec.name);
    if (!found) throw new Error(`${spec.name} not found`);
    const wf = await api('GET', `/workflows/${found.id}`);
    const nodes = wf.nodes.map((n) =>
      n.name === 'Build Email' ? { ...n, parameters: { ...n.parameters, jsCode: spec.code } } : n
    );
    await api('PUT', `/workflows/${found.id}`, {
      name: wf.name, nodes, connections: wf.connections, settings: wf.settings,
    });
    const after = await api('GET', `/workflows/${found.id}`);
    if (!after.active) await api('POST', `/workflows/${found.id}/activate`);
    console.log(`${spec.name}: Build Email code updated`);
  }
  console.log('\nRe-firing WF4 test trigger to verify formatting...');
  const r = await callWebhook('finance-alert-test-w4?force=true');
  console.log(`  status=${r.status}`);
}

// ---------------------------------------------------------------------------
// Phase 2: remove test triggers + export JSONs
// ---------------------------------------------------------------------------
async function strip() {
  for (const spec of WORKFLOWS) {
    const found = await findWorkflowByName(spec.name);
    if (!found) throw new Error(`${spec.name} not found`);
    const wf = await api('GET', `/workflows/${found.id}`);
    if (!wf.nodes.some((n) => n.name === 'Manual Test Trigger')) {
      console.log(`${spec.name}: already stripped`);
    } else {
      const nodes = wf.nodes.filter((n) => n.name !== 'Manual Test Trigger');
      const connections = { ...wf.connections };
      delete connections['Manual Test Trigger'];
      await api('PUT', `/workflows/${found.id}`, {
        name: wf.name,
        nodes,
        connections,
        settings: wf.settings,
      });
      const after = await api('GET', `/workflows/${found.id}`);
      if (!after.active) await api('POST', `/workflows/${found.id}/activate`);
      console.log(`${spec.name}: test trigger removed, active=${(await api('GET', `/workflows/${found.id}`)).active}`);
    }
    const fin = await api('GET', `/workflows/${found.id}`);
    fs.writeFileSync(
      path.join(__dirname, `${spec.name}.json`),
      JSON.stringify(fin, null, 2)
    );
    console.log(`  exported n8n/${spec.name}.json`);
  }
  console.log('\nDONE (phase 2).');
}

const phase = process.argv[2] === 'strip' ? strip : process.argv[2] === 'patch' ? patch : deploy;
phase().catch((e) => {
  console.error('\nFAILED:', e.message);
  process.exit(1);
});
