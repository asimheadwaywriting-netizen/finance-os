#!/usr/bin/env node
/**
 * Milestone 6 deploy script (Claude Code half).
 *
 * Creates + activates Workflow 3 (ai-chat-handler):
 *   POST webhook -> fetch live dashboard JSON (Workflow 1) -> build OpenAI
 *   messages (system prompt with pre-computed data) -> gpt-4o-mini ->
 *   parse intent (plain answer vs log_transaction JSON) -> respond.
 *
 * Rule enforced by the system prompt: the AI NEVER computes numbers — it only
 * quotes the pre-computed values from Workflow 1's JSON.
 *
 * Tests: a budget question (expects an answer quoting live data) and a
 * "log a transaction" request (expects parsed action JSON; actual logging
 * is wired in Milestone 7).
 *
 * Usage: node deploy-milestone6.js
 */

const fs = require('fs');
const path = require('path');

const settings = JSON.parse(
  fs.readFileSync('C:/Users/User/.claude/settings.json', 'utf8')
);
const { N8N_API_URL: BASE, N8N_API_KEY: KEY } =
  settings.mcpServers['n8n-mcp'].env;

const OPENAI_CRED = { id: '9L3j2utOyiBJWa9S', name: 'OpenAi account' };

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

async function callWebhook(method, p, body, attempts = 3) {
  let last;
  for (let i = 0; i < attempts; i++) {
    await sleep(2000);
    try {
      const r = await fetch(`${BASE}/webhook/${p}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await r.text();
      let json = null;
      try { json = JSON.parse(text); } catch {}
      return { status: r.status, json, text };
    } catch (e) {
      last = e;
      console.log(`  webhook attempt ${i + 1} failed: ${e.message}`);
    }
  }
  throw last;
}

// ---------------------------------------------------------------------------
// Build OpenAI messages (Code node) — system prompt + history + user message
// ---------------------------------------------------------------------------
const BUILD_MESSAGES_CODE = `
const req = $('Chat Message Received').first().json.body || {};
const message = String(req.message || '');
const history = Array.isArray(req.history) ? req.history.slice(-10) : [];
const dash = $json;
const today = DateTime.now().setZone('Asia/Dhaka').toFormat('yyyy-MM-dd');

const expenseCats = 'Groceries, Food & Dining, Bills & Utilities, Rent / Housing, Transportation, Home Repair, Health & Medical, Date Night / Entertainment, Shopping & Personal, Education, Family & Gifts, Subscriptions, Savings & Investments, Debt Payment, Miscellaneous';
const incomeCats = 'Salary, Freelance Income, Other Income';
const accounts = (dash.accountBalances || []).map(function (a) { return a.name; }).join(', ');

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
  '4. For anything not about personal finance, politely steer back to finances.',
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
`.trim();

// ---------------------------------------------------------------------------
// Parse intent (Code node) — plain reply vs log_transaction action
// ---------------------------------------------------------------------------
const PARSE_INTENT_CODE = `
const res = $json;
let content = '';
try { content = res.choices[0].message.content || ''; } catch (e) { content = ''; }
let reply = String(content).trim();
let action = null;
let transaction = null;

// Strip markdown code fences if the model wrapped its JSON
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
      reply = 'Ready to log: ' + transaction.type + ' of ' + transaction.amount +
        ' BDT — ' + transaction.category + ', payee ' + transaction.payee +
        ', via ' + transaction.account + ' on ' + transaction.date +
        '. (Auto-logging activates in Milestone 7.)';
    }
  } catch (e) { /* not valid action JSON — treat as plain reply */ }
}

if (!reply) reply = 'AI temporarily unavailable';
return [{ json: { reply: reply, action: action, transaction: transaction } }];
`.trim();

// ---------------------------------------------------------------------------
// Workflow 3: ai-chat-handler
// ---------------------------------------------------------------------------
function chatHandlerWorkflow() {
  return {
    name: 'ai-chat-handler',
    settings: { executionOrder: 'v1', timezone: 'Asia/Dhaka' },
    nodes: [
      {
        id: 'note1',
        name: 'Overview',
        type: 'n8n-nodes-base.stickyNote',
        typeVersion: 1,
        position: [-80, -280],
        parameters: {
          content:
            '## AI Chat Handler (Workflow 3)\nCalled by the dashboard via POST /api/chat with { message, history }. Fetches the live pre-computed dashboard JSON from Workflow 1, hands it to OpenAI (gpt-4o-mini) with a strict system prompt, and parses the response.\n\nRule: the AI never computes numbers — it only quotes Workflow 1 output.\n\nIf the user asks to log a transaction, the model returns action JSON which is parsed here. Actual logging is wired in Milestone 7.',
          height: 280,
          width: 540,
          color: 4,
        },
      },
      {
        id: 'wh1',
        name: 'Chat Message Received',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 2,
        position: [0, 0],
        parameters: {
          httpMethod: 'POST',
          path: 'finance-chat',
          responseMode: 'responseNode',
          options: {},
        },
      },
      {
        id: 'http1',
        name: 'Get Live Dashboard Data',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4.2,
        position: [220, 0],
        parameters: {
          url: BASE + '/webhook/finance-dashboard',
          options: { timeout: 15000 },
        },
      },
      {
        id: 'code1',
        name: 'Build OpenAI Messages',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [440, 0],
        parameters: { jsCode: BUILD_MESSAGES_CODE },
      },
      {
        id: 'http2',
        name: 'Ask OpenAI (gpt-4o-mini)',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4.2,
        position: [660, 0],
        parameters: {
          method: 'POST',
          url: 'https://api.openai.com/v1/chat/completions',
          authentication: 'predefinedCredentialType',
          nodeCredentialType: 'openAiApi',
          sendBody: true,
          specifyBody: 'json',
          jsonBody: '={{ JSON.stringify($json.payload) }}',
          options: { timeout: 30000 },
        },
        credentials: { openAiApi: OPENAI_CRED },
      },
      {
        id: 'code2',
        name: 'Parse Intent',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [880, 0],
        parameters: { jsCode: PARSE_INTENT_CODE },
      },
      {
        id: 'resp1',
        name: 'Return Chat Reply',
        type: 'n8n-nodes-base.respondToWebhook',
        typeVersion: 1.1,
        position: [1100, 0],
        parameters: { options: {} },
      },
    ],
    connections: {
      'Chat Message Received': {
        main: [[{ node: 'Get Live Dashboard Data', type: 'main', index: 0 }]],
      },
      'Get Live Dashboard Data': {
        main: [[{ node: 'Build OpenAI Messages', type: 'main', index: 0 }]],
      },
      'Build OpenAI Messages': {
        main: [[{ node: 'Ask OpenAI (gpt-4o-mini)', type: 'main', index: 0 }]],
      },
      'Ask OpenAI (gpt-4o-mini)': {
        main: [[{ node: 'Parse Intent', type: 'main', index: 0 }]],
      },
      'Parse Intent': {
        main: [[{ node: 'Return Chat Reply', type: 'main', index: 0 }]],
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('STEP 1: creating ai-chat-handler workflow...');
  const wf = await api('POST', '/workflows', chatHandlerWorkflow());
  console.log(`  created workflow ${wf.id}`);
  await api('POST', `/workflows/${wf.id}/activate`);
  console.log('  activated');

  console.log('STEP 2: testing budget question...');
  const q = await callWebhook('POST', 'finance-chat', {
    message: 'What did I spend on groceries this month?',
    history: [],
  });
  console.log(`  status=${q.status}`);
  console.log(`  reply: ${q.json && q.json.reply}`);
  if (q.status !== 200 || !q.json || !q.json.reply) throw new Error('chat question failed');
  const flat = q.json.reply.replace(/,/g, '');
  if (flat.indexOf('6400') === -1) {
    console.log('  WARNING: reply does not mention 6400 (June groceries) — check manually');
  } else {
    console.log('  confirmed: reply quotes the correct pre-computed figure (6,400)');
  }

  console.log('STEP 3: testing log-transaction intent...');
  const log = await callWebhook('POST', 'finance-chat', {
    message: 'Log a 500 taka transport expense on bKash today, payee CNG',
    history: [],
  });
  console.log(`  status=${log.status}`);
  console.log(`  reply: ${log.json && log.json.reply}`);
  console.log(`  action: ${log.json && log.json.action}`);
  console.log(`  transaction: ${log.json && JSON.stringify(log.json.transaction)}`);
  if (log.status !== 200 || !log.json || log.json.action !== 'log_transaction') {
    throw new Error('log intent was not parsed');
  }
  const t = log.json.transaction;
  if (Number(t.amount) !== 500 || t.account !== 'bKash' || t.type !== 'Expense') {
    throw new Error('parsed transaction fields look wrong: ' + JSON.stringify(t));
  }
  console.log('  confirmed: intent parsed with correct amount/account/type');

  const exported = await api('GET', `/workflows/${wf.id}`);
  fs.writeFileSync(
    path.join(__dirname, 'ai-chat-handler.json'),
    JSON.stringify(exported, null, 2)
  );

  console.log('\n=== MILESTONE 6 (n8n half) DEPLOY OK ===');
  console.log(`workflow id : ${wf.id}`);
  console.log(`webhook URL : ${BASE}/webhook/finance-chat`);
}

main().catch((e) => {
  console.error('\nDEPLOY FAILED:', e.message);
  process.exit(1);
});
