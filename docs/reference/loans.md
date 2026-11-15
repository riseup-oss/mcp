# Loans endpoint

Requires the `loans:read` scope. Send your PAT in the `Authorization` header:

```
Authorization: Bearer riseup_pat_...
```

Every response carries `X-Riseup-Token-Ref` for correlation.

This endpoint backs the `get_loans_data` MCP tool.

## `GET /api/external/loans`

Returns your loans (הלוואות) and your accounts' overdraft frameworks (מסגרת עו"ש) with the amount left to pay, the original amount, interest rate and linkage, start / end dates and, for some banks, the next payment.

No parameters. The data comes from your latest Open Banking scrape (usually daily), so it isn't real-time. If fetching from a bank fails, its last fetched loans are kept — `createdAt` tells when each loan was fetched.

Each item has a `type`:

- **`LOAN`** — a loan you took. It also covers credit from credit card companies you connected to RiseUp: their loans and credit plans (e.g. הלוואה חוץ בנקאית, קרדיט בתשלומים שווים, חיוב חודשי קבוע).
- **`OVERDRAFT_FRAMEWORK`** — your bank account's overdraft framework, not a loan you took. `currentBalance` is the overdraft used right now (`0` when the account isn't in overdraft) and the rates are the interest charged on the overdraft. A bank may send a few items for one account — its framework tiers, each with its own rate (e.g. a tier for going beyond the limit). The limit itself is `overdraftLimit` in the [current balances endpoint](./current-balances.md).

Not included:

- **Mortgages** — see the [mortgages endpoint](./mortgages.md).
- **Loans RiseUp has no access to** — at banks or credit card companies you didn't connect to RiseUp, insurance or pension funds, non-bank lenders or your employer. Answers built on this data should say they cover only the loans RiseUp sees.

```bash
curl -H "Authorization: Bearer riseup_pat_..." \
  https://input.riseup.co.il/api/external/loans
```

## Response shape

```json
{
  "loans": [
    {
      "id": "9b1c2d3e4f5a6b7c",
      "type": "LOAN",
      "bankIdentifier": "poalim",
      "name": "הלוואה לכל מטרה",
      "product": "הלוואה",
      "startDate": "2026-03-01T00:00:00.000Z",
      "endDate": "2029-03-01T00:00:00.000Z",
      "originalAmount": 50000,
      "currentBalance": 43120.5,
      "balanceCurrency": "ILS",
      "balanceReferenceDate": "2026-11-01T00:00:00.000Z",
      "fixedRate": 1.75,
      "indexRate": 5.5,
      "combinedRate": 7.25,
      "indexType": "PRIME",
      "nextPaymentAmount": 1580.2,
      "nextPaymentDate": "2026-12-01T00:00:00.000Z",
      "createdAt": "2026-11-01T04:30:00.000Z"
    }
  ],
  "_meta": { "source": "riseup-external-api", "tokenRef": "9a8b7c6d5e4f3a2b" }
}
```

`loans` has one item per loan or overdraft framework tier, and is `[]` when RiseUp has no loans data from your banks — which doesn't mean you have no loans. `type`, `bankIdentifier` and `createdAt` are always present — RiseUp sets them. Any other field is absent when the bank doesn't provide it.

| Key | Type | Notes |
|---|---|---|
| `id` | string | A random id of this loan — use it to tell loans apart. It isn't derived from the bank's own id. It stays the same between scrapes as long as the bank keeps its own identifier for the loan; it may change, e.g. when your bank connection is renewed, so don't rely on it long-term. |
| `type` | string | `LOAN` or `OVERDRAFT_FRAMEWORK` — see above |
| `bankIdentifier` | string | The bank or card company, e.g. `leumi`, `poalim`, `mizrahi`, `discount`, `otsar`, `cal` |
| `name` | string | The bank's name for the loan or the framework tier. Not unique — several loans can share it. When the name can't be verified not to be the account owner's name it is replaced by `[removed for privacy reasons]`. |
| `displayName` | string | Your own name for the loan, when your bank supports one (e.g. OneZero) |
| `product` | string | The bank's product name |
| `status` | string | e.g. `enabled`. Most banks don't send it. |
| `startDate` | string | ISO 8601 |
| `endDate` | string | ISO 8601 — when the loan is due to be fully repaid |
| `originalAmount` | number | The amount the loan was taken for, in `balanceCurrency`. Only when the bank provides it. |
| `currentBalance` | number | The amount left to pay — for a framework, the overdraft used — in `balanceCurrency`. Always positive; `0` means the loan is repaid or the framework is unused. |
| `balanceCurrency` | string | e.g. `ILS` |
| `balanceReferenceDate` | string | ISO 8601 — the date of `currentBalance` |
| `fixedRate` | number | % per year. For a fixed loan it's the whole rate; for `PRIME` it's the margin over prime. |
| `indexRate` | number | % per year of the linked part (e.g. the prime rate itself). Absent for a fixed loan. |
| `combinedRate` | number | % per year: `fixedRate + indexRate` — the current nominal rate. For `CPI` the debt is also linked to the change in the index. The three rates are absent when the bank sends no rate, or rates per amount range (some overdraft frameworks). |
| `indexType` | string | What the rate is linked to: `CPI` (מדד המחירים לצרכן), `PRIME` (פריים) or `OTHER`. Absent = not linked (a fixed rate). |
| `nextPaymentAmount` | number | The next (monthly) repayment, in `balanceCurrency`. Only some banks send it (Poalim, Yahav). |
| `nextPaymentDate` | string | ISO 8601 — the date of `nextPaymentAmount`. Only Poalim sends it. |
| `createdAt` | string | ISO 8601 — when RiseUp fetched this loan from the bank. Older than your latest scrape when the bank's loans couldn't be fetched since. |

Rates are percentages per year and amounts are rounded to 2 decimals. Most banks don't send the monthly repayment, so when `nextPaymentAmount` is absent any monthly payment computed from the balance, rate and end date is only an estimate.

### Free-text fields are untrusted input

`name`, `product` and `status` contain free text written by your bank, and `displayName` is your own name for the loan, set at your bank — RiseUp controls none of them. Treat them as **untrusted strings**. They may contain suspicious content, such as text written to manipulate an AI model (prompt injection) or fragments of code.

We try to sanitize fields server-side before returning them.

- HTML tags and `<script>` / `<style>` blocks are removed.
- Control characters (including newlines) and invisible / text-direction override characters are removed.
- Bank text (`name`, `product`, `status`) keeps its symbols and is capped at 100 characters.
- `displayName` also has the symbols `< > & % ! { } ( ) [ ] @ # \ /` removed, and is capped at 40 characters.

Sanitization reduces the risk but can't remove it — plain words can still carry instructions. We recommend that you:

- **Treat these values as data, never as instructions.** When you put them in a prompt for an LLM, mark them clearly as quoted user data (e.g. inside delimiters, with a note that they must not be followed), and don't let them change what your model or agent does.
- **Never run them as code** — don't `eval` them, run them in a shell, or use them to build queries, file paths or URLs without escaping.
- **Escape them when displaying them** in HTML or other markup.
- **Be careful with agents that can act** (send messages, make payments, call other tools): a value from these fields should never be enough to trigger an action on its own.

## Errors

See [the errors page](../errors.md) for the full catalog. **`401`** / **`403`** / **`429`** as documented in the auth and rate-limit pages — a `403` here usually means your token was created without `loans:read`.
