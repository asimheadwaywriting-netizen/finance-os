#!/usr/bin/env node
/**
 * Milestone 2 deploy script.
 *
 * 1. Creates a temporary webhook-triggered helper workflow in n8n that
 *    creates the "Finance OS" Google Sheet (4 tabs) and seeds sample data,
 *    calls it once, then deletes it.
 * 2. Creates + activates Workflow 1 (finance-data-aggregator) pointed at
 *    the new spreadsheet.
 * 3. Tests the production webhook and saves the workflow export + a sample
 *    response into this folder.
 *
 * Reads N8N_API_URL / N8N_API_KEY from Claude Code settings — never
 * hardcoded here.
 *
 * Usage: node deploy-milestone2.js [--spreadsheet-id <id>]
 *   Pass --spreadsheet-id to skip step 1 (e.g. on a rerun).
 */

const fs = require('fs');
const path = require('path');

const settings = JSON.parse(
  fs.readFileSync('C:/Users/User/.claude/settings.json', 'utf8')
);
const { N8N_API_URL: BASE, N8N_API_KEY: KEY } =
  settings.mcpServers['n8n-mcp'].env;

const SHEETS_CRED = { id: 'eo7uMjjFUzvjTAGi', name: 'Google Sheets account' };

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

// ---------------------------------------------------------------------------
// Seed code (runs inside the helper workflow's Code node)
// ---------------------------------------------------------------------------
const SEED_CODE = `
const spreadsheetId = $json.spreadsheetId;
const tx = [];
function push(date, type, category, payee, amount, account, note) {
  tx.push([date, type, category, payee, amount, account, note || '']);
}
const monthly = [
  { ym: '2026-01', up1: 45000, up2: 40000, groc1: 6200, groc2: 5400, desco: 1750, food: 2400, transport: 2100, dateNight: true },
  { ym: '2026-02', up1: 38000, up2: 32000, groc1: 5800, groc2: 5100, desco: 1620, food: 2900, transport: 1800, dateNight: true },
  { ym: '2026-03', up1: 52000, up2: 43000, groc1: 6500, groc2: 5900, desco: 1880, food: 3100, transport: 2300, dateNight: true },
  { ym: '2026-04', up1: 47000, up2: 33000, groc1: 6100, groc2: 5300, desco: 2050, food: 2600, transport: 2000, dateNight: true },
  { ym: '2026-05', up1: 60000, up2: 50000, groc1: 6800, groc2: 6200, desco: 2200, food: 3400, transport: 2500, dateNight: true },
  { ym: '2026-06', up1: 55000, up2: 48000, up2Day: '11', groc1: 6400, groc2: 0, desco: 2100, food: 1800, transport: 1100, dateNight: false }
];
for (const m of monthly) {
  push(m.ym + '-01', 'Expense', 'Rent / Housing', 'Landlord', 18000, 'Bank - DBBL', 'Monthly rent');
  push(m.ym + '-03', 'Expense', 'Subscriptions', 'Google One + Netflix', 1200, 'bKash', '');
  push(m.ym + '-05', 'Income', 'Freelance Income', 'Upwork', m.up1, 'Bank - DBBL', 'Milestone payment');
  push(m.ym + '-06', 'Expense', 'Groceries', 'Shwapno', m.groc1, 'Cash', 'Weekly bazar');
  push(m.ym + '-08', 'Expense', 'Bills & Utilities', 'Link3 Internet', 1300, 'bKash', '');
  push(m.ym + '-09', 'Expense', 'Food & Dining', 'Foodpanda', m.food, 'bKash', '');
  push(m.ym + '-10', 'Expense', 'Bills & Utilities', 'DESCO', m.desco, 'bKash', 'Electricity');
  push(m.ym + '-11', 'Expense', 'Transportation', 'Uber / CNG', m.transport, 'Cash', '');
  if (m.groc2) push(m.ym + '-18', 'Expense', 'Groceries', 'Meena Bazar', m.groc2, 'Cash', '');
  if (m.up2) push(m.ym + '-' + (m.up2Day || '20'), 'Income', 'Freelance Income', 'Upwork', m.up2, 'Bank - DBBL', 'Milestone payment');
  if (m.dateNight) push(m.ym + '-21', 'Expense', 'Date Night / Entertainment', 'Dinner out', 1500, 'bKash', '');
}
push('2026-01-20', 'Expense', 'Shopping & Personal', 'Aarong', 3500, 'bKash', 'New panjabi');
push('2026-02-14', 'Expense', 'Date Night / Entertainment', 'Cheez', 2500, 'bKash', 'Valentine dinner');
push('2026-03-15', 'Expense', 'Home Repair', 'Mistri Karim', 4500, 'Cash', 'Bathroom tap fix');
push('2026-04-22', 'Expense', 'Health & Medical', 'Popular Diagnostics', 2800, 'bKash', 'Blood tests');
push('2026-05-28', 'Expense', 'Family & Gifts', 'Eid shopping', 6000, 'Cash', 'Eid gifts for family');
push('2026-06-04', 'Expense', 'Education', 'Coursera', 1500, 'bKash', 'Course subscription');
tx.sort(function (a, b) { return a[0].localeCompare(b[0]); });
const body = {
  valueInputOption: 'RAW',
  data: [
    { range: 'Transactions!A1', values: [['date','type','category','payee','amount','account','note']].concat(tx) },
    { range: 'Accounts!A1', values: [
      ['account_name','starting_balance'],
      ['Cash', 90000],
      ['bKash', 55000],
      ['Bank - DBBL', 30000]
    ] },
    { range: 'Goals!A1', values: [
      ['goal_name','target_amount','saved_so_far','monthly_contribution','priority'],
      ['Emergency Fund', 300000, 120000, 15000, 'High'],
      ['New Laptop', 150000, 45000, 10000, 'Medium'],
      ['Masters Abroad Fund', 500000, 60000, 10000, 'High']
    ] },
    { range: 'Assets!A1', values: [
      ['asset_name','type','value','institution','start_date','maturity_date','interest_rate','notes'],
      ['DPS - DBBL', 'DPS', 96000, 'DBBL', '2024-08-01', '2029-08-01', 7.5, '4000/month deposit'],
      ['Sanchaypatra', 'Savings Certificate', 100000, 'Bangladesh Bank', '2025-01-15', '2030-01-15', 11.28, '5-year certificate'],
      ['FDR - BRAC Bank', 'FDR', 50000, 'BRAC Bank', '2025-12-20', '2026-06-20', 8, '6-month FDR']
    ] }
  ]
};
return [{ json: { spreadsheetId: spreadsheetId, body: body } }];
`.trim();

