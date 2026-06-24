# Budget endpoints

All endpoints require the `budget:read` scope. Send your PAT in the `Authorization` header:

```
Authorization: Bearer riseup_pat_...
```

Every response carries `X-Riseup-Token-Ref` for correlation.

## `GET /api/external/budget/:budgetDate`

Returns the budget for a specific month. This is the primary single-month endpoint.

`:budgetDate` accepts:

- A **`YYYY-MM`** date — `2026-05`
- The literal **`current`** — the month in progress right now
- The literal **`previous`** — last month

```bash
curl -H "Authorization: Bearer riseup_pat_..." \
  https://input.riseup.co.il/api/external/budget/2026-05
```

```bash
curl -H "Authorization: Bearer riseup_pat_..." \
  https://input.riseup.co.il/api/external/budget/current
```

### Shortcut: `GET /api/external/budget`

For convenience, `GET /api/external/budget` (no path segment) returns the current month's budget — exactly equivalent to `GET /api/external/budget/current`. Use whichever reads more naturally in your client.

## `GET /api/external/budget/:budgetDate/:numMonthsBack`

Returns the budget for a month **plus** the budgets for the N preceding months as a single response.

- `:budgetDate` — `YYYY-MM`
- `:numMonthsBack` — integer between `0` and `12` inclusive

```bash
curl -H "Authorization: Bearer riseup_pat_..." \
  https://input.riseup.co.il/api/external/budget/2026-05/3
```

`:numMonthsBack` of `13` or more is rejected with `400`. If you need a longer history, call multiple times — but watch the [rate limits](../rate-limits.md).

## Response shape

The exact JSON shape may evolve as we tighten the public surface. As of today the top-level keys you can rely on are:

| Key | Type | Notes |
|---|---|---|
| `customerId` | number | Your RiseUp account ID |
| `budgetDate` | string | The month this budget covers (`YYYY-MM`) |
| `lastUpdatedAt` | string (ISO 8601) | When this budget last changed |
| `cashflowHash` | string | A stable hash of the budget contents. If two responses have the same hash, the contents are identical — useful for client-side caching. |
| `envelopes` | array | One entry per budget envelope (category) — see below |

Each entry in `envelopes` has:

| Key | Type | Notes |
|---|---|---|
| `id` | string | Stable envelope ID |
| `type` | string | One of `fixed`, `trackingCategory`, `variable`, `variableIncome`, `riseupGoal` |
| `originalAmount` | number | Planned amount for the month (positive = income, negative = expense) |
| `balancedAmount` | number | Actual amount after the month closes |
| `balanceDate` | string (ISO 8601) | When this envelope's balance was last reconciled |

Don't assume any specific ordering of envelopes. Sort or filter by `type` on your side if you need a particular slice.

## Errors

See [the errors page](../errors.md) for the full catalog. The endpoint-specific ones:

- **`400`** if `:budgetDate` isn't in one of the accepted formats, or `:numMonthsBack` is outside `0..12`.
- **`404`** if the requested month is before your earliest cashflow record.
- **`401`** / **`403`** / **`429`** as documented in the auth and rate-limit pages.
