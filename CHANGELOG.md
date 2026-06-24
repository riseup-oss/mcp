# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-06-24

### Fixed

- More diagnostic env-var error messages: distinguishes `RISEUP_PAT` being
  unset vs empty-string vs wrong-format, and shows a safe prefix snippet
  of the received value to help spot copy-paste mistakes.
- `401` errors now include the tokens-page URL so a revoked-token user
  knows where to mint a new one.
- `403` errors now parse the response body and surface the missing scope
  detail when the upstream API provides it (e.g. `Missing scope:
  budget:read. Your token has: transactions:read.`). Falls back to the
  previous generic message when the body is empty or not JSON.

### Docs

- README link cleanup: the previous "RiseUp web app" link text invited
  readers to assume the URL was `app.riseup.co.il` (it's
  `input.riseup.co.il`). Replaced with a single unambiguous link to the
  tokens page.
- README + Claude Desktop config snippet: explicit "fully quit (Cmd+Q)
  and reopen" instruction. Closing the window isn't enough; the MCP
  process is started by Claude Desktop and only sees env vars from
  startup time, so PAT changes need a restart.

## [0.1.0] - 2026-06-24

Initial public release. Single tool `get_budget` for read-only access to
RiseUp monthly budget data via Personal Access Token authentication.
