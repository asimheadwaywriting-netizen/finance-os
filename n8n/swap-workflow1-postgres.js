#!/usr/bin/env node
/**
 * Swaps Workflow 1 (finance-data-aggregator) from Google Sheets to Postgres.
 * Replaces "Read All 4 Sheet Tabs" (Sheets batchGet) with a single Postgres
 * query that returns all 6 tables pre-aggregated as JSON arrays. The Code
 * node keeps the exact same math, just reads already-keyed objects instead
 * of raw [headers, ...rows] arrays.
 */
const BASE = 'https://asim.sg-node8n.serverdoor.com';
const KEY = process.env.N8N_API_KEY;
if (!KEY) throw new Error('N8N_API_KEY not set in environment');
const WF1_ID = '8GejOtDtsht0CfEJ';
const PG_CRED = { id: 'NVJk0SsDUL8En4zV', name: 'Postgres account' };

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

const aggregateQuery = `
SELECT
  (SELECT COALESCE(json_agg(json_build_object(
    'date', to_char(date,'YYYY-MM-DD'), 'type', type, 'category', category,
    'payee', payee, 'amount', amount, 'account', account, 'note', note
  )), '[]') FROM transactions) AS transactions,
  (SELECT COALESCE(json_agg(json_build_object(
    'account_name', account_name, 'starting_balance', starting_balance,
    'as_of_date', to_char(as_of_date,'YYYY-MM-DD')
  )), '[]') FROM accounts) AS accounts,
  (SELECT COALESCE(json_agg(json_build_object(
    'goal_name', goal_name, 'target_amount', target_amount, 'saved_so_far', saved_so_far,
    'monthly_contribution', monthly_contribution, 'priority', priority
  )), '[]') FROM goals) AS goals,
  (SELECT COALESCE(json_agg(json_build_object(
    'asset_name', asset_name, 'type', type, 'value', value, 'institution', institution,
    'maturity_date', to_char(maturity_date,'YYYY-MM-DD'), 'interest_rate', interest_rate
  )), '[]') FROM assets) AS assets,
  (SELECT COALESCE(json_agg(json_build_object('name', name, 'type', type, 'color', color)), '[]') FROM categories) AS categories,
  (SELECT COALESCE(json_agg(json_build_object('category', category, 'monthly_limit', monthly_limit)), '[]') FROM budgets) AS budgets;
`.trim();

const computeJsCode = `
const transactions = $json.transactions || [];
const accounts = $json.accounts || [];
const goals = $json.goals || [];
const assets = $json.assets || [];
const categoriesRaw = $json.categories || [];
const budgetsRaw = $json.budgets || [];

function toISO(d) {
  if (typeof d === 'number') return new Date(Math.round((d - 25569) * 86400000)).toISOString().slice(0, 10);
  return String(d || '').slice(0, 10);
}

const txs = transactions.map(function (t) {
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
const accountsStartingTotal = accounts.reduce(function (s, a) { return s + (Number(a.starting_balance) || 0); }, 0);
const categories = categoriesRaw.map(function (c) { return { name: String(c.name || ''), type: c.type === 'Income' ? 'Income' : 'Expense', color: String(c.color || '#6b7280') }; });

const today = DateTime.now().setZone('Asia/Dhaka');
const ym = today.toFormat('yyyy-MM');

const curr = txs.filter(function (t) { return t.date.indexOf(ym) === 0; });
const income = curr.filter(function (t) { return t.type === 'Income'; }).reduce(function (s, t) { return s + t.amount; }, 0);
const expenses = curr.filter(function (t) { return t.type === 'Expense'; }).reduce(function (s, t) { return s + t.amount; }, 0);
const net = income - expenses;
const goalContrib = goals.reduce(function (s, g) { return s + (Number(g.monthly_contribution) || 0); }, 0);
const daysLeftInMonth = today.daysInMonth - today.day;

const accountBalances = accounts.map(function (a) {
  const name = String(a.account_name || '');
  const asOf = a.as_of_date ? toISO(a.as_of_date) : '';
  const delta = txs.reduce(function (s, t) {
    if (t.account !== name) return s;
    if (asOf && t.date <= asOf) return s;
    return s + (t.type === 'Income' ? t.amount : -t.amount);
  }, 0);
  const bal = (Number(a.starting_balance) || 0) + delta;
  return { name: name, balance: bal < 0 ? 0 : bal };
});
const safeToSpend = Math.max(0, accountBalances.reduce(function (s, a) { return s + a.balance; }, 0) - goalContrib);

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

const byDay = {};
curr.forEach(function (t) {
  const dd = t.date.slice(8, 10);
  if (!byDay[dd]) byDay[dd] = { income: 0, expenses: 0 };
  byDay[dd][t.type === 'Income' ? 'income' : 'expenses'] += t.amount;
});
const daysToShow = Math.min(today.daysInMonth, today.day);
const dailyTrend = [];
for (let i = 1; i <= daysToShow; i++) {
  const k = String(i).padStart(2, '0');
  const e = byDay[k] || { income: 0, expenses: 0 };
  dailyTrend.push({ day: String(i), income: e.income, expenses: e.expenses });
}
const budgets = budgetsRaw.map(function (b) {
  const cat = String(b.category || '');
  const limit = Number(b.monthly_limit) || 0;
  const spent = catTotals[cat] || 0;
  return { category: cat, limit: limit, spent: spent, remaining: limit - spent, pct: limit > 0 ? Math.round((spent / limit) * 100) : 0 };
});
return [{ json: {
  metrics: { income: income, expenses: expenses, net: net, safeToSpend: safeToSpend, daysLeftInMonth: daysLeftInMonth, accountsStartingTotal: accountsStartingTotal },
  accountBalances: accountBalances,
  goals: goalsOut,
  assets: assetsOut,
  recentTransactions: recentTransactions,
  spendingByCategory: spendingByCategory,
  monthlyTrend: monthlyTrend,
  dailyTrend: dailyTrend,
  categories: categories,
  budgets: budgets
} }];
`.trim();

