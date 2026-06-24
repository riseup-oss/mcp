# Authentication

The RiseUp API uses **Personal Access Tokens (PATs)** for authentication. A PAT is a long-lived bearer token tied to your RiseUp account.

## Token format

Every PAT starts with the prefix `riseup_pat_` followed by 32 cryptographically random bytes, base64url-encoded:

```
riseup_pat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Total length is around 55 characters. Treat the token like a password — anyone who has it can read your data.

## Sending the token

Send the token in the standard HTTP `Authorization` header with the `Bearer` scheme:

```
Authorization: Bearer riseup_pat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Every request to `/api/external/*` requires this header. Requests without a valid PAT-shaped header get rejected with `401 Unauthorized`.

## Creating a token

PATs can only be created from inside a logged-in web session at https://input.riseup.co.il/developer/tokens. This is intentional — minting a token requires the same 2-factor authentication you use to log in, so a stolen API key alone can't be used to mint more tokens.

When you create a token you choose its **scope**. Today the only available scope is:

- **`budget:read`** — read access to your monthly budget data.

More scopes will be added as we expose additional endpoints. A token you create today with `budget:read` will keep working for the budget endpoints; it doesn't need to be re-issued when new scopes become available.

## Token lifetime

PATs are valid for **30 days** from creation. After expiry, calls return `401` and you'll need to mint a new token. There's no automatic refresh — by design, since refresh tokens introduce a category of attack we don't want for this use case.

You'll see the token's expiration date on the Developer Tokens page next to each token.

## Revoking a token

If a token leaks — your laptop is lost, a config file with the token leaks to a repo, your MCP client behaves unexpectedly — revoke it immediately:

1. Log in to https://input.riseup.co.il/developer/tokens.
2. Find the token by its label.
3. Click **Revoke**.

The token stops working immediately. Any in-flight requests using the token will get `401` on their next call. You can issue a new token with the same label if you want a drop-in replacement.

## The `X-Riseup-Token-Ref` header

Every response to an `/api/external/*` call carries an `X-Riseup-Token-Ref` header with a short, non-reversible reference for the token you used:

```
X-Riseup-Token-Ref: 9a8b7c6d5e4f3a2b
```

This is the same reference our server-side logs use. If you ever need support, send us this value and the timestamp of your request — that's enough to find the corresponding log line without you ever having to share the token itself.

The header is present on all responses including `401` and `403`, so you can correlate auth failures the same way.

## Security notes

- **Never commit a PAT to a repository**, even a private one. Use environment variables (`RISEUP_PAT`) or your OS keychain.
- **Never log a PAT** in your client. Log the `X-Riseup-Token-Ref` if you need a reference.
- **Never share a PAT with another user** — each person should mint their own. PAT calls are audited by token, so a shared PAT loses that traceability.
- **Treat 401s as suspicious.** If your previously-working token starts returning 401 unexpectedly, check the Developer Tokens page — it may have been revoked.
