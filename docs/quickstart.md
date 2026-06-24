# Quickstart

Get from zero to your first authenticated call against the RiseUp API in about five minutes.

## 1. Create a Personal Access Token

1. Log in to the RiseUp web app at https://input.riseup.co.il.
2. Open the **Developer Tokens** page (`/developer/tokens`).
3. Click **Create new token**, give it a label (e.g. `Claude Desktop on my laptop`), and confirm.
4. **Copy the token immediately.** It's shown only once. It looks like:

   ```
   riseup_pat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

If you lose it, revoke the token and create a new one from the same page.

## 2. Call the API with curl

```bash
curl -H "Authorization: Bearer riseup_pat_..." \
  https://input.riseup.co.il/api/external/budget/current
```

That returns your current month's budget as JSON. The response also includes an `X-Riseup-Token-Ref` header — a short, non-reversible handle for the token you used. Useful for correlating your request with our server-side logs if you ever need support.

## 3. Use it from Claude Desktop

Install the MCP package:

```bash
npm install -g @riseup-oss/mcp
```

Add this to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "riseup": {
      "command": "npx",
      "args": ["-y", "@riseup-oss/mcp"],
      "env": {
        "RISEUP_PAT": "riseup_pat_..."
      }
    }
  }
}
```

Restart Claude Desktop. Then ask:

> What's my RiseUp budget for this month?

Claude will call the `get_budget` tool, which fetches your budget through the same API and returns the result.

## What's next

- [Authentication](./authentication.md) — token format, headers, revocation.
- [Rate limits](./rate-limits.md) — how often you can call, and what happens when you don't.
- [Errors](./errors.md) — what each error response means.
- [Budget reference](./reference/budget.md) — the three budget endpoints in detail.
