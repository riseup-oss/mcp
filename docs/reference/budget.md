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
| `envelopes` | array | One entry per budget envelope (category) — see below |

Each entry in `envelopes` has:

| Key | Type | Notes |
|---|---|---|
| `id` | string | Stable envelope ID |
| `type` | string | One of `fixed`, `trackingCategory`, `variable`, `variableIncome`, `riseupGoal` |
| `originalAmount` | number \| null | Planned amount for the month (positive = expense, negative = income). On `trackingCategory`, the category's target; on `fixed`, the predicted amount; on `riseupGoal`, the goal amount; `null` on `variable` and `variableIncome`, which have no plan (`null` means no plan, not a target of `0`) |
| `isCustomPrediction` | boolean | `trackingCategory` only: `true` if the customer set the target in `originalAmount`, `false` if RiseUp estimated it from the customer's history |
| `balancedAmount` | number \| null | Deprecated, kept for compatibility. Use `originalAmount` for the plan and `actuals` for what happened. It isn't updated from transactions: it equals `originalAmount` on `fixed` and is `0` on `trackingCategory` |
| `balanceDate` | string (`YYYY-MM-DD` on `fixed`, ISO 8601 datetime on `trackingCategory`) | When RiseUp stops waiting for transactions in this envelope. On `fixed`, the date by which the payment is expected (with no `actuals` and this date before `lastUpdatedAt`, the item didn't arrive this month); on `trackingCategory`, shortly after the week or month ends |
| `details` | object | `trackingCategory` only: `trackingCategory.name`, `trackingCategory.trackingCategoryType` (`saving` for the savings category) and `trackingCategory.frequency` (`monthly` or `weekly`); weekly categories come as one envelope per week, with `startDate`, `endDate` (exclusive) and `weeklyIndex`. The stored name `כלכלה` is shown in the app as `סופר`, and `__saving-hidden-category__` as `השקעה וחיסכון` |

Don't assume any specific ordering of envelopes. Sort or filter by `type` on your side if you need a particular slice.

## Errors

See [the errors page](../errors.md) for the full catalog. The endpoint-specific ones:

- **`400`** if `:budgetDate` isn't in one of the accepted formats, or `:numMonthsBack` is outside `0..12`.
- **`404`** if the requested month is before your earliest cashflow record.
- **`401`** / **`403`** / **`429`** as documented in the auth and rate-limit pages.
