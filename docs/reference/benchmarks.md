# Benchmarks endpoint

Requires the `benchmarks:read` scope. Send your PAT in the `Authorization` header:

```
Authorization: Bearer riseup_pat_...
```

Every response carries `X-Riseup-Token-Ref` for correlation.

This endpoint backs the `get_benchmarks_data` MCP tool.

## `GET /api/external/benchmarks`

Compares your spending in a category with a group of similar RiseUp customers. Similar customers are chosen by a model using city, average income, number of kids, marital status and other parameters.

Benchmarks exist for these spend areas:

| `spendArea` | Category |
|---|---|
| `eating_out` | אוכל בחוץ (eating out) |
| `economy` | כלכלה (groceries / household) |
| `electricity` | חשמל (electricity) |
| `insurance` | ביטוח (insurance) |
| `mortgage` | משכנתא (mortgage) |
| `loan` | הלוואה (loans) |
| `communication` | תקשורת (phone, internet, TV) |
| `car` | רכב (car) |
| `public_transport` | תחבורה ציבורית (public transport) |

Not every customer has a benchmark in every area.

| Parameter | Type | Required | Notes |
|---|---|---|---|
| `spendAreas` | string (repeatable) | no | Return only these spend areas. Repeat the parameter for several. Omit for all available. |

```bash
curl -H "Authorization: Bearer riseup_pat_..." \
  "https://input.riseup.co.il/api/external/benchmarks?spendAreas=economy&spendAreas=eating_out"
```

## Response shape

```json
{
  "benchmarks": [
    {
      "spendArea": "economy",
      "category": "כלכלה",
      "customerSpend": 1800,
      "customerSpendPercentile": 61,
      "similarCustomersMean": 1550,
      "comparedBy": {
        "numberOfKids": "ילד אחד",
        "maritalStatus": "נשוי/אה",
        "city": "תל אביב",
        "monthlyIncomeRange": { "from": 10000, "to": 20000 }
      }
    }
  ],
  "_meta": { "source": "riseup-external-api", "tokenRef": "9a8b7c6d5e4f3a2b" }
}
```

One entry per spend area with a benchmark — a missing area means no benchmark is available for it:

| Key | Type | Notes |
|---|---|---|
| `spendArea` | string | One of the spend areas listed above |
| `category` | string | The spend area's Hebrew category name |
| `customerSpend` | number | Your typical monthly spend in this area over the last 6 months (ILS) |
| `customerSpendPercentile` | number | The % of similar customers who spend **less** than you. `65` → you spend more than 65% of them; `18` → you spend less than 82% of them. |
| `similarCustomersMean` | number | Average monthly spend of the similar customers (ILS) |
| `comparedBy` | object | Your values for the main parameters similar customers were matched on — see below |

`comparedBy` fields are Hebrew labels, or `null` when unknown or not used for the match:

| Key | Type | Notes |
|---|---|---|
| `numberOfKids` | string \| null | e.g. `ללא ילדים`, `ילד אחד`, `4-5 ילדים` |
| `maritalStatus` | string \| null | e.g. `נשוי/אה` |
| `city` | string \| null | Set for Tel Aviv, Jerusalem and Be'er Sheva matches |
| `monthlyIncomeRange` | object \| null | `{ from, to }` monthly income bucket in ILS, in 10,000 steps. `to: null` means "and above". |

## Errors

See [the errors page](../errors.md) for the full catalog. The endpoint-specific ones:

- **`400`** if `spendAreas` contains a value that isn't one of the spend areas listed above.
- **`401`** / **`403`** / **`429`** as documented in the auth and rate-limit pages — a `403` here usually means your token was created without `benchmarks:read`.
