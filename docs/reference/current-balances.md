# Current balances endpoint

Requires the `balances:read` scope. Send your PAT in the `Authorization` header:

```
Authorization: Bearer riseup_pat_...
```

Every response carries `X-Riseup-Token-Ref` for correlation.

This endpoint backs the `get_current_bank_balances_data` MCP tool. For balances over time, see [historical balances](./historical-balances.md).

## `GET /api/external/balances/current`

Returns the current balance of each of your bank accounts, with its approved overdraft limit (מסגרת אשראי בעו"ש) when known. No parameters.

```bash
curl -H "Authorization: Bearer riseup_pat_..." \
  https://input.riseup.co.il/api/external/balances/current
```

## Response shape

```json
{
  "balances": [
    {
      "source": "leumiBank",
      "accountNickname": "Joint account",
      "accountNumberHash": "e792e1",
      "balance": -1200.5,
      "lastUpdated": "2026-06-15T10:45:00.000Z",
      "overdraftLimit": 5000,
      "availableOverdraft": 3799.5,
      "overdraftLimitUpdatedAt": "2026-06-14"
    },
    {
      "source": "poalim",
      "accountNickname": null,
      "accountNumberHash": "a41c0f",
      "balance": 8300,
      "lastUpdated": "2026-06-14T08:10:00.000Z",
      "overdraftLimit": null,
      "availableOverdraft": null,
      "overdraftLimitUpdatedAt": null
    }
  ],
  "_meta": { "source": "riseup-external-api", "tokenRef": "9a8b7c6d5e4f3a2b" }
}
```

One entry per bank account, most recently updated first:

| Key | Type | Notes |
|---|---|---|
| `source` | string | Bank source identifier, e.g. `leumiBank`, `poalim` |
| `accountNickname` | string \| null | Your label for the account, set in the RiseUp app |
| `accountNumberHash` | string \| null | Stable, opaque 6-character per-account identifier — the same value the [transactions endpoint](./transactions.md) returns for that account. Not the account number. |
| `balance` | number | Current balance (ILS). Negative means overdraft. |
| `lastUpdated` | string (ISO 8601) | When this balance was last updated from the bank |
| `overdraftLimit` | number \| null | Approved overdraft limit (ILS): how far below zero the account may go, as a positive amount. `0` means the account has no overdraft limit. `null` means it's unknown, e.g. the bank doesn't provide it — don't assume any limit. |
| `availableOverdraft` | number \| null | How much of the overdraft limit can still be used at the current `balance` (ILS). The full limit while the balance is 0 or positive, the limit minus the overdraft once negative, and `0` once the balance reaches or passes the limit. `null` when `overdraftLimit` is `null`. |
| `overdraftLimitUpdatedAt` | string (`YYYY-MM-DD`) \| null | The day the overdraft limit was taken from the bank. `null` when `overdraftLimit` is `null`. |

### Freshness

Balances come from your bank connection. If a connection stops updating, its account keeps returning the last known balance — check `lastUpdated` before relying on a value.

### Overdraft

What you can still spend from an account before hitting its limit is `balance + availableOverdraft` while the balance is positive, and `availableOverdraft` once it's negative. In the example above, the `leumiBank` account is 1,200.50 into a 5,000 limit, so 3,799.50 is left.

The limit is read from the bank separately from the balance, so `overdraftLimitUpdatedAt` can be a different day than `lastUpdated`. `availableOverdraft` is always computed against the returned `balance`.

When the limit can't be determined for an account, all three overdraft fields are `null` and the balance is still returned. Treat `null` as unknown — not as `0` and not as unlimited.

### What's not returned

The account number and the connection's owner name are never returned. Use `accountNickname` and `accountNumberHash` to tell accounts apart.

## Errors

See [the errors page](../errors.md) for the full catalog. **`401`** / **`403`** / **`429`** as documented in the auth and rate-limit pages — a `403` here usually means your token was created without `balances:read`.
