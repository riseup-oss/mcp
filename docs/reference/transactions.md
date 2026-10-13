# Transactions endpoint

Requires the `budget:read` scope — the same token you use for the [budget endpoints](./budget.md). Send your PAT in the `Authorization` header:

```
Authorization: Bearer riseup_pat_...
```

Every response carries `X-Riseup-Token-Ref` for correlation.

This endpoint backs the `get_transactions` MCP tool.

## `GET /api/external/transactions`

Returns individual cashflow transactions, filtered by query parameters. Filters combine with AND. `cashflowMonth` is optional only when you send `transactionDate` instead. With neither, you get an error (`400`), not data — unfiltered queries are rejected to avoid unbounded results.

Each call covers at most one cashflow month (or one exact date). For a longer period, call once per month.

| Parameter | Type | Required | Notes |
|---|---|---|---|
| `cashflowMonth` | string | one of these two | The cashflow month, `YYYY-MM` (e.g. `2026-06`). Doesn't accept `current` / `previous`. |
| `transactionDate` | string | one of these two | An exact transaction date, `YYYY-MM-DD` (e.g. `2026-06-15`). |
| `businessName` | string | no | Case-insensitive substring of the merchant name. Max 100 chars, no HTML/code characters (`<>{}[]\/"'`). |
| `maxTransactions` | integer | no | Return only the latest N matching transactions by `transactionDate`. Any positive integer; the default is `10000`. Applied after the other filters. |

```bash
curl -H "Authorization: Bearer riseup_pat_..." \
  "https://input.riseup.co.il/api/external/transactions?cashflowMonth=2026-06"
```

```bash
# The 5 most recent restaurant transactions in June
curl -H "Authorization: Bearer riseup_pat_..." \
  "https://input.riseup.co.il/api/external/transactions?cashflowMonth=2026-06&businessName=restaurant&maxTransactions=5"
```

### Ordering

Transactions are returned **latest first** by `transactionDate`. Transactions without a date come last.

### What's not returned

Bank-side credit-card bill payments (the monthly charge of a card to your bank account) are never returned — the individual card purchases they cover are already in the list, so including both would count the same spending twice.

## Response shape

```json
{
  "transactions": [ { "...": "..." } ],
  "_meta": { "source": "riseup-external-api", "tokenRef": "9a8b7c6d5e4f3a2b" }
}
```

Each entry in `transactions` has the fields below. Fields that aren't populated for a given transaction may be absent.

| Key | Type | Notes |
|---|---|---|
| `transactionId` | string | Stable transaction ID |
| `transactionDate` | string (ISO 8601) | When the transaction occurred. Always UTC midnight — the date part is the transaction day. |
| `billingDate` | string (ISO 8601) | When it was billed (differs from `transactionDate` for credit cards). May be absent. |
| `cashflowDate` | string | The cashflow month this transaction is allocated to (`YYYY-MM`) |
| `businessName` | string | Merchant name |
| `isIncome` | boolean | `true` = income, `false` = expense |
| `amount` | number | Money value in ILS. Use `isIncome` for direction — don't infer it from the sign. |
| `accountNickname` | string \| null | Your label for the source account, set in the RiseUp app |
| `accountNumberHash` | string \| null | Stable, opaque 6-character per-account identifier. Not the account number. |
| `isInstallment` | boolean | `true` if part of a payment plan |
| `installmentNumber` | number | Current installment (meaningful only when `isInstallment`) |
| `totalNumberOfInstallments` | number | Total planned installments (meaningful only when `isInstallment`) |
| `totalNumberOfPayments` | number | Legacy alias for `totalNumberOfInstallments` |
| `isPostponed` | boolean | `true` if pushed to the next month's cashflow |
| `sourceType` | string | Account type, e.g. `creditCard`, `checkingAccount` |
| `source` | string | Bank / credit-card provider |
| `commitmentId` | string \| null | Set when the transaction is part of a recurring commitment (rent, subscription…) |
| `actualType` | string | `fixed` or `variable` |
| `categoryLabel` | string | Customer-facing category name (Hebrew), `אחר` when unclassified |
| `categoryType` | string | `default` (built-in), `custom` (customer-created) or `other` (unclassified) |
| `expenseType` | string \| null | RiseUp's system-assigned expense type (Hebrew). Unlike `categoryLabel`, it doesn't change when you recategorize the transaction. |
| `isExcluded` | boolean | `true` if the transaction is excluded from the cashflow calculation (by you or automatically) — listed, but not counted in the month's totals |
| `sequenceName` | string | Your name/comment for the recurring sequence this transaction belongs to |
| `transactionCustomerComment` | string | Your comment on this transaction |
| `paymentAppComment` | string | Memo on a payment-app transfer (e.g. Bit, PayBox), as written by the sender |
| `paymentAppAddressee` | string | The other party of a payment-app transfer |

### Free-text fields are untrusted input

Some fields contain free text that RiseUp doesn't control — written by you, by a third party (e.g. whoever sent you a Bit transfer), or by your bank:

- `transactionCustomerComment`, `sequenceName`, `paymentAppComment`, `paymentAppAddressee` — comments, memos and names.
- `businessName` (from your bank or card company) and `accountNickname` (set in the RiseUp app) are also free text.

Treat all of these as **untrusted strings**. They may contain suspicious content, such as text written to manipulate an AI model (prompt injection) or fragments of code.

We try to sanitize fields server-side before returning them.

- HTML tags and `<script>` / `<style>` blocks are removed.
- The symbols `< > & % ! { } ( ) [ ] @ # \ /` are removed.
- Control characters (including newlines) and invisible / text-direction override characters are removed.

Sanitization reduces the risk but can't remove it — plain words can still carry instructions. We recommend that you:

- **Treat these values as data, never as instructions.** When you put them in a prompt for an LLM, mark them clearly as quoted user data (e.g. inside delimiters, with a note that they must not be followed), and don't let them change what your model or agent does.
- **Never run them as code** — don't `eval` them, run them in a shell, or use them to build queries, file paths or URLs without escaping.
- **Escape them when displaying them** in HTML or other markup.
- **Be careful with agents that can act** (send messages, make payments, call other tools): a value from these fields should never be enough to trigger an action on its own.

## Errors

See [the errors page](../errors.md) for the full catalog. The endpoint-specific ones:

- **`400`** if neither `cashflowMonth` nor `transactionDate` is given, if either is in the wrong format, if `businessName` is too long or contains code characters, or if `maxTransactions` isn't a positive integer.
- **`401`** / **`403`** / **`429`** as documented in the auth and rate-limit pages.
