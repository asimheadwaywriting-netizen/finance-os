#!/usr/bin/env node
/**
 * Milestone 7 deploy script.
 *
 * Extends Workflow 3 (ai-chat-handler, ID 5RkSgctHtRNq3mIR) so that when the
 * model returns action=log_transaction the workflow actually logs it:
 *
 *   Parse Intent -> Is Log Request?
 *     true  -> Log via Workflow 2 (POST /webhook/finance-transaction)
 *           -> Build Logged Reply -> Return Chat Reply
 *     false -> Return Chat Reply
 *   Return Chat Reply -> Email Confirmation? -> Send Confirmation Email (Gmail)
 *
 * The Gmail node runs AFTER the webhook response so email latency/failure can
 * never delay or break the chat reply (it also has onError: continue).
 *
 * Then tests live:
 *   1. A question still answers correctly (no regression).
 *   2. "Log a 10 taka ... expense" -> "Logged: ..." reply.
 *   3. Row visible via the dashboard aggregator.
 *   4. Cleans up the test row with a temporary helper workflow.
 *   5. Exports the updated workflow JSON to this folder.
 *
 * Reads N8N_API_URL / N8N_API_KEY from Claude Code settings — never hardcoded.
 *
 * Usage: node deploy-milestone7.js
 */

const fs = require('fs');
const path = require('path');

const settings = JSON.parse(
  fs.readFileSync('C:/Users/User/.claude/settings.json', 'utf8')
);
const { N8N_API_URL: BASE, N8N_API_KEY: KEY } =
  settings.mcpServers['n8n-mcp'].env;

const CHAT_WF_ID = '5RkSgctHtRNq3mIR';
const SHEETS_CRED = { id: 'eo7uMjjFUzvjTAGi', name: 'Google Sheets account' };
const GMAIL_CRED = { id: '0KVFYj5t0Jons8bA', name: 'Gmail account' };
const SPREADSHEET_ID = '16vNm0PPxV-OP1Kp_INOKiBz33YcL-ZkowAyRw7HnwcI';
const EMAIL_TO = 'asim.headwaywriting@gmail.com';
const TEST_PAYEE = 'M7-TEST-ROW';

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

async function callWebhook(method, p, body, attempts = 4) {
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
// New node code
// ---------------------------------------------------------------------------
const BUILD_LOGGED_REPLY_CODE = `
const intent = $('Parse Intent').first().json;
const res = $json;
const status = Number(res.statusCode || 0);
const body = res.body || {};
const tx = (body && body.transaction) || intent.transaction || {};
const logged = status >= 200 && status < 300 && body.success === true;
let reply;
if (logged) {
  reply = 'Logged: ' + tx.type + ' of \\u09f3' + tx.amount + ' \\u2014 ' + tx.category +
    ' via ' + tx.account + ' on ' + tx.date + ' (payee: ' + tx.payee +
    '). A confirmation email is on its way.';
} else {
  const why = (body && body.error) ? body.error : ('logger returned status ' + status);
  reply = "I couldn't log that transaction \\u2014 " + why + '. Nothing was written.';
}
return [{ json: { reply: reply, action: intent.action, transaction: tx, logged: logged } }];
`.trim();

function buildNewNodes() {
  return [
    {
      id: 'if1',
      name: 'Is Log Request?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2,
      position: [1100, 0],
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
          conditions: [
            {
              id: 'c1',
              leftValue: '={{ $json.action === "log_transaction" }}',
              rightValue: '',
              operator: { type: 'boolean', operation: 'true', singleValue: true },
            },
          ],
          combinator: 'and',
        },
        options: {},
      },
    },
    {
      id: 'http3',
      name: 'Log via Workflow 2',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [1320, -120],
      parameters: {
        method: 'POST',
        url: `${BASE}/webhook/finance-transaction`,
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify($json.transaction) }}',
        options: {
          timeout: 15000,
          response: { response: { neverError: true, fullResponse: true } },
        },
      },
    },
    {
      id: 'code3',
      name: 'Build Logged Reply',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1540, -120],
      parameters: { jsCode: BUILD_LOGGED_REPLY_CODE },
    },
    {
      id: 'if2',
      name: 'Email Confirmation?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2,
      position: [1980, 0],
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
          conditions: [
            {
              id: 'c1',
              leftValue: '={{ $json.logged === true }}',
              rightValue: '',
              operator: { type: 'boolean', operation: 'true', singleValue: true },
            },
          ],
          combinator: 'and',
        },
        options: {},
      },
    },
    {
      id: 'gmail1',
      name: 'Send Confirmation Email',
      type: 'n8n-nodes-base.gmail',
      typeVersion: 2.1,
      position: [2200, -120],
      onError: 'continueRegularOutput',
      parameters: {
        sendTo: EMAIL_TO,
        subject:
          '=Finance OS: {{ $json.transaction.type }} ৳{{ $json.transaction.amount }} logged ({{ $json.transaction.category }})',
        emailType: 'text',
        message:
          '=Logged via Finance OS chat:\n\nDate: {{ $json.transaction.date }}\nType: {{ $json.transaction.type }}\nCategory: {{ $json.transaction.category }}\nPayee: {{ $json.transaction.payee }}\nAmount: ৳{{ $json.transaction.amount }}\nAccount: {{ $json.transaction.account }}\nNote: {{ $json.transaction.note || "-" }}',
        options: { appendAttribution: false },
      },
      credentials: { gmailOAuth2: GMAIL_CRED },
    },
  ];
}

