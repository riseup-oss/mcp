# Security Policy

## Reporting a Vulnerability

If you've found a security issue in `@riseup-oss/mcp`, please report it **privately** — do not open a public GitHub issue. Public disclosure before we have a fix puts every user of the package at risk.

**Preferred channel:** email **security@riseup.co.il**

**Web:** see RiseUp's published security disclosure policy at [https://www.riseup.co.il/security/vulnerabilityeng/](https://www.riseup.co.il/security/vulnerabilityeng/).

We acknowledge reports within **2 business days** and aim to publish a fix or workaround for confirmed issues within **30 days** of acknowledgement. If you'd like to be credited in the release notes, let us know.

## What's in scope

Findings about this package specifically:

- Anything that could exfiltrate a customer's Personal Access Token (PAT) to a host other than the configured `RISEUP_API_BASE` — for example, an unintended outbound network call, a logging path that includes the `Authorization` header, an injection vector that controls the request URL.
- Anything that could exfiltrate response bodies (the customer's RiseUp data) to a third party — for example, writing responses to disk, sending them to a telemetry endpoint, including them in error messages that get reported elsewhere.
- Supply-chain issues in our dependencies — a hijacked patch release, name-squatting, a transitive dependency with a known CVE we haven't picked up.
- Tool-input handling — an MCP client crafting content that escapes our `zod` schema validation in a way that produces unexpected behavior.
- The local-dev convenience exceptions (`http://localhost` / `127.0.0.1`) being bypassable from a production install.

## What's not in scope

- The RiseUp API itself. The `/api/external/*` endpoints live in a separate codebase; report those through [RiseUp's main security disclosure page](https://www.riseup.co.il/security/vulnerabilityeng/).
- Issues that require physical access to the user's machine (e.g. reading their `RISEUP_PAT` env var from a shell history).
- Issues already known and reported upstream in our dependencies — let us know so we can pull the patched version sooner, but you don't need to wait on us to publish.
- Findings in older versions if you can reproduce the same on the latest. We support the latest published version.

## What we won't do

- We won't ignore a valid report. If you don't hear back within 2 business days, please re-send — your first email may have hit a spam filter.
- We won't take legal action against good-faith security research. Researchers acting in good faith, who don't compromise customer data or service availability, are welcome.

## What helps us

- A minimal reproduction (a script, a curl, a sequence of MCP calls) — saves us hours of guessing.
- A concrete blast radius — what an attacker could do with this. "PAT exfil to attacker-controlled host" is much more useful than "untrusted input flows to a URL."
- Your suggested fix or mitigation, if you have one.
