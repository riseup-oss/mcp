# Historical balances endpoint

Requires the `balances:read` scope. Send your PAT in the `Authorization` header:

```
Authorization: Bearer riseup_pat_...
```

Every response carries `X-Riseup-Token-Ref` for correlation.

This endpoint backs the `get_historical_bank_balances_data` MCP tool. For the latest balance only, see [current balances](./current-balances.md).

## `GET /api/external/balances/history`

Returns your daily bank balances over the last N days, per account, with the minimum, maximum and average balance of the period.

| Parameter | Type | Required | Notes |
|---|---|---|---|
| `daysBack` | integer | yes | How many days back to include, `1`–`90`. The period runs from that day (UTC) up to today, inclusive. |

```bash
curl -H "Authorization: Bearer riseup_pat_..." \
  "https://input.riseup.co.il/api/external/balances/history?daysBack=30"
```

Balance history isn't available beyond 90 days.

## Response shape

```json
{
  "accounts": [
    {
      "source": "discount",
      "accountNickname": null,
      "accountNumberHash": "a1b2c3",
      "minBalance": -2345,
      "maxBalance": 15203.43,
      "avgBalance": 8763.4,
      "balances": [
        { "date": "2026-06-15", "balance": 5467 },
        { "date": "2026-06-14", "balance": 11303 }
      ]
    }
  ],
  "_meta": { "source": "riseup-external-api", "tokenRef": "9a8b7c6d5e4f3a2b" }
}
```

One entry per bank account that has balances in the period:

| Key | Type | Notes |
|---|---|---|
| `source` | string | Bank source identifier |
| `accountNickname` | string \| null | Your label for the account |
| `accountNumberHash` | string \| null | Stable, opaque 6-character per-account identifier, shared with the other endpoints |
| `minBalance` | number | Lowest balance in the period (ILS) |
| `maxBalance` | number | Highest balance in the period (ILS) |
| `avgBalance` | number | Average of the recorded daily balances (ILS), rounded to 2 decimals |
| `balances` | array | `{ date: "YYYY-MM-DD", balance: number }`, one per day a balance was recorded, latest first |

Days without a recorded balance (for example when the bank connection didn't update) are missing from `balances` — they aren't filled in. The account number and the connection's owner name are never returned.

## Errors

See [the errors page](../errors.md) for the full catalog. The endpoint-specific ones:

- **`400`** if `daysBack` is missing or isn't an integer between `1` and `90`.
- **`401`** / **`403`** / **`429`** as documented in the auth and rate-limit pages — a `403` here usually means your token was created without `balances:read`.
