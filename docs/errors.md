# Errors

All `/api/external/*` endpoints follow standard HTTP semantics. Responses are JSON unless otherwise noted. Every response — successful or not — carries an `X-Riseup-Token-Ref` header you can quote when asking for support.

## `401 Unauthorized`

The token is missing, malformed, expired, or has been revoked.

```http
HTTP/1.1 401 Unauthorized
X-Riseup-Token-Ref: 9a8b7c6d5e4f3a2b
```

Common causes:

| Cause | What to check |
|---|---|
| Missing `Authorization` header | You forgot to set it, or it didn't reach the server |
| Header value doesn't start with `Bearer riseup_pat_` | Wrong prefix, or typo |
| Token revoked | Look it up on https://input.riseup.co.il/developer/tokens |
| Token expired (30+ days old) | Mint a new one |

The response body is empty. The header is the only correlation handle.

## `403 Forbidden`

You authenticated successfully, but your token doesn't have the scope required for this endpoint.

```http
HTTP/1.1 403 Forbidden
X-Riseup-Token-Ref: 9a8b7c6d5e4f3a2b
```

To fix: revoke the token, mint a new one with the required scope checked. We can't add scopes to an existing token by design — it would defeat the audit trail.

## `429 Too Many Requests`

You hit the rate limit. See [rate-limits](./rate-limits.md) for the details.

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 12
X-Riseup-Token-Ref: 9a8b7c6d5e4f3a2b

{
  "error": "rate_limit_exceeded",
  "window": "minute",
  "retryAfterSeconds": 12
}
```

Wait at least `retryAfterSeconds` seconds before retrying.

## `4xx` validation errors

If you call an endpoint with invalid path parameters (e.g. a malformed date), you'll get a `400 Bad Request` with a JSON body describing the validation failure. The exact shape comes from our validation library and isn't part of the stable API contract — write your client to handle "any 4xx with a body" gracefully rather than parsing specific fields.

## `5xx` server errors

Something on our side broke. The body may be empty or contain an error message — neither is part of the stable contract.

If you're seeing repeated 5xx for a specific endpoint, send us the `X-Riseup-Token-Ref` from one of the failed responses plus the approximate time, and we can trace the underlying call.

For automation, treat 5xx as a transient signal:

1. Wait at least a few seconds (don't retry instantly).
2. Cap total retries — `5xx` that doesn't go away after 3 retries is unlikely to fix itself within a useful window.
3. Don't compound with the rate limit — every retry counts against your minute and day budgets.

## Anything else

If you see a response that doesn't fit any of the cases above (an unexpected status code, an HTML body where you expected JSON, a hung connection), it's almost certainly a transient infrastructure issue between you and us. Retry once, then back off.