const nodes = [
  {
    id: 'note1', name: 'Overview', type: 'n8n-nodes-base.stickyNote', typeVersion: 1, position: [-80, -260],
    parameters: {
      content: '## Finance Data Aggregator (Workflow 1)\nCalled by the Next.js dashboard via GET /api/dashboard. Reads all 6 Postgres tables in one query, computes every metric in the Code node, and responds with DashboardData JSON.\n\nRule: ALL financial math lives in the Code node. The AI (OpenAI) never computes numbers.',
      height: 240, width: 520, color: 4,
    },
  },
  {
    id: 'wh1', name: 'Dashboard Request', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, 0],
    parameters: { httpMethod: 'GET', path: 'finance-dashboard', responseMode: 'responseNode', options: {} },
    webhookId: '62be05c5-5018-4168-88b5-4d477b16ceb0',
  },
  {
    id: 'pg1', name: 'Read From Postgres', type: 'n8n-nodes-base.postgres', typeVersion: 2.5, position: [220, 0],
    parameters: { operation: 'executeQuery', query: aggregateQuery, options: {} },
    credentials: { postgres: PG_CRED },
  },
  {
    id: 'code1', name: 'Compute Dashboard Metrics', type: 'n8n-nodes-base.code', typeVersion: 2, position: [440, 0],
    parameters: { jsCode: computeJsCode },
  },
  {
    id: 'resp1', name: 'Return Dashboard JSON', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [660, 0],
    parameters: { options: {} },
  },
];

const connections = {
  'Dashboard Request': { main: [[{ node: 'Read From Postgres', type: 'main', index: 0 }]] },
  'Read From Postgres': { main: [[{ node: 'Compute Dashboard Metrics', type: 'main', index: 0 }]] },
  'Compute Dashboard Metrics': { main: [[{ node: 'Return Dashboard JSON', type: 'main', index: 0 }]] },
};

(async () => {
  const before = await api('GET', `/workflows/${WF1_ID}`);
  console.log('Current workflow active:', before.active);

  await api('PUT', `/workflows/${WF1_ID}`, {
    name: before.name,
    nodes,
    connections,
    settings: before.settings,
  });
  console.log('Updated workflow 1 to use Postgres.');

  const after = await api('GET', `/workflows/${WF1_ID}`);
  if (!after.active) {
    await api('POST', `/workflows/${WF1_ID}/activate`);
    console.log('Re-activated.');
  } else {
    console.log('Still active.');
  }

  console.log('Calling live dashboard webhook to verify...');
  const res = await fetch(`${BASE}/webhook/finance-dashboard`);
  const body = await res.json();
  console.log('Status:', res.status);
  console.log(JSON.stringify(body, null, 2));
})().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
