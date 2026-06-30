#!/usr/bin/env node
/**
 * Extends Workflow 3 (ai-chat-handler) with a second action the AI can take:
 * set_budget, alongside the existing log_transaction. Mirrors that pattern
 * exactly:
 *   Build OpenAI Messages: teaches the model the set_budget JSON schema
 *   Parse Intent: also recognizes set_budget and extracts { category, monthly_limit }
 *   Is Log Request? -> (false) -> Is Budget Request? (new IF) -> Set Budget via Workflow 9 (new HTTP) -> Build Budget Reply (new code) -> Return Chat Reply
 *
 * Requires the Workflow 9 Budgets-upsert patch (patch-budget-upsert.js) to
 * already be live, so re-setting an existing budget updates it instead of
 * 400ing — otherwise "budget with me" conversations could only set a
 * category's budget once, ever.
 */
require('dotenv').config({ path: process.env.HOME + '/.env' })
const BASE = 'https://asim.sg-node8n.serverdoor.com'
const KEY = process.env.N8N_API_KEY
if (!KEY) throw new Error('N8N_API_KEY not set in environment')
const WF3_ID = '5RkSgctHtRNq3mIR'

async function api(method, p, body) {
  const r = await fetch(`${BASE}/api/v1${p}`, {
    method,
    headers: { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!r.ok) throw new Error(`${method} ${p} -> ${r.status}: ${await r.text()}`)
  const text = await r.text()
  return text ? JSON.parse(text) : null
}

const buildMessagesCode = `
const req = $('Chat Message Received').first().json.body || {};
const message = String(req.message || '');
const history = Array.isArray(req.history) ? req.history.slice(-10) : [];
const dash = $json;
const today = DateTime.now().setZone('Asia/Dhaka').toFormat('yyyy-MM-dd');

const allCats = Array.isArray(dash.categories) ? dash.categories : [];
const expenseCats = allCats.filter(function (c) { return c.type === 'Expense'; }).map(function (c) { return c.name; }).join(', ') || 'Groceries, Food & Dining, Bills & Utilities, Rent / Housing, Transportation, Home Repair, Health & Medical, Date Night / Entertainment, Shopping & Personal, Education, Family & Gifts, Subscriptions, Savings & Investments, Debt Payment, Miscellaneous';
const incomeCats = allCats.filter(function (c) { return c.type === 'Income'; }).map(function (c) { return c.name; }).join(', ') || 'Salary, Freelance Income, Other Income';
const accounts = (dash.accountBalances || []).map(function (a) { return a.name; }).join(', ');
const existingBudgets = (dash.budgets || []).map(function (b) { return b.category + ': \\u09f3' + b.limit + '/mo'; }).join(', ') || 'none set yet';

const sys = [
  'You are Finance OS Assistant, the personal finance assistant for Asim. Currency is BDT (Bangladeshi Taka, symbol \\u09f3).',
  'Today is ' + today + '.',
  'Below is the pre-computed dashboard data (DATA). It was calculated deterministically — trust it completely.',
  'RULES:',
  '1. NEVER calculate, add, subtract, or derive new numbers. Only quote numbers that literally appear in DATA. If the answer needs math that is not already in DATA, say you only have the pre-computed figures and name the closest one.',
  '2. Keep replies short, plain, and friendly. Format amounts like \\u09f3,1,234.',
  '3. If the user asks to log, record, or add a transaction or expense/income, respond with ONLY this JSON and no other text:',
  '{"action":"log_transaction","transaction":{"date":"YYYY-MM-DD","type":"Income or Expense","category":"<pick one>","payee":"<who was paid or who paid>","amount":<number>,"account":"<pick one>","note":""}}',
  '   - Use today (' + today + ') unless another date is given.',
  '   - Expense categories: ' + expenseCats + '.',
  '   - Income categories: ' + incomeCats + '.',
  '   - Accounts: ' + accounts + '. Default to Cash if unclear.',
  '   - If payee is not mentioned, use a sensible short label from context.',
  '4. If the user wants to set, create, change, raise, lower, or update a monthly budget for a category, respond with ONLY this JSON and no other text:',
  '{"action":"set_budget","budget":{"category":"<pick one of the expense categories>","monthly_limit":<number>}}',
  '   - Only set budgets for expense categories: ' + expenseCats + '.',
  '   - Current budgets: ' + existingBudgets + '. Setting one that already exists updates its limit.',
  '   - If the user is just asking ABOUT a budget (how much is left, what is my limit) and not asking to change it, answer in plain text from DATA instead — do not emit JSON.',
  '   - If the user wants a full budget plan across many categories at once, walk through it conversationally one category at a time instead of guessing amounts — ask what they want for each category before emitting any set_budget JSON.',
  '5. For anything not about personal finance, politely steer back to finances.',
  'DATA: ' + JSON.stringify(dash)
].join('\\n');

const messages = [{ role: 'system', content: sys }];
for (const h of history) {
  if (h && (h.role === 'user' || h.role === 'assistant') && h.content) {
    messages.push({ role: h.role, content: String(h.content) });
  }
}
messages.push({ role: 'user', content: message });

return [{ json: { payload: { model: 'gpt-4o-mini', messages: messages, temperature: 0.3, max_tokens: 500 } } }];
`.trim()

const parseIntentCode = `
const res = $json;
let content = '';
try { content = res.choices[0].message.content || ''; } catch (e) { content = ''; }
let reply = String(content).trim();
let action = null;
let transaction = null;
let budget = null;

const BT = String.fromCharCode(96);
const FENCE = BT + BT + BT;
let cleaned = reply;
if (cleaned.indexOf(FENCE) === 0) {
  cleaned = cleaned.slice(cleaned.indexOf('\\n') + 1);
  const endFence = cleaned.lastIndexOf(FENCE);
  if (endFence !== -1) cleaned = cleaned.slice(0, endFence);
  cleaned = cleaned.trim();
}

if (cleaned.indexOf('"action"') !== -1) {
  try {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    const obj = JSON.parse(cleaned.slice(start, end + 1));
    if (obj.action === 'log_transaction' && obj.transaction) {
      action = 'log_transaction';
      transaction = obj.transaction;
      reply = 'Logging your transaction now...';
    } else if (obj.action === 'set_budget' && obj.budget && obj.budget.category) {
      action = 'set_budget';
      budget = obj.budget;
      reply = 'Setting your budget now...';
    }
  } catch (e) { /* not valid action JSON — treat as plain reply */ }
}

if (!reply) reply = 'AI temporarily unavailable';
return [{ json: { reply: reply, action: action, transaction: transaction, budget: budget } }];
`.trim()

const setBudgetReplyCode = `
const intent = $('Parse Intent').first().json;
const res = $json;
const status = Number(res.statusCode || 0);
const body = res.body || {};
const b = intent.budget || {};
const ok = status >= 200 && status < 300 && body.success === true;
let reply;
if (ok) {
  reply = 'Budget set: \\u09f3' + b.monthly_limit + '/month for ' + b.category + '.';
} else {
  const why = (body && body.error) ? body.error : ('budget service returned status ' + status);
  reply = "I couldn't set that budget — " + why + '. Nothing was changed.';
}
return [{ json: { reply: reply, action: intent.action, budget: b, ok: ok } }];
`.trim()

;(async () => {
  const wf = await api('GET', `/workflows/${WF3_ID}`)

  const byName = (name) => wf.nodes.find((n) => n.name === name)
  byName('Build OpenAI Messages').parameters.jsCode = buildMessagesCode
  byName('Parse Intent').parameters.jsCode = parseIntentCode

  const newNodes = [
    {
      id: 'if2', name: 'Is Budget Request?', type: 'n8n-nodes-base.if', typeVersion: 2, position: [1100, 160],
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
          conditions: [{ id: 'c3', leftValue: '={{ $json.action === "set_budget" }}', rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }],
          combinator: 'and',
        },
        options: {},
      },
    },
    {
      id: 'http4', name: 'Set Budget via Workflow 9', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [1320, 160],
      parameters: {
        method: 'POST',
        url: 'https://asim.sg-node8n.serverdoor.com/webhook/finance-create',
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ tab: "Budgets", values: [$json.budget.category, $json.budget.monthly_limit] }) }}',
        options: { timeout: 15000, response: { response: { neverError: true, fullResponse: true } } },
      },
    },
    {
      id: 'code4', name: 'Build Budget Reply', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1540, 160],
      parameters: { jsCode: setBudgetReplyCode },
    },
  ]
  wf.nodes.push(...newNodes)

  wf.connections['Is Log Request?'].main[1] = [{ node: 'Is Budget Request?', type: 'main', index: 0 }]
  wf.connections['Is Budget Request?'] = {
    main: [
      [{ node: 'Set Budget via Workflow 9', type: 'main', index: 0 }],
      [{ node: 'Return Chat Reply', type: 'main', index: 0 }],
    ],
  }
  wf.connections['Set Budget via Workflow 9'] = { main: [[{ node: 'Build Budget Reply', type: 'main', index: 0 }]] }
  wf.connections['Build Budget Reply'] = { main: [[{ node: 'Return Chat Reply', type: 'main', index: 0 }]] }

  await api('PUT', `/workflows/${WF3_ID}`, { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings })
  console.log('Workflow 3 patched with set_budget action.')

  console.log('Testing: ask the chat to set a budget...')
  const r = await fetch(`${BASE}/webhook/finance-chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Set my Education budget to 999 taka a month', history: [] }),
  })
  console.log('status:', r.status)
  console.log(await r.text())
})().catch((e) => {
  console.error('FAILED:', e.message)
  process.exit(1)
})
