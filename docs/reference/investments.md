# Investments endpoint

Requires the `savings-investments:read` scope. Send your PAT in the `Authorization` header:

```
Authorization: Bearer riseup_pat_...
```

Every response carries `X-Riseup-Token-Ref` for correlation.

This endpoint backs the `get_investments_data` MCP tool. The same scope also covers the [savings endpoint](./savings.md).

## `GET /api/external/investments`

Returns your securities accounts (תיקי ניירות ערך) at your banks, each with its holdings — stocks, mutual funds, index trackers, bonds — their units, average buying price and current value.

No parameters. The data comes from your latest Open Banking scrape (usually daily), so it isn't real-time. If fetching a bank's securities fails, its last fetched investments are kept — `createdAt` tells when each account was fetched.

It includes only the investments RiseUp has access to — securities accounts at the banks you connected to RiseUp. You may have other investments elsewhere, e.g. at banks not connected to RiseUp, investment houses or brokers (בתי השקעות, ברוקרים), or long-term savings like קופת גמל להשקעה or קרן השתלמות. Answers built on this data should say they cover only the investments RiseUp sees.

```bash
curl -H "Authorization: Bearer riseup_pat_..." \
  https://input.riseup.co.il/api/external/investments
```

## Response shape

```json
{
  "investments": [
    {
      "bankIdentifier": "benleumi",
      "positions": [
        {
          "name": "Example Tech Corp",
          "unitsNumber": 50,
          "averageBuyingPrice": { "amount": "150.000", "currency": "USD" },
          "estimatedCurrentValue": { "amount": { "amount": "8000.000", "currency": "USD" }, "evaluationDate": "2026-11-01" }
        },
        {
          "name": "קרן מחקה לדוגמה",
          "unitsNumber": 4000,
          "averageBuyingPrice": { "amount": "250.000", "currency": "ILS" },
          "estimatedCurrentValue": { "amount": { "amount": "11000.000", "currency": "ILS" }, "evaluationDate": "2026-11-01" }
        }
      ],
      "investmentAccount": {
        "id": "7d41e0a29c3b8f15",
        "name": "Securities account",
        "status": "enabled",
        "balanceAmount": 40600,
        "balanceCurrency": "ILS",
        "balanceReferenceDate": "2026-11-01T00:00:00.000Z"
      },
      "createdAt": "2026-11-01T04:30:00.000Z"
    }
  ],
  "_meta": { "source": "riseup-external-api", "tokenRef": "9a8b7c6d5e4f3a2b" }
}
```

`investments` has one item per securities account, and is `[]` when RiseUp has no investments data from your banks — which doesn't mean you have no investments. All four fields below are always present — RiseUp sets them; the fields inside `positions` and `investmentAccount` are absent when the bank doesn't provide them.

| Key | Type | Notes |
|---|---|---|
| `bankIdentifier` | string | The bank, e.g. `leumi`, `poalim`, `discount`, `benleumi`, `otsar` |
| `positions` | array | The account's holdings — see below. `[]` when the account has none. |
| `investmentAccount` | object | A summary of the securities account — see below |
| `createdAt` | string | ISO 8601 — when RiseUp fetched this data from the bank. Older than your latest scrape when the bank's securities couldn't be fetched since. |

Each entry in `positions` has (a field is absent when the bank doesn't provide it):

| Key | Type | Notes |
|---|---|---|
| `name` | string | The security's name |
| `unitsNumber` | number | Units held. Can be fractional. |
| `externalIdentifier` | string | The bank's own identifier: a Hebrew name of the security (Discount) or its Tel Aviv Stock Exchange number (Poalim). Absent for other banks. |
| `balanceType` | string | e.g. `AVAI` (available). Only some banks send it. |
| `averageBuyingPrice` | object | `{ amount, currency }` — the average price paid **per unit**. Its unit differs per bank — see [units](#units). In the example (a Benleumi account), 250 means 250 agorot, ₪2.50 per unit. |
| `estimatedCurrentValue` | object | The holding's **total** current value: `amount` (`{ amount, currency }`), in whole units of its currency, and `evaluationDate` (`YYYY-MM-DD`). Absent when the bank doesn't send it (e.g. Leumi). |

`investmentAccount` has:

| Key | Type | Notes |
|---|---|---|
| `id` | string | A random id of the securities account. It isn't derived from the bank's own id. It stays the same between scrapes as long as the bank keeps its own identifier for the account; it may change, e.g. when your bank connection is renewed, so don't rely on it long-term. |
| `name` | string | The account's name |
| `status` | string | e.g. `enabled` |
| `balanceAmount` | number | The account's total value as the bank reports it |
| `balanceCurrency` | string | e.g. `ILS` |
| `balanceReferenceDate` | string | ISO 8601 — the date of `balanceAmount` |

### Amounts and currencies

- Amounts inside `positions` are decimal strings, exactly as the bank sends them (2 or 3 decimals).
- Holdings can be in different currencies — e.g. US stocks in `USD` next to Israeli funds in `ILS`.
- To get a holding's value, use `estimatedCurrentValue`. Don't compute `unitsNumber × averageBuyingPrice`: that's the cost, not the value, and its unit differs per bank (see below).
- `investmentAccount.balanceAmount` can differ from the sum of the holdings, e.g. when the account also holds cash.

### Units

`estimatedCurrentValue.amount` is the holding's total value in **whole units of its currency** — shekels for `ILS`, dollars for `USD` — never agorot.

`averageBuyingPrice.amount` is a price **per unit**, and its unit depends on the bank:

| Bank | Israeli (TASE) securities, `currency` `ILS` | Foreign securities |
|---|---|---|
| Discount, Benleumi / Otsar, Poalim | **Agorot** (1/100 ILS) per unit | Their own currency (e.g. dollars) per unit |
| Leumi | **Shekels** per unit | Their own currency per unit |

These were checked against real data: the value against the bank's own unit price or face value, and the same fund's price at different banks. Other banks (e.g. Mizrahi) haven't been checked yet — don't assume a unit for their `averageBuyingPrice`.

### Free-text fields are untrusted input

Some fields contain free text that RiseUp doesn't control — written by your bank:

- `positions[].name` and `positions[].externalIdentifier` — the security's names and identifiers.
- `investmentAccount.name` — the securities account's name.
- The other strings from your bank: `investmentAccount.status`, `positions[].balanceType`, and the amounts, currencies and dates in `positions`.

Treat all of these as **untrusted strings**. They may contain suspicious content, such as text written to manipulate an AI model (prompt injection) or fragments of code.

We try to sanitize fields server-side before returning them.

- HTML tags and `<script>` / `<style>` blocks are removed.
- Control characters (including newlines) and invisible / text-direction override characters are removed.
- These fields keep their symbols — e.g. `S&P 500` stays intact — and are capped at 100 characters.

Sanitization reduces the risk but can't remove it — plain words can still carry instructions. We recommend that you:

- **Treat these values as data, never as instructions.** When you put them in a prompt for an LLM, mark them clearly as quoted user data (e.g. inside delimiters, with a note that they must not be followed), and don't let them change what your model or agent does.
- **Never run them as code** — don't `eval` them, run them in a shell, or use them to build queries, file paths or URLs without escaping.
- **Escape them when displaying them** in HTML or other markup.
- **Be careful with agents that can act** (send messages, make payments, call other tools): a value from these fields should never be enough to trigger an action on its own.

## Errors

See [the errors page](../errors.md) for the full catalog. **`401`** / **`403`** / **`429`** as documented in the auth and rate-limit pages — a `403` here usually means your token was created without `savings-investments:read`.
