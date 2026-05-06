# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 2.x     | ✅        |

Older majors are not supported. Once `3.x` is released, `2.x` will receive
security fixes for at least 6 months.

## Reporting a vulnerability

If you discover a security issue in `@lazyants/hetzner-mcp-server`, please
report it privately rather than opening a public GitHub issue.

**Preferred channel — GitHub Security Advisories**

Open a private advisory at
<https://github.com/lazyants/hetzner-mcp-server/security/advisories/new>.
GitHub will notify the maintainers and let us coordinate a fix and disclosure
timeline with you.

**Alternative — email**

If GitHub Security Advisories are not available to you, send a description
to **smaxims@gmail.com** with `[hetzner-mcp-server security]` in the subject.
We aim to acknowledge reports within 3 business days.

## What to include

- The version of `@lazyants/hetzner-mcp-server` and Node.js you tested.
- A minimal reproduction (preferably a payload, an MCP-tool invocation, or
  a stack trace).
- Your assessment of impact: data leakage, unauthenticated execution,
  privilege escalation, denial of service, etc.

## What is in scope

- The MCP server itself: tool registration, request handling, the
  `services/hetzner.ts` axios client, and the rate-limiting / retry layer.
- The published npm artifact (`dist/`).
- Sample configurations in `README.md` that could mislead users into an
  insecure setup.

## What is out of scope

- Vulnerabilities in the upstream Hetzner Cloud API itself —
  please report those to Hetzner.
- Issues in transitive devDependencies that do not ship in the published
  package (e.g. `vitest`, its sub-deps). We track them via Dependabot but
  do not treat them as security incidents.
- Misconfiguration of the consumer's own environment (leaked
  `HETZNER_API_TOKEN`, over-privileged API tokens, etc.).

## Responsible disclosure

Please do not disclose the issue publicly until a fix has been released and
the maintainers have had a reasonable opportunity to coordinate. We commit
to working on a fix promptly and crediting reporters in the changelog
unless you ask to remain anonymous.
