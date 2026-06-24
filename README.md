# @riseup-oss/mcp

Official [MCP](https://modelcontextprotocol.io) server for [RiseUp](https://riseup.co.il) — programmatic read-only access to your own cashflow data from Claude Desktop, Base44, the Claude Agent SDK, and other MCP clients.

> **Status:** v0.1. The package returns real data via the RiseUp API.

## What you can do with it

Once installed and configured, ask your AI assistant questions like:

- "What's my RiseUp budget for this month?"
- "Show me my budget for May 2026."
- "Compare my budget to last month."

The assistant calls the `get_budget` tool, which fetches your real cashflow data through RiseUp's Exposed API using a Personal Access Token (PAT) you created.

## Installation

```bash
npm install -g @riseup-oss/mcp
```

Requires Node.js 18+.

## Setup

### 1. Create a Personal Access Token

Visit RiseUp's [developer tokens page](https://input.riseup.co.il/developer/tokens), create a token, pick the `budget:read` scope, and copy it. **It is shown only once.**

The token looks like `riseup_pat_<32-bytes-base64url>`.

### 2. Configure your MCP client

#### Claude Desktop

Add to your `claude_desktop_config.json` (on macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "riseup": {
      "command": "npx",
      "args": ["-y", "@riseup-oss/mcp"],
      "env": {
        "RISEUP_PAT": "riseup_pat_paste_your_token_here"
      }
    }
  }
}
```

**Fully quit Claude Desktop (Cmd+Q on macOS) and reopen** — closing the window isn't enough. Claude Desktop reads `claude_desktop_config.json` only at startup, so any change to `RISEUP_PAT` or other env values needs a full restart to take effect. After restart, the `get_budget` tool should appear.

#### Claude Agent SDK

```typescript
import { Claude } from '@anthropic-ai/claude-agent-sdk';

const claude = new Claude({
  mcpServers: {
    riseup: {
      command: 'npx',
      args: ['-y', '@riseup-oss/mcp'],
      env: { RISEUP_PAT: process.env.RISEUP_PAT },
    },
  },
});
```

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `RISEUP_PAT` | yes | — | Your `riseup_pat_…` Personal Access Token |
| `RISEUP_API_BASE` | no | `https://input.riseup.co.il` | Override for staging / dev environments |

## Tools (v0.1)

| Tool | Scope required | Description |
|---|---|---|
| `get_budget` | `budget:read` | Get the customer's budget for a given month. Accepts `YYYY-MM`, `current`, or `previous`. |

More tools (`get_transactions`, `get_balances`, `get_cashflow`) coming in v0.2+.

## Documentation

Longer-form docs live in [`docs/`](./docs):

- [Quickstart](./docs/quickstart.md) — first API call in five minutes
- [Authentication](./docs/authentication.md) — token format, headers, revocation, the `X-Riseup-Token-Ref` correlation header
- [Rate limits](./docs/rate-limits.md) — limits, the `429` shape, how to handle it
- [Errors](./docs/errors.md) — the full error catalog
- [Budget reference](./docs/reference/budget.md) — the three budget endpoints in detail

## Security

- The PAT lives only in your local MCP client config — it is **never** sent to Anthropic or any third party. The MCP server runs on your machine; it only communicates with the RiseUp API and your local MCP client.
- The token is read-only. It cannot make changes to your account.
- Tokens expire after 30 days by default. Revoke a token any time at `/developer/tokens`.
- Never share your token, paste it into a chat, or commit it to source control.

## Development

```bash
git clone git@github.com:riseup-oss/mcp.git
cd mcp
npm install
npm run build
npm test
```

### Local smoke tests

`examples/smoke-test.mjs` drives the built MCP server as a real MCP client (same `@modelcontextprotocol/sdk` stdio transport Claude Desktop uses), calls `get_budget`, and prints PII-safe shape signals about the response — useful for verifying the end-to-end pipeline (PAT → RiseUp API → back) without piping an LLM into the loop:

```bash
RISEUP_PAT=riseup_pat_... RISEUP_API_BASE=http://127.0.0.1:6040 \
  node examples/smoke-test.mjs --date=current
```

`examples/fetch-budget.mjs` is a lower-level alternative that calls the HTTP endpoint directly and dumps the JSON body to stdout for local inspection:

```bash
RISEUP_PAT=riseup_pat_... node examples/fetch-budget.mjs 2026-05 > /tmp/budget.json
```

Both default `RISEUP_API_BASE` to `http://127.0.0.1:6040` because Node 18's `fetch` resolves `localhost` to `::1` and most servers bind IPv4 only — set explicitly if your local API server is elsewhere.

## License

MIT
