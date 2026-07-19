# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-07-19

### Added

- Both `get_transactions` and `get_budget` now expose `accountNumberHash`
  on every transaction / actual — a stable, opaque, per-account 6-character
  identifier. Same account → same hash across every response. Use to
  distinguish transactions from multiple accounts under the same `source`,
  e.g. two different Isracard cards on the same customer. Not a
  cryptographic hash and not the raw account number.

## [0.2.0] - 2026-07-12

### Added

- New tool: `get_transactions` — filter cashflow transactions by
  `cashflowMonth`, `transactionDate`, or `businessName` (case-insensitive
  substring). Backed by a new RiseUp API endpoint
  (`/api/external/transactions`) that queries stored transactions
  directly rather than reconstructing them from budgets — fast for
  targeted searches like "restaurant transactions in June". Same
  `budget:read` scope as `get_budget`; existing tokens work without
  change.

### Changed

- Extended `get_budget` tool description to document the response shape
  (envelope types, budget vs actuals, currency, date semantics). Same tool,
  same response — just clearer context for LLMs choosing when and how to
  use it, and for humans reading the tool schema.

### Notes

- `accountNickname` is included in `get_transactions` responses the same
  way as in `get_budget` — the backing endpoint enriches transactions
  with the customer's account nicknames. The field is absent when the
  customer hasn't set a nickname for the account.
- `transactionDate` and `billingDate` in `get_transactions` responses are
  ISO datetime strings (always UTC midnight, e.g.
  `2026-06-15T00:00:00.000Z`); the `transactionDate` *filter parameter*
  takes plain `YYYY-MM-DD`.

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