const STICKY_M7 = `## AI Chat Handler (Workflow 3)
Called by the dashboard via POST /api/chat with { message, history }. Fetches the live pre-computed dashboard JSON from Workflow 1, hands it to OpenAI (gpt-4o-mini) with a strict system prompt, and parses the response.

Rule: the AI never computes numbers — it only quotes Workflow 1 output.

Milestone 7: when the model returns action=log_transaction, the transaction is POSTed to Workflow 2 (transaction-logger), the chat reply confirms the result, and a Gmail confirmation is sent AFTER the webhook response (email problems can never break the chat).`;

// ---------------------------------------------------------------------------
// Temporary cleanup helper: deletes the LAST row of the Transactions tab
// (same pattern as deploy-milestone5.js)
// ---------------------------------------------------------------------------
const CLEANUP_CODE = `
const meta = $('Get Sheet Meta').first().json;
const sheet = (meta.sheets || []).find(function (s) { return s.properties.title === 'Transactions'; });
if (!sheet) throw new Error('Transactions sheet not found');
const rows = ($json.values || []).length;
if (rows < 2) throw new Error('refusing to delete header row');
return [{ json: { body: { requests: [{ deleteDimension: { range: {
  sheetId: sheet.properties.sheetId, dimension: 'ROWS', startIndex: rows - 1, endIndex: rows
} } }] } } }];
`.trim();

function cleanupWorkflow() {
  const base = 'https://sheets.googleapis.com/v4/spreadsheets/' + SPREADSHEET_ID;
  const http = (id, name, pos, params) => ({
    id, name,
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: pos,
    parameters: {
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googleSheetsOAuth2Api',
      options: {},
      ...params,
    },
    credentials: { googleSheetsOAuth2Api: SHEETS_CRED },
  });
  return {
    name: 'Finance OS - Delete Last Transaction Row (temporary M7)',
    settings: { executionOrder: 'v1', timezone: 'Asia/Dhaka' },
    nodes: [
      {
        id: 'wh1', name: 'Cleanup Trigger', type: 'n8n-nodes-base.webhook', typeVersion: 2,
        position: [0, 0],
        parameters: { httpMethod: 'POST', path: 'finance-os-cleanup-m7', responseMode: 'responseNode', options: {} },
      },
      http('http1', 'Get Sheet Meta', [220, 0], { url: base + '?fields=sheets.properties' }),
      http('http2', 'Get Row Count', [440, 0], { url: base + '/values/Transactions!A:A' }),
      {
        id: 'code1', name: 'Build Delete Request', type: 'n8n-nodes-base.code', typeVersion: 2,
        position: [660, 0], parameters: { jsCode: CLEANUP_CODE },
      },
      http('http3', 'Delete Last Row', [880, 0], {
        method: 'POST',
        url: base + ':batchUpdate',
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify($json.body) }}',
      }),
      {
        id: 'resp1', name: 'Respond Done', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1,
        position: [1100, 0], parameters: { options: {} },
      },
    ],
    connections: {
      'Cleanup Trigger': { main: [[{ node: 'Get Sheet Meta', type: 'main', index: 0 }]] },
      'Get Sheet Meta': { main: [[{ node: 'Get Row Count', type: 'main', index: 0 }]] },
      'Get Row Count': { main: [[{ node: 'Build Delete Request', type: 'main', index: 0 }]] },
      'Build Delete Request': { main: [[{ node: 'Delete Last Row', type: 'main', index: 0 }]] },
      'Delete Last Row': { main: [[{ node: 'Respond Done', type: 'main', index: 0 }]] },
    },
  };
}

