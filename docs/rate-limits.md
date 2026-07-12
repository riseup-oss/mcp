# Rate limits

The RiseUp API enforces two rate limits per token, applied in series. Both windows are tracked on the server side and shared across all `/api/external/*` endpoints.

| Window | Limit |
|---|---|
| Per minute | **60 requests** |
| Per day | **1000 requests** |

A request that exceeds either window gets rejected with `429 Too Many Requests` and a `Retry-After` header telling you how long to wait.

## Why two windows

The per-minute cap controls burst rate so a runaway client (or an LLM in a tight loop) can't hammer the API. The per-day cap controls aggregate usage — RiseUp data doesn't change that fast, and most legitimate use cases need far fewer than 1000 calls a day.

If you regularly hit either limit with legitimate traffic, get in touch — we can revisit the numbers.

## The `429` response

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 12
Content-Type: application/json
X-Riseup-Token-Ref: 9a8b7c6d5e4f3a2b

{
  "error": "rate_limit_exceeded",
  "window": "minute",
  "retryAfterSeconds": 12
}
```

- **`Retry-After`** — the standard HTTP header (RFC 9110, §10.2.3). Number of seconds to wait before retrying. Always at least 1.
- **`window`** — which limit you hit. `"minute"` means you'll be unblocked within the minute. `"day"` means you'll be unblocked at the start of the next 24-hour window.
- **`retryAfterSeconds`** — same value as the header, in JSON for programmatic clients.

The `Retry-After` value is always rounded up, so retrying exactly at that timestamp is safe — you won't be told "wait 1 second" and find out 1.4 seconds later that the limit is still active.

## How to handle 429 in your client

The minimum: **don't retry blindly.** A loop that immediately retries on 429 will compound the problem and may get your token flagged.

A reasonable pattern:

```ts
const response = await fetch(url, { headers });
if (response.status === 429) {
  const retryAfter = Number(response.headers.get('Retry-After') ?? 60);
  await new Promise(r => setTimeout(r, retryAfter * 1000));
  // Try again, but cap your total retries.
}
```

For automation that runs unattended, log the 429 with the token reference and stop. A human will see the alert sooner than an exponential backoff would naturally pause.

## Counters are per-token

The limits are keyed on the **token**, not your customer ID. If you have two PATs (e.g. one for Claude Desktop, one for a scripted integration), each gets its own budget.

This also means: if you've burned through a token's daily budget, minting a fresh token resets the count. We notice this pattern in the audit log and may rate-limit at a coarser level if it's abused, so use it judiciously — it's not a loophole.

## Failed calls still count

A request that returns `4xx` or `5xx` still consumes one slot in your minute and day budgets. This is intentional — otherwise a client could DoS the API by making calls that intentionally fail.

The only exception is `429` itself: rejected requests don't count against the limit, because the limit is what rejected them.
