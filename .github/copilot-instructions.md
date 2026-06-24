# Copilot Code Review Instructions — @riseup-oss/mcp

## Context

This repository is the **official RiseUp MCP server** — a small TypeScript package distributed via npm to end users (Claude Desktop, Base44, Claude Agent SDK, other MCP clients). It runs **on the user's machine**, holds the user's Personal Access Token in an environment variable, and calls the RiseUp Exposed API at `https://input.riseup.co.il/api/external/*` to fetch the user's own financial data.

Key facts that shape what feedback matters:

- **Internet-distributed package.** Anyone with the published npm package runs this code. A compromise here ships directly to customers.
- **Customer data passes through.** Budget / transactions / balances flow through this process. Anything that logs, persists, transmits to a third party, or otherwise leaks the response body is a serious finding.
- **PAT is a long-lived bearer secret.** Logging it, embedding it in errors, sending it to any host besides the configured `RISEUP_API_BASE`, or storing it on disk are critical issues.
- **Read-only API.** This package never mutates RiseUp state. Anything that looks like a write call (`POST`/`PUT`/`DELETE`/`PATCH`) is wrong unless explicitly for token management.
- **Tech stack:** TypeScript, ESM (`"type": "module"`), `@modelcontextprotocol/sdk`, `zod` for input schemas, `jest` (with `--experimental-vm-modules`) for tests, Node 18+.
- **Architecture:** stdio MCP server (`src/index.ts`) registers tools (`src/tools/*.ts`) that call a thin HTTP client (`src/client.ts`) which uses `fetch` against the RiseUp API. No DB, no caching, no telemetry.

## What feedback to share

Prioritize findings in roughly this order:

1. **Supply-chain / secrets.** Hardcoded PATs/keys; a `console.log` of headers or auth; a `fetch` to a host other than `RISEUP_API_BASE`; reading from `process.env` for anything beyond `RISEUP_PAT` and `RISEUP_API_BASE`; writing to disk; opening sockets; spawning subprocesses; adding dependencies that aren't widely used or maintained.
2. **Customer data hygiene.** Logging response bodies; including bodies in error messages; persisting fetched data; sending data anywhere besides the MCP client's stdio. The package should be transparent — request in, response out, nothing on disk.
3. **MCP protocol correctness.** Tool input schemas using `zod`; tool descriptions that are accurate (Claude reads them to pick which tool to call); return shape `{ content: [{ type: 'text', text }] }`; error returns set `isError: true` and put a useful message in `content[0].text`.
4. **Dependencies.** Carets (`^`) in `package.json` — we pin exact versions for supply-chain safety. New deps should be widely-used, recently-maintained, and necessary. Flag anything looking like name-squatting (`reqquest`, `lodahs`, etc.).
5. **Documentation accuracy.** `docs/` and `README.md` give end users curl examples that have to actually work. Wrong path, wrong header, stale env-var name → flag.
6. **Public API surface.** Anything exported from `src/index.ts` is part of our SDK contract. New top-level exports merit a note.
7. **Test coverage of the HTTP client** (`src/client.ts`). Auth header, error mapping (`401`/`403`/`429`), URL construction. Don't be precious about coverage of pure-data tool wrappers.

## What NOT to flag

- The `.github/` directory is **never published** — it's excluded from npm via `package.json`'s `files` whitelist (`["dist", "README.md"]`). Workflow files don't need the same scrutiny as runtime code.
- The `examples/` directory is similarly not published. Smoke-test scripts that hardcode `127.0.0.1:6040` for local-dev convenience are fine.
- The Hebrew comments / replies in PR threads are intentional — the team is bilingual.

## Concrete patterns to call out

- `import` from a path that isn't on the whitelist (`@modelcontextprotocol/sdk`, `zod`, Node built-ins, sibling files) → flag.
- A `fetch` call whose URL isn't built from `config.apiBase + '/api/external/*'` → flag.
- Any string that matches `riseup_pat_\w+` in source or fixtures → flag (use placeholder `riseup_pat_TEST_FIXTURE_*` patterns in tests).
- A tool description that says "this does X" but the implementation does Y → flag; LLMs pick tools by description.
- A new top-level `process.env.*` read → flag; env vars are part of the SDK contract.

## Severity calibration

Treat the following as **critical security** (block merge unless explicitly resolved):

- Cleartext PAT or response body in a log line.
- Network call to any host besides `RISEUP_API_BASE`.
- Filesystem write of any kind.
- Hardcoded credentials, even in tests.
- New dependency that isn't widely-used (skip the supply-chain check at your peril).

Everything else is normal review feedback — flag, suggest, but don't gate.
