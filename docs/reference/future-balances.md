# Future balances endpoint

Requires **both** the `balances:read` and `budget:read` scopes — the prediction is built from your bank balances and the transactions to be billed until the future date. Send your PAT in the `Authorization` header:

```
Authorization: Bearer riseup_pat_...
```

Every response carries `X-Riseup-Token-Ref` for correlation.

This endpoint backs the `get_future_bank_balances_prediction` MCP tool. For the current balances, see [current balances](./current-balances.md).

## `GET /api/external/future-balances`

Predicts the balance of each of your bank accounts at the end of a future date, if no other transactions happen until then. For each account it starts from the current balance and subtracts expenses / adds incomes of:

- transactions already known with a billing date from the balance's last update until the future date (inclusive) — e.g. credit card charges that will be billed to the account;
- fixed (recurring) expenses and incomes predicted to be billed until the future date that haven't arrived yet.

Variable expenses that haven't happened yet (e.g. future grocery shopping) are not included.

| Parameter | Type | Required | Notes |
|---|---|---|---|
| `futureDateForPrediction` | string | yes | `YYYY-MM-DD`. From today until the end of your next cashflow month. |

```bash
curl -H "Authorization: Bearer riseup_pat_..." \
  "https://input.riseup.co.il/api/external/future-balances?futureDateForPrediction=2026-11-15"
```

Limitations:

- Only bank accounts whose balance was updated in the last 2 days are included.
- Customers with rolling credit (אשראי מתגלגל) on a credit card aren't supported yet and get an empty `accounts` list.
- An empty `accounts` list means there is no future balance prediction for you.

## Response shape

```json
{
  "accounts": [
    {
      "bankName": "דיסקונט",
      "accountNickname": "Joint account",
      "accountNumberHash": "e792e1",
      "currentBalance": 15200,
      "currentBalanceUpdatedAt": "2026-11-01 13:45",
      "futureDateForPrediction": "2026-11-15",
      "futurePredictedBalance": 13100,
      "amountToBeBilledUntilFuturePredictionDate": 4800,
      "transactionsBilledUntilFuturePredictionDate": [
        { "businessName": "שופרסל", "amount": 3100, "isIncome": false, "billingDate": "2026-11-14" },
        { "businessName": "חצי חינם", "amount": 1700, "isIncome": false, "billingDate": "2026-11-15" }
      ],
      "amountFixedPredictedToBeBilledUntilFuturePredictionDate": -2700,
      "fixedTransactionsPredictedToBeBilledUntilFuturePredictionDate": [
        { "businessName": "חברת החשמל", "amount": 300, "isIncome": false, "predictedBillingDate": "2026-11-14" },
        { "businessName": "משכורת", "amount": 3000, "isIncome": true, "predictedBillingDate": "2026-11-09" }
      ],
      "creditCardsInfo": [
        { "transactionsAmountToBill": 3100, "maxAmountPossiblePerMonth": null },
        { "transactionsAmountToBill": 1700, "maxAmountPossiblePerMonth": null }
      ]
    }
  ],
  "_meta": { "source": "riseup-external-api", "tokenRef": "9a8b7c6d5e4f3a2b" }
}
```

One entry per bank account:

| Key | Type | Notes |
|---|---|---|
| `bankName` | string | The bank's name |
| `accountNickname` | string \| null | The label you gave the account in the RiseUp app; `null` if not set |
| `accountNumberHash` | string \| null | Stable 6-character opaque account identifier — the same as in [current balances](./current-balances.md). Not the account number. |
| `currentBalance` | number | Current balance (ILS) |
| `currentBalanceUpdatedAt` | string | When the current balance was last updated from the bank, `YYYY-MM-DD HH:MM` |
| `futureDateForPrediction` | string | The requested date, `YYYY-MM-DD` |
| `futurePredictedBalance` | number | Predicted balance at the end of `futureDateForPrediction` (ILS); negative means overdraft |
| `amountToBeBilledUntilFuturePredictionDate` | number | Net total of `transactionsBilledUntilFuturePredictionDate`: expenses minus incomes (ILS). `0` when there are none. |
| `transactionsBilledUntilFuturePredictionDate` | array | Known transactions to be billed to this account until the future date: `businessName`, `amount` (positive), `isIncome`, `billingDate` |
| `amountFixedPredictedToBeBilledUntilFuturePredictionDate` | number | Net total of `fixedTransactionsPredictedToBeBilledUntilFuturePredictionDate`: expenses minus incomes (ILS); negative when predicted incomes are larger. `0` when there are none. |
| `fixedTransactionsPredictedToBeBilledUntilFuturePredictionDate` | array | Fixed transactions predicted (not yet arrived) until the future date: `businessName`, `amount` (positive), `isIncome`, `predictedBillingDate`. A prediction — it might change. |
| `creditCardsInfo` | array | One entry per credit card billed to this account with transactions until the future date: `transactionsAmountToBill` (including predicted fixed transactions, ILS) and `maxAmountPossiblePerMonth` (monthly billing cap if the card has rolling credit, else `null`) |

`futurePredictedBalance` = `currentBalance` − `amountToBeBilledUntilFuturePredictionDate` − `amountFixedPredictedToBeBilledUntilFuturePredictionDate`.

## Errors

See [the errors page](../errors.md) for the full catalog. The endpoint-specific ones:

- **`400`** if `futureDateForPrediction` is missing, isn't a valid `YYYY-MM-DD` date, is before today, or is after the end of your next cashflow month. The body's `detail` explains which.
- **`401`** / **`403`** / **`429`** as documented in the auth and rate-limit pages — a `403` here usually means your token is missing `balances:read` or `budget:read`; the body's `required` names the missing one.
