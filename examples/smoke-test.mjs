#!/usr/bin/env node
// Smoke test: drives the local @riseup-oss/mcp build as a real MCP client, calls
// get_budget, and prints PII-safe signals about the response shape. Useful for
// verifying end-to-end (PAT → RiseUp API → back) without piping a real LLM
// into the loop.
//
// Usage:
//   RISEUP_PAT=riseup_pat_... [RISEUP_API_BASE=http://127.0.0.1:6040] \
//     node examples/smoke-test.mjs [--date=current|previous|YYYY-MM] [--show-body]
//
// Exits non-zero on connect failure, tool error, or invalid response.

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfigFromEnv } from '../dist/client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_ENTRY = resolve(__dirname, '..', 'dist', 'index.js');

function parseArgs(argv) {
  const args = { date: 'current', showBody: false, dumpFile: null, perEnvelope: false };
  for (const a of argv.slice(2)) {
    if (a.startsWith('--date=')) args.date = a.slice('--date='.length);
    else if (a === '--show-body') args.showBody = true;
    else if (a.startsWith('--dump-file=')) args.dumpFile = a.slice('--dump-file='.length);
    else if (a === '--per-envelope') args.perEnvelope = true;
    else if (a === '--help' || a === '-h') {
      console.log('Usage: node examples/smoke-test.mjs [--date=current|previous|YYYY-MM] [--show-body] [--dump-file=path] [--per-envelope]');
      process.exit(0);
    }
  }
  return args;
}

function summarizeBudget(body) {
  const topKeys = Object.keys(body);
  const envelopes = Array.isArray(body.envelopes) ? body.envelopes : [];
  const envelopeKeyUnion = new Set();
  const envelopeTypeCounts = {};
  let totalActuals = 0;
  let firstActualKeys = null;
  let detailsKeys = null;
  for (const env of envelopes) {
    Object.keys(env).forEach(k => envelopeKeyUnion.add(k));
    if (env.type) {
      envelopeTypeCounts[env.type] = (envelopeTypeCounts[env.type] || 0) + 1;
    }
    if (Array.isArray(env.actuals)) {
      totalActuals += env.actuals.length;
      if (!firstActualKeys && env.actuals.length > 0) {
        firstActualKeys = Object.keys(env.actuals[0]);
      }
    }
    if (!detailsKeys && env.details && typeof env.details === 'object') {
      detailsKeys = Object.keys(env.details);
    }
  }
  return {
    topKeys,
    envelopeCount: envelopes.length,
    envelopeKeyUnion: [...envelopeKeyUnion].sort(),
    envelopeTypeCounts,
    totalActualsAcrossEnvelopes: totalActuals,
    firstActualKeys,
    detailsKeysSample: detailsKeys,
  };
}

const args = parseArgs(process.argv);

if (!process.env.RISEUP_API_BASE) {
  // Default to IPv4 — Node 18 fetch resolves localhost to ::1 first and Express
  // usually binds to 0.0.0.0, so 'localhost' fails ECONNREFUSED.
  process.env.RISEUP_API_BASE = 'http://127.0.0.1:6040';
}

// Centralized config — validates PAT shape, validates URL, enforces HTTPS for
// non-loopback, warns on non-riseup.co.il hosts. Same code the MCP itself
// runs at startup.
let config;
try {
  config = loadConfigFromEnv();
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}

console.log(`api base  : ${config.apiBase}`);
console.log(`mcp entry : ${SERVER_ENTRY}`);
console.log(`date arg  : ${args.date}`);

const transport = new StdioClientTransport({
  command: 'node',
  args: [SERVER_ENTRY],
  env: { ...process.env, RISEUP_API_BASE: config.apiBase },
});

const client = new Client({ name: 'riseup-mcp-smoke', version: '0.0.0' });

try {
  await client.connect(transport);
} catch (e) {
  console.error(`mcp connect failed: ${e.message ?? e}`);
  process.exit(2);
}

const { tools } = await client.listTools();
console.log(`tools     : ${tools.map(t => t.name).join(', ')}`);

let toolResult;
try {
  toolResult = await client.callTool({
    name: 'get_budget',
    arguments: { date: args.date },
  });
} catch (e) {
  console.error(`get_budget threw: ${e.message ?? e}`);
  await client.close();
  process.exit(3);
}

const text = toolResult?.content?.[0]?.text;

if (toolResult?.isError) {
  console.error('get_budget returned isError=true:');
  console.error(text ?? '(no body)');
  await client.close();
  process.exit(4);
}

if (typeof text !== 'string') {
  console.error('unexpected response shape — no text content');
  console.error(JSON.stringify(toolResult, null, 2));
  await client.close();
  process.exit(5);
}

console.log(`bytes     : ${text.length}`);

if (args.dumpFile) {
  writeFileSync(args.dumpFile, text);
  console.log(`dumped    : ${args.dumpFile} (${text.length} bytes) — inspect locally, do not paste back here`);
}

if (args.showBody) {
  console.log('body      :');
  console.log(text);
} else {
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    console.log('body      : (not JSON — first 200 chars)');
    console.log(text.slice(0, 200));
    await client.close();
    process.exit(0);
  }
  console.log('shape     :');
  console.log(JSON.stringify(summarizeBudget(body), null, 2));
  if (args.perEnvelope && Array.isArray(body.envelopes)) {
    console.log('envelopes :');
    body.envelopes.forEach((env, i) => {
      const actuals = Array.isArray(env.actuals) ? env.actuals.length : 0;
      console.log(`  [${String(i).padStart(2, ' ')}] type=${env.type ?? '?'}, actuals=${actuals}, hasDetails=${!!env.details}, hasComment=${!!env.sequenceCustomerComment}`);
    });
  }
}

await client.close();