// ---------------------------------------------------------------------------
// Aggregation code (runs inside Workflow 1's Code node)
// All financial math lives HERE — the AI (OpenAI) never computes numbers.
// ---------------------------------------------------------------------------
const AGG_CODE = `
const res = $json;
const tabs = {};
for (const vr of (res.valueRanges || [])) {
  const tab = vr.range.split('!')[0].replace(/'/g, '');
  tabs[tab] = vr.values || [];
}
function toObjects(values) {
  if (!values || values.length < 2) return [];
  const head = values[0];
  return values.slice(1).map(function (r) {
    const o = {};
    head.forEach(function (h, i) { o[h] = r[i] === undefined ? '' : r[i]; });
    return o;
  });
}
// Sheets may return date cells as serial numbers — normalise to YYYY-MM-DD
function toISO(d) {
  if (typeof d === 'number') return new Date(Math.round((d - 25569) * 86400000)).toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}
const txs = toObjects(tabs.Transactions).map(function (t) {
  return {
    date: toISO(t.date),
    type: t.type === 'Income' ? 'Income' : 'Expense',
    category: String(t.category || ''),
    payee: String(t.payee || ''),
    amount: Number(t.amount) || 0,
    account: String(t.account || ''),
    note: String(t.note || '')
  };
});
const accounts = toObjects(tabs.Accounts);
const goals = toObjects(tabs.Goals);
const assets = toObjects(tabs.Assets);

const today = DateTime.now().setZone('Asia/Dhaka');
const ym = today.toFormat('yyyy-MM');

const curr = txs.filter(function (t) { return t.date.indexOf(ym) === 0; });
const income = curr.filter(function (t) { return t.type === 'Income'; }).reduce(function (s, t) { return s + t.amount; }, 0);
const expenses = curr.filter(function (t) { return t.type === 'Expense'; }).reduce(function (s, t) { return s + t.amount; }, 0);
const net = income - expenses;
const goalContrib = goals.reduce(function (s, g) { return s + (Number(g.monthly_contribution) || 0); }, 0);
// Safe to spend = this month's net minus planned goal contributions
const safeToSpend = net - goalContrib;
const daysLeftInMonth = today.daysInMonth - today.day;

const accountBalances = accounts.map(function (a) {
  const name = String(a.account_name || '');
  const delta = txs.reduce(function (s, t) {
    if (t.account !== name) return s;
    return s + (t.type === 'Income' ? t.amount : -t.amount);
  }, 0);
  return { name: name, balance: (Number(a.starting_balance) || 0) + delta };
});

const goalsOut = goals.map(function (g) {
  const target = Number(g.target_amount) || 0;
  const saved = Number(g.saved_so_far) || 0;
  return {
    name: String(g.goal_name || ''),
    target: target,
    saved: saved,
    contribution: Number(g.monthly_contribution) || 0,
    priority: String(g.priority || ''),
    progressPct: target > 0 ? Math.round((saved / target) * 100) : 0
  };
});

const assetsOut = assets.map(function (a) {
  const md = a.maturity_date ? toISO(a.maturity_date) : '';
  return {
    name: String(a.asset_name || ''),
    type: String(a.type || ''),
    value: Number(a.value) || 0,
    institution: String(a.institution || ''),
    daysToMaturity: md ? Math.ceil(DateTime.fromISO(md).diff(today, 'days').days) : null,
    interestRate: Number(a.interest_rate) || 0,
    maturityDate: md || null
  };
});

const recentTransactions = txs.slice().sort(function (a, b) { return b.date.localeCompare(a.date); }).slice(0, 10);

const catTotals = {};
curr.forEach(function (t) {
  if (t.type === 'Expense') catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
});
const spendingByCategory = Object.keys(catTotals)
  .map(function (c) { return { category: c, amount: catTotals[c] }; })
  .sort(function (a, b) { return b.amount - a.amount; });

const byMonth = {};
txs.forEach(function (t) {
  const m = t.date.slice(0, 7);
  if (!byMonth[m]) byMonth[m] = { income: 0, expenses: 0 };
  byMonth[m][t.type === 'Income' ? 'income' : 'expenses'] += t.amount;
});
const monthlyTrend = Object.keys(byMonth).sort().slice(-6).map(function (m) {
  return {
    month: DateTime.fromISO(m + '-01').toFormat('MMM'),
    income: byMonth[m].income,
    expenses: byMonth[m].expenses
  };
});

return [{ json: {
  metrics: { income: income, expenses: expenses, net: net, safeToSpend: safeToSpend, daysLeftInMonth: daysLeftInMonth },
  accountBalances: accountBalances,
  goals: goalsOut,
  assets: assetsOut,
  recentTransactions: recentTransactions,
  spendingByCategory: spendingByCategory,
  monthlyTrend: monthlyTrend
} }];
`.trim();

