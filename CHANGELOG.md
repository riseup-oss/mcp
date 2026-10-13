# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-10-19

### Added

- New tool: `get_mortgages_data` (`mortgages:read`, a new scope) —
  mortgage balance, remaining interest and principal, monthly payment,
  parts (tracks), last month's mortgage payments in the cashflow, and
  potential savings with RiseUp's mortgage product. No input parameters.
  Backed by `/api/external/mortgages`.
- New tool: `get_current_bank_balances_data` (`balances:read`) — current
  balance per bank account with its last-updated time. Backed by
  `/api/external/balances/current`.
- New tool: `get_historical_bank_balances_data` (`balances:read`) — daily
  balances per account over the last 1–90 days with min / max / average.
  Backed by `/api/external/balances/history`.
- New tool: `get_benchmarks_data` (`benchmarks:read`, a new scope) —
  spending on eating out, groceries and electricity compared with similar
  customers. Backed by `/api/external/benchmarks`.
- `get_transactions` returns new fields per transaction:
  - `expenseType` — RiseUp's system-assigned expense type (independent of
    customer recategorization).
  - `isExcluded` — whether the transaction is excluded from the cashflow
    calculation.
  - `sequenceName` — the customer's name/comment for the recurring sequence
    the transaction belongs to.
  - `transactionCustomerComment` — the customer's comment on the transaction.
  - `paymentAppComment` / `paymentAppAddressee` — memo and counterparty of
    payment-app transfers (e.g. Bit, PayBox).
- `get_transactions` accepts `maxTransactions` (any positive integer,
  default 10000) to return only the latest N matching transactions by
  `transactionDate`.

### Changed

- `get_transactions` no longer returns bank-side credit-card bill payments
  (the individual card purchases they cover are already returned), so totals
  aren't double counted.
- `get_transactions` results are now ordered latest first by
  `transactionDate`.

### Security

- Comment and payment-app fields are sanitized server-side (HTML/code
  symbols stripped, control/invisible characters removed, capped at 40
  characters).
- The `get_transactions` description now tells the model to treat every
  free-text field — comments, payment-app memos, `businessName`,
  `accountNickname` — as untrusted data, never as instructions.

### Docs

- Reference pages for every endpoint behind a tool under
  `docs/reference/`, including a new
  [transactions reference](./docs/reference/transactions.md).
- README, quickstart, authentication and errors pages list every scope
  and the tools each one enables.

### Notes

- The new tools need scopes that existing tokens don't have
  (`balances:read`, `mortgages:read`, `benchmarks:read`). Scopes can't be
  added to a token — create a new one with the scopes you need.

## [0.3.1] - 2026-10-19

### Security

- Upgraded `@modelcontextprotocol/sdk` to 1.32.1, clearing all open
  advisories in the installed dependency tree, including a critical
  IP-spoofing issue in `proxy-addr` (GHSA-jqcg-44mw-7w3h). The affected
  packages belong to the SDK's HTTP transport, which this stdio server
  never loads, so none were exploitable here.

### Changed

- The MCP server now reports its correct version to clients (it was
  still reporting `0.2.0`).

### Notes

- Some transitive dependencies of the SDK declare Node 20+. The server
  still runs on Node 18, but `npm install` may print an `EBADENGINE`
  warning there.

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
