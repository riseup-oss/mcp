# Current balances endpoint

Requires the `balances:read` scope. Send your PAT in the `Authorization` header:

```
Authorization: Bearer riseup_pat_...
```

Every response carries `X-Riseup-Token-Ref` for correlation.

This endpoint backs the `get_current_bank_balances_data` MCP tool. For balances over time, see [historical balances](./historical-balances.md).

## `GET /api/external/balances/current`

Returns the current balance of each of your bank accounts. No parameters.

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
      "balance": 15203.43,
      "lastUpdated": "2026-06-15T10:45:00.000Z"
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

### Freshness

Balances come from your bank connection. If a connection stops updating, its account keeps returning the last known balance — check `lastUpdated` before relying on a value.

### What's not returned

The account number and the connection's owner name are never returned. Use `accountNickname` and `accountNumberHash` to tell accounts apart.

## Errors

See [the errors page](../errors.md) for the full catalog. **`401`** / **`403`** / **`429`** as documented in the auth and rate-limit pages — a `403` here usually means your token was created without `balances:read`.