// ---------------------------------------------------------------------------
// Workflow definitions
// ---------------------------------------------------------------------------
function helperWorkflow() {
  return {
    name: 'Finance OS - Sheet Setup (temporary)',
    settings: { executionOrder: 'v1', timezone: 'Asia/Dhaka' },
    nodes: [
      {
        id: 'wh1',
        name: 'Setup Trigger',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 2,
        position: [0, 0],
        parameters: {
          httpMethod: 'POST',
          path: 'finance-os-setup',
          responseMode: 'responseNode',
          options: {},
        },
      },
      {
        id: 'http1',
        name: 'Create Finance OS Spreadsheet',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4.2,
        position: [220, 0],
        parameters: {
          method: 'POST',
          url: 'https://sheets.googleapis.com/v4/spreadsheets',
          authentication: 'predefinedCredentialType',
          nodeCredentialType: 'googleSheetsOAuth2Api',
          sendBody: true,
          specifyBody: 'json',
          jsonBody: JSON.stringify({
            properties: { title: 'Finance OS' },
            sheets: [
              { properties: { title: 'Transactions' } },
              { properties: { title: 'Accounts' } },
              { properties: { title: 'Goals' } },
              { properties: { title: 'Assets' } },
            ],
          }),
          options: {},
        },
        credentials: { googleSheetsOAuth2Api: SHEETS_CRED },
      },
      {
        id: 'code1',
        name: 'Build Sample Data',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [440, 0],
        parameters: { jsCode: SEED_CODE },
      },
      {
        id: 'http2',
        name: 'Seed All 4 Tabs',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4.2,
        position: [660, 0],
        parameters: {
          method: 'POST',
          url: '=https://sheets.googleapis.com/v4/spreadsheets/{{ $json.spreadsheetId }}/values:batchUpdate',
          authentication: 'predefinedCredentialType',
          nodeCredentialType: 'googleSheetsOAuth2Api',
          sendBody: true,
          specifyBody: 'json',
          jsonBody: '={{ JSON.stringify($json.body) }}',
          options: {},
        },
        credentials: { googleSheetsOAuth2Api: SHEETS_CRED },
      },
      {
        id: 'resp1',
        name: 'Return Spreadsheet Info',
        type: 'n8n-nodes-base.respondToWebhook',
        typeVersion: 1.1,
        position: [880, 0],
        parameters: { options: {} },
      },
    ],
    connections: {
      'Setup Trigger': {
        main: [[{ node: 'Create Finance OS Spreadsheet', type: 'main', index: 0 }]],
      },
      'Create Finance OS Spreadsheet': {
        main: [[{ node: 'Build Sample Data', type: 'main', index: 0 }]],
      },
      'Build Sample Data': {
        main: [[{ node: 'Seed All 4 Tabs', type: 'main', index: 0 }]],
      },
      'Seed All 4 Tabs': {
        main: [[{ node: 'Return Spreadsheet Info', type: 'main', index: 0 }]],
      },
    },
  };
}

