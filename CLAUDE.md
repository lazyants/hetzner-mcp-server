# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP server for the Hetzner Cloud API. 104 tools across 13 resource domains, TypeScript/ESM, shipped as a single npm package with 4 bin entry points.

## Build & Development

```bash
npm run build          # TypeScript compile (tsc) → dist/
npm start              # Run full server (node dist/index.js)
```

Verify startup: `HETZNER_API_TOKEN=test node dist/index.js` — blocks on stdio = working correctly.

```bash
npm test                                       # Run all tests
npx vitest run src/tests/smoke.test.ts         # Run a single test file
```

Tests live in `src/tests/`. Smoke tests verify tool registration counts per entry point. Unit tests cover HTTP client error handling and retry logic.

## Architecture

### Split-Server Strategy

| Entry Point | Bin Command | Domains | Tools |
|---|---|---|---|
| `src/index.ts` | `hetzner-mcp-server` | All 13 domains | 104 |
| `src/entry-servers.ts` | `hetzner-mcp-servers` | Servers, Reference Data | 22 |
| `src/entry-networking.ts` | `hetzner-mcp-networking` | Networks, Firewalls | 17 |
| `src/entry-load-balancers.ts` | `hetzner-mcp-load-balancers` | Load Balancers, Certificates | 22 |
| `src/entry-ips.ts` | `hetzner-mcp-ips` | Floating IPs, Primary IPs | 16 |
| `src/entry-storage.ts` | `hetzner-mcp-storage` | Volumes, Images | 13 |
| `src/entry-config.ts` | `hetzner-mcp-config` | SSH Keys, ISOs, Placement Groups | 14 |

### Core Flow

Entry point → `createServer(name)` → `register*Tools(server)` → `startServer(server)`

### Key Files

- `src/server.ts` — `createServer()` / `startServer()` factory. Uses `createRequire` to load package.json (ESM can't import JSON directly)
- `src/services/hetzner.ts` — Axios HTTP client. ALL API calls go through `hetznerRequest()`. Handles auth, rate limiting (429 retry with exponential backoff, max 3), error normalization (`Hetzner API [code]: message`)
- `src/helpers.ts` — `toolError(err)` and `formatResponse(data)` return `CallToolResult` (imported from `@modelcontextprotocol/sdk/types.js`)
- `src/schemas/common.ts` — Reusable Zod schema fragments: `IdSchema`, `PaginationParams`, `LabelSelectorParam`, `LabelsSchema`
- `src/types/<domain>.ts` — Response interfaces per domain
- `src/tools/<domain>.ts` — Tool registrations per domain, each exports `register<Domain>Tools(server: McpServer): void`

## Adding a New Tool

1. Add response interfaces in `src/types/<domain>.ts`
2. In `src/tools/<domain>.ts`, add a `server.registerTool()` call inside the `register*Tools` function
3. Wire the register function into the appropriate entry point(s)
4. Run `npm run build` to verify

### Tool Registration Pattern

```typescript
server.registerTool(
  'hetzner_<action>_<resource>',
  {
    title: 'Human Title',
    description: 'One sentence, under 40 words.',
    inputSchema: z.object({
      id: IdSchema.describe('Resource ID'),
      ...PaginationParams,      // spread common schemas inline
      ...LabelSelectorParam,
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  async (params) => {           // params are already validated by MCP SDK
    try {
      const data = await hetznerRequest('GET', `/resource/${params.id}`);
      return formatResponse(data);
    } catch (err) {
      return toolError(err);
    }
  }
);
```

For update/PUT tools, separate the path param from the body: `const { id, ...body } = params`

### Annotations Reference

| Action Type | readOnly | destructive | idempotent |
|---|---|---|---|
| list, get, metrics | true | false | true |
| create, add, assign, attach | false | false | false |
| update, change, set | false | false | true |
| delete, remove, detach, unassign | false | true | true |
| power, reboot, reset, shutdown | false | true | false |

All tools set `openWorldHint: true`.

## Git Workflow

- Commit immediately after modifications — don't batch unrelated changes
- Present tense, imperative mood: "Add volume resize tool" not "Added volume resize tool"
- Only stage specific files — **NEVER** `git add -A` or `git add .`
- No Co-Authored-By signatures — commits should look human

## Debugging

If 3+ attempts at the same fix fail, stop and reconsider the approach. Challenge assumptions about root cause before trying again.

## Critical Rules

- **CRITICAL**: All relative imports MUST use `.js` extension — `import { x } from '../helpers.js'` (ESM requirement, TypeScript resolves `.js` → `.ts` at compile time)
- **CRITICAL**: Use Zod v3 API (`zod@^3.25`). Do NOT upgrade to Zod v4 — it has `.describe()` propagation bugs with the MCP SDK
- **NEVER** use `.strict()` on Zod schemas — breaks MCP SDK schema generation
- Tool descriptions: 1-2 sentences max, no cross-references to other tools
- `CallToolResult` type imports from `@modelcontextprotocol/sdk/types.js`, not from `server/mcp.js`
- Environment variable `HETZNER_API_TOKEN` is required at runtime
- Hetzner API reference: https://docs.hetzner.cloud/
