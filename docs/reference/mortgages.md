# Mortgages endpoint

Requires the `mortgages:read` scope. Send your PAT in the `Authorization` header:

```
Authorization: Bearer riseup_pat_...
```

Every response carries `X-Riseup-Token-Ref` for correlation.

This endpoint backs the `get_mortgages_data` MCP tool.

## `GET /api/external/mortgages`

Returns your mortgage details as RiseUp knows them, how much you paid toward your mortgage in your cashflow last month, and how much RiseUp's mortgage product could save you.

No parameters. Mortgage payments are summed over your **previous** cashflow month — the last complete one. Cashflow months follow your cashflow start day, so they don't always match calendar months.

```bash
curl -H "Authorization: Bearer riseup_pat_..." \
  https://input.riseup.co.il/api/external/mortgages
```

## Response shape

```json
{
  "paymentsCashflowMonth": "2026-05",
  "hasMortgagePaymentsInCashflow": true,
  "mortgagePaymentsInCashflow": 5000,
  "hasMortgageData": true,
  "monthlyPayment": 4990,
  "totalRemainingAmount": 1200000.58,
  "remainingInterestAmount": 500000,
  "remainingPrincipalAmount": 700000.58,
  "parts": [
    { "remainingAmount": 600000.29, "remainingMonths": 240, "mortgageType": "PRIME_LINKED", "interestRates": { "primeRate": 2.5 } }
  ],
  "riseupSavingsPotential": { "totalCostSaving": 130000, "monthlyPaymentSaving": 586 },
  "_meta": { "source": "riseup-external-api", "tokenRef": "9a8b7c6d5e4f3a2b" }
}
```

| Key | Type | Notes |
|---|---|---|
| `paymentsCashflowMonth` | string \| null | Your previous cashflow month (`YYYY-MM`), which `mortgagePaymentsInCashflow` covers. `null` if that month has no transactions. |
| `hasMortgagePaymentsInCashflow` | boolean | Whether mortgage payments appear in that month's cashflow |
| `mortgagePaymentsInCashflow` | number | Total mortgage payments in that month's cashflow (ILS) |
| `hasMortgageData` | boolean | Whether RiseUp has your mortgage details. When `false`, every field below is absent. |
| `monthlyPayment` | number | Expected monthly payment according to the mortgage details (ILS) |
| `totalRemainingAmount` | number | Total left to pay — principal plus interest (ILS) |
| `remainingInterestAmount` | number | The interest part of `totalRemainingAmount` (ILS). An amount, not a rate. |
| `remainingPrincipalAmount` | number | The principal part of `totalRemainingAmount` (ILS) |
| `parts` | array | The mortgage's parts (tracks) — see below |
| `riseupSavingsPotential` | object | See below |

Each entry in `parts` has:

| Key | Type | Notes |
|---|---|---|
| `remainingAmount` | number | Current balance of this part (ILS) |
| `remainingMonths` | number \| null | Whole months left to pay on this part |
| `mortgageType` | string | `PRIME_LINKED`, `VARIABLE_CPI_LINKED`, `FIXED_CPI_LINKED`, `FIXED_UNLINKED`, `VARIABLE_UNLINKED`, `ELIGIBILITY`, `GRANT`, or `UNKNOWN` |
| `interestRates` | object \| null | Current interest data for this part. Its keys depend on the type — fixed, variable or prime-based (e.g. `{ "primeRate": 2.5 }`). |

`riseupSavingsPotential` describes two ways RiseUp's mortgage product can help — lowering the total cost or lowering the monthly payment. The response includes both options so they can be compared. They're **alternatives**: the customer can choose one of them, and choosing one rules out the other — the two savings can't be combined. Each is `null` only when that option offers no improvement:

| Key | Type | Notes |
|---|---|---|
| `totalCostSaving` | number \| null | Total cost saving while keeping the same monthly payment (ILS). `null` when there's no improvement. |
| `monthlyPaymentSaving` | number \| null | Monthly payment saving while keeping the same total cost (ILS). `null` when there's no improvement. |

### How mortgage payments in the cashflow are found

A transaction counts as a mortgage payment when it's an expense in the `משכנתא` (mortgage) category — or, if you haven't categorized it, when RiseUp's system expense type is `משכנתא`. Bank-side credit-card bill payments are ignored, like in the [transactions endpoint](./transactions.md).

## Errors

See [the errors page](../errors.md) for the full catalog. **`401`** / **`403`** / **`429`** as documented in the auth and rate-limit pages — a `403` here usually means your token was created without `mortgages:read`.