async function dashboardHasPayee(payee) {
  const r = await callWebhook('GET', 'finance-dashboard');
  return (r.json.recentTransactions || []).some((t) => t.payee === payee);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('STEP 1: fetching ai-chat-handler...');
  const wf = await api('GET', `/workflows/${CHAT_WF_ID}`);
  console.log(`  got "${wf.name}" (active=${wf.active}, ${wf.nodes.length} nodes)`);

  if (wf.nodes.some((n) => n.name === 'Is Log Request?')) {
    console.log('  M7 nodes already present — refusing to double-apply. Exiting.');
    process.exit(1);
  }

  console.log('STEP 2: extending workflow (IF -> log -> reply -> email)...');
  const nodes = wf.nodes.map((n) => {
    if (n.name === 'Overview') {
      return { ...n, parameters: { ...n.parameters, content: STICKY_M7, height: 300 } };
    }
    if (n.name === 'Parse Intent') {
      const jsCode = n.parameters.jsCode.replace(
        /reply = 'Ready to log:[\s\S]*?';/,
        "reply = 'Logging your transaction now...';"
      );
      if (jsCode === n.parameters.jsCode) throw new Error('Parse Intent reply patch did not match');
      return { ...n, parameters: { ...n.parameters, jsCode } };
    }
    if (n.name === 'Return Chat Reply') {
      return { ...n, position: [1760, 0] };
    }
    return n;
  });
  nodes.push(...buildNewNodes());

  const connections = { ...wf.connections };
  connections['Parse Intent'] = {
    main: [[{ node: 'Is Log Request?', type: 'main', index: 0 }]],
  };
  connections['Is Log Request?'] = {
    main: [
      [{ node: 'Log via Workflow 2', type: 'main', index: 0 }],
      [{ node: 'Return Chat Reply', type: 'main', index: 0 }],
    ],
  };
  connections['Log via Workflow 2'] = {
    main: [[{ node: 'Build Logged Reply', type: 'main', index: 0 }]],
  };
  connections['Build Logged Reply'] = {
    main: [[{ node: 'Return Chat Reply', type: 'main', index: 0 }]],
  };
  connections['Return Chat Reply'] = {
    main: [[{ node: 'Email Confirmation?', type: 'main', index: 0 }]],
  };
  connections['Email Confirmation?'] = {
    main: [[{ node: 'Send Confirmation Email', type: 'main', index: 0 }]],
  };

  await api('PUT', `/workflows/${CHAT_WF_ID}`, {
    name: wf.name,
    nodes,
    connections,
    settings: { executionOrder: 'v1', timezone: 'Asia/Dhaka' },
  });
  console.log('  updated');

  const after = await api('GET', `/workflows/${CHAT_WF_ID}`);
  if (!after.active) {
    await api('POST', `/workflows/${CHAT_WF_ID}/activate`);
    console.log('  re-activated');
  } else {
    console.log('  still active');
  }

  console.log('STEP 3: regression test — question still answers...');
  const q = await callWebhook('POST', 'finance-chat', {
    message: 'What did I spend on groceries this month?',
    history: [],
  });
  console.log(`  status=${q.status} reply="${q.json && q.json.reply}"`);
  if (q.status !== 200 || !/6,?400/.test(q.json.reply)) {
    throw new Error('regression: groceries question no longer answers with 6,400');
  }

  console.log('STEP 4: log test — chat command should write a row...');
  const log = await callWebhook('POST', 'finance-chat', {
    message: `Log a 10 taka Miscellaneous expense in Cash today. Payee is ${TEST_PAYEE}, note: deploy-milestone7 test, safe to delete.`,
    history: [],
  });
  console.log(`  status=${log.status} body=${log.text}`);
  if (log.status !== 200 || log.json.action !== 'log_transaction' || !/^Logged:/.test(log.json.reply)) {
    throw new Error('log command did not produce a "Logged:" reply');
  }

  console.log('STEP 5: verifying row via dashboard aggregator...');
  if (!(await dashboardHasPayee(TEST_PAYEE))) {
    throw new Error('test row not visible in aggregator output');
  }
  console.log('  row confirmed in Sheet');

  console.log('STEP 6: cleaning up test row (temporary helper workflow)...');
  const helper = await api('POST', '/workflows', cleanupWorkflow());
  await api('POST', `/workflows/${helper.id}/activate`);
  const cl = await callWebhook('POST', 'finance-os-cleanup-m7');
  console.log(`  cleanup status=${cl.status}`);
  await api('DELETE', `/workflows/${helper.id}`);
  if (await dashboardHasPayee(TEST_PAYEE)) {
    throw new Error('test row still present after cleanup');
  }
  console.log('  test row deleted, helper workflow removed');

  console.log('STEP 7: exporting workflow JSON...');
  const fin = await api('GET', `/workflows/${CHAT_WF_ID}`);
  fs.writeFileSync(
    path.join(__dirname, 'ai-chat-handler.json'),
    JSON.stringify(fin, null, 2)
  );
  console.log('  wrote n8n/ai-chat-handler.json');

  console.log('\nDONE. Check inbox for the confirmation email (subject "Finance OS: Expense ...").');
}

main().catch((e) => {
  console.error('\nFAILED:', e.message);
  process.exit(1);
});
