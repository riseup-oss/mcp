#!/usr/bin/env node
// Fetches /api/external/budget/:date for local inspection. Writes the JSON
// response to stdout so you can redirect, pipe to jq, save to a file — whatever.
// Status lines go to stderr so the JSON pipe stays clean.
//
// Usage:
//   RISEUP_PAT=riseup_pat_... [RISEUP_API_BASE=http://127.0.0.1:6040] \
//     node examples/fetch-budget.mjs [date]
//
//   date defaults to 'current'. Accepts 'current', 'previous', or 'YYYY-MM'.
//
// Examples:
//   node examples/fetch-budget.mjs > /tmp/budget.json
//   node examples/fetch-budget.mjs 2026-05 | jq '.envelopes | length'
//   node examples/fetch-budget.mjs current | jq '.envelopes[] | {type, actuals: (.actuals // [] | length)}'

import { loadConfigFromEnv, riseupGet } from '../dist/client.js';

const date = process.argv[2] ?? 'current';

if (!process.env.RISEUP_API_BASE) {
  // Default to IPv4 — Node 18 fetch resolves localhost to ::1 first and
  // Express usually binds to 0.0.0.0, so 'localhost' fails ECONNREFUSED.
  process.env.RISEUP_API_BASE = 'http://127.0.0.1:6040';
}

const config = loadConfigFromEnv();
process.stderr.write(`Fetching ${config.apiBase}/api/external/budget/${date}\n`);

try {
  const budget = await riseupGet(config, `/api/external/budget/${encodeURIComponent(date)}`);
  process.stdout.write(JSON.stringify(budget, null, 2));
  process.stdout.write('\n');
} catch (e) {
  process.stderr.write(`Error: ${(e instanceof Error ? e.message : String(e))}\n`);
  process.exit(1);
}