function aggregatorWorkflow(spreadsheetId) {
  const batchGetUrl =
    'https://sheets.googleapis.com/v4/spreadsheets/' +
    spreadsheetId +
    '/values:batchGet?ranges=Transactions&ranges=Accounts&ranges=Goals&ranges=Assets&valueRenderOption=UNFORMATTED_VALUE';
  return {
    name: 'finance-data-aggregator',
    settings: { executionOrder: 'v1', timezone: 'Asia/Dhaka' },
    nodes: [
      {
        id: 'note1',
        name: 'Overview',
        type: 'n8n-nodes-base.stickyNote',
        typeVersion: 1,
        position: [-80, -260],
        parameters: {
          content:
            '## Finance Data Aggregator (Workflow 1)\nCalled by the Next.js dashboard via GET /api/dashboard. Reads all 4 tabs of the Finance OS Google Sheet in one batch call, computes every metric in the Code node, and responds with DashboardData JSON.\n\nRule: ALL financial math lives in the Code node. The AI (OpenAI) never computes numbers.',
          height: 240,
          width: 520,
          color: 4,
        },
      },
      {
        id: 'wh1',
        name: 'Dashboard Request',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 2,
        position: [0, 0],
        parameters: {
          httpMethod: 'GET',
          path: 'finance-dashboard',
          responseMode: 'responseNode',
          options: {},
        },
      },
      {
        id: 'http1',
        name: 'Read All 4 Sheet Tabs',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4.2,
        position: [220, 0],
        parameters: {
          url: batchGetUrl,
          authentication: 'predefinedCredentialType',
          nodeCredentialType: 'googleSheetsOAuth2Api',
          options: {},
        },
        credentials: { googleSheetsOAuth2Api: SHEETS_CRED },
      },
      {
        id: 'code1',
        name: 'Compute Dashboard Metrics',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [440, 0],
        parameters: { jsCode: AGG_CODE },
      },
      {
        id: 'resp1',
        name: 'Return Dashboard JSON',
        type: 'n8n-nodes-base.respondToWebhook',
        typeVersion: 1.1,
        position: [660, 0],
        parameters: { options: {} },
      },
    ],
    connections: {
      'Dashboard Request': {
        main: [[{ node: 'Read All 4 Sheet Tabs', type: 'main', index: 0 }]],
      },
      'Read All 4 Sheet Tabs': {
        main: [[{ node: 'Compute Dashboard Metrics', type: 'main', index: 0 }]],
      },
      'Compute Dashboard Metrics': {
        main: [[{ node: 'Return Dashboard JSON', type: 'main', index: 0 }]],
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function callWebhook(method, p, attempts = 4) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    await sleep(2000);
    try {
      const r = await fetch(`${BASE}/webhook/${p}`, { method });
      const text = await r.text();
      if (!r.ok) throw new Error(`${r.status}: ${text}`);
      return JSON.parse(text);
    } catch (e) {
      lastErr = e;
      console.log(`  webhook attempt ${i + 1} failed: ${e.message}`);
    }
  }
  throw lastErr;
}

async function main() {
  const idFlag = process.argv.indexOf('--spreadsheet-id');
  let spreadsheetId = idFlag > -1 ? process.argv[idFlag + 1] : null;

  if (!spreadsheetId) {
    console.log('STEP 1: creating temporary sheet-setup workflow...');
    const helper = await api('POST', '/workflows', helperWorkflow());
    console.log(`  created workflow ${helper.id}`);
    try {
      await api('POST', `/workflows/${helper.id}/activate`);
      console.log('  activated; calling setup webhook...');
      const setup = await callWebhook('POST', 'finance-os-setup');
      spreadsheetId = setup.spreadsheetId;
      console.log(`  spreadsheet created: ${spreadsheetId}`);
      console.log(`  cells written: ${setup.totalUpdatedCells}`);
    } finally {
      await api('DELETE', `/workflows/${helper.id}`);
      console.log('  temporary workflow deleted');
    }
  } else {
    console.log(`STEP 1 skipped — using spreadsheet ${spreadsheetId}`);
  }

  console.log('STEP 2: creating finance-data-aggregator workflow...');
  const agg = await api('POST', '/workflows', aggregatorWorkflow(spreadsheetId));
  console.log(`  created workflow ${agg.id}`);
  await api('POST', `/workflows/${agg.id}/activate`);
  console.log('  activated');

  console.log('STEP 3: testing production webhook...');
  const data = await callWebhook('GET', 'finance-dashboard');

  const required = [
    'metrics', 'accountBalances', 'goals', 'assets',
    'recentTransactions', 'spendingByCategory', 'monthlyTrend',
  ];
  const missing = required.filter((k) => !(k in data));
  if (missing.length) throw new Error(`response missing keys: ${missing.join(', ')}`);

  const exported = await api('GET', `/workflows/${agg.id}`);
  fs.writeFileSync(
    path.join(__dirname, 'finance-data-aggregator.json'),
    JSON.stringify(exported, null, 2)
  );
  fs.writeFileSync(
    path.join(__dirname, 'sample-dashboard-response.json'),
    JSON.stringify(data, null, 2)
  );

  console.log('\n=== MILESTONE 2 DEPLOY OK ===');
  console.log(`spreadsheetId : ${spreadsheetId}`);
  console.log(`sheet URL     : https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
  console.log(`workflow id   : ${agg.id}`);
  console.log(`webhook URL   : ${BASE}/webhook/finance-dashboard`);
  console.log(`metrics       : ${JSON.stringify(data.metrics)}`);
  console.log(`trend months  : ${data.monthlyTrend.map((m) => m.month).join(', ')}`);
  console.log(`recent tx     : ${data.recentTransactions.length}, categories: ${data.spendingByCategory.length}`);
}

main().catch((e) => {
  console.error('\nDEPLOY FAILED:', e.message);
  process.exit(1);
});
