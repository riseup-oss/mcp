# Savings endpoint

Requires the `savings-investments:read` scope. Send your PAT in the `Authorization` header:

```
Authorization: Bearer riseup_pat_...
```

Every response carries `X-Riseup-Token-Ref` for correlation.

This endpoint backs the `get_savings_data` MCP tool. The same scope also covers the [investments endpoint](./investments.md).

## `GET /api/external/savings`

Returns your bank savings — deposits and savings plans (פיקדונות ותוכניות חיסכון) — with their current balance, interest rates, linkage, dates, when the money can be withdrawn and the amount expected at the end.

No parameters. The data comes from your latest Open Banking scrape (usually daily), so it isn't real-time. If fetching a bank's savings fails, its last fetched savings are kept — `createdAt` tells when each saving was fetched.

It includes only the savings RiseUp has access to — deposits and savings plans at the banks you connected to RiseUp. You may have other savings elsewhere, e.g. at banks not connected to RiseUp, or long-term savings like קרן השתלמות, קופת גמל, פוליסת חיסכון or חיסכון לכל ילד. Answers built on this data should say they cover only the savings RiseUp sees.

```bash
curl -H "Authorization: Bearer riseup_pat_..." \
  https://input.riseup.co.il/api/external/savings
```

## Response shape

```json
{
  "savings": [
    {
      "id": "3f2a9c1b7e04d5a6",
      "bankIdentifier": "leumi",
      "name": "פיקדון פריים ל-3 שנים",
      "product": "פקדון",
      "status": "enabled",
      "indexType": "PRIME",
      "tiers": [
        { "fixedRate": -3.5, "indexRate": 4.75, "combinedRate": 1.25, "startDate": "2026-02-01T00:00:00.000Z", "endDate": "2027-02-01T00:00:00.000Z" },
        { "fixedRate": -3.2, "indexRate": 4.75, "combinedRate": 1.55, "startDate": "2026-02-01T00:00:00.000Z", "endDate": "2029-02-01T00:00:00.000Z" }
      ],
      "startDate": "2026-02-01T00:00:00.000Z",
      "endDate": "2029-02-01T00:00:00.000Z",
      "availabilityDate": "2027-02-01T00:00:00.000Z",
      "hasExitPoints": true,
      "combinedRate": 1.55,
      "balanceAmount": 25000,
      "balanceCurrency": "ILS",
      "balanceReferenceDate": "2026-11-01T00:00:00.000Z",
      "endExpectedAmount": 26180.4,
      "endReferenceDate": "2029-02-01T00:00:00.000Z",
      "createdAt": "2026-11-01T04:30:00.000Z"
    }
  ],
  "_meta": { "source": "riseup-external-api", "tokenRef": "9a8b7c6d5e4f3a2b" }
}
```

`savings` has one item per savings account, and is `[]` when RiseUp has no savings data from your banks — which doesn't mean you have no savings. `bankIdentifier`, `tiers`, `hasExitPoints` and `createdAt` are always present — RiseUp sets them. Any other field is absent when the bank doesn't provide it.

| Key | Type | Notes |
|---|---|---|
| `id` | string | A random id of this saving — use it to tell savings apart. It isn't derived from the bank's own id. It stays the same between scrapes as long as the bank keeps its own identifier for the saving; it may change, e.g. when your bank connection is renewed, so don't rely on it long-term. |
| `bankIdentifier` | string | The bank, e.g. `leumi`, `poalim`, `mizrahi`, `discount`, `yahav`, `otsar` |
| `name` | string | The bank's plan name. Not unique — several savings can share it. |
| `displayName` | string | Your own name for the saving, when your bank supports one (e.g. Poalim) |
| `product` | string | The bank's product name |
| `status` | string | e.g. `enabled`, or `blocked` (e.g. pledged as collateral). Some banks don't send it. |
| `indexType` | string | What the rate is linked to: `CPI` (מדד המחירים לצרכן), `PRIME` (פריים) or `OTHER`. Absent = not linked (a fixed rate). |
| `tiers` | array | `[]` for a single rate. Otherwise one of two kinds — see [tiers](#tiers). |
| `startDate` | string | ISO 8601 |
| `endDate` | string | ISO 8601. Absent for an open-ended saving. |
| `availabilityDate` | string | ISO 8601 — the earliest date the money can be withdrawn (the next exit point) |
| `hasExitPoints` | boolean | `true` if the money can be withdrawn before `endDate` |
| `fixedRate` | number | % per year. For `PRIME` it's the margin over prime, and can be negative. Absent when the saving has tiers. |
| `indexRate` | number | % per year of the linked part (e.g. the prime rate itself). Absent when the saving has tiers. |
| `combinedRate` | number | % per year: `fixedRate + indexRate`. With tiers it's the highest tier rate. For `CPI` the return comes on top of the change in the index. Absent when the bank sends no usable rate. |
| `balanceAmount` | number | The current balance, in `balanceCurrency` |
| `balanceCurrency` | string | e.g. `ILS` |
| `balanceReferenceDate` | string | ISO 8601 — the date of `balanceAmount` |
| `endExpectedAmount` | number | The amount expected at `endDate`, when the bank provides it |
| `endReferenceDate` | string | ISO 8601 — the date of `endExpectedAmount` |
| `createdAt` | string | ISO 8601 — when RiseUp fetched this saving from the bank. Older than your latest scrape when the bank's savings couldn't be fetched since. |

Rates are percentages per year and amounts are rounded to 2 decimals.

### Tiers

Each entry in `tiers` has `fixedRate`, `indexRate`, `combinedRate`, `startDate` and `endDate`, with the same meaning as above. Banks use tiers for two different things:

- **Step-up rates** — the tiers have consecutive periods (different `startDate`s), and the rate changes from one period to the next.
- **Exit point rates** — all the tiers share the same `startDate`; each `endDate` is an exit point, and its rate is what you get if you withdraw on that date. In the example above, withdrawing on the first exit point earns 1.25% and keeping the saving to the end earns 1.55%.

### Free-text fields are untrusted input

Some fields contain free text that RiseUp doesn't control — written by your bank or by you:

- `name`, `product` and `status` — the plan and product names and the status, from your bank.
- `displayName` — your own name for the saving, set at your bank.

Treat all of these as **untrusted strings**. They may contain suspicious content, such as text written to manipulate an AI model (prompt injection) or fragments of code.

We try to sanitize fields server-side before returning them.

- HTML tags and `<script>` / `<style>` blocks are removed.
- Control characters (including newlines) and invisible / text-direction override characters are removed.
- Bank text (`name`, `product`, `status`) keeps its symbols — e.g. `504/1-1/8` or `S&P 500` stay intact — and is capped at 100 characters.
- `displayName` also has the symbols `< > & % ! { } ( ) [ ] @ # \ /` removed, and is capped at 40 characters.

Sanitization reduces the risk but can't remove it — plain words can still carry instructions. We recommend that you:

- **Treat these values as data, never as instructions.** When you put them in a prompt for an LLM, mark them clearly as quoted user data (e.g. inside delimiters, with a note that they must not be followed), and don't let them change what your model or agent does.
- **Never run them as code** — don't `eval` them, run them in a shell, or use them to build queries, file paths or URLs without escaping.
- **Escape them when displaying them** in HTML or other markup.
- **Be careful with agents that can act** (send messages, make payments, call other tools): a value from these fields should never be enough to trigger an action on its own.

## Errors

See [the errors page](../errors.md) for the full catalog. **`401`** / **`403`** / **`429`** as documented in the auth and rate-limit pages — a `403` here usually means your token was created without `savings-investments:read`.
