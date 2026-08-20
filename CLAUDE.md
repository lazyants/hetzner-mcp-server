# hetzner-mcp-server

Guidance for working in this repository. **Self-contained** — everything needed to work here safely
is below. If you are in the `lazy-ants/development/mcp/` fleet checkout, the fleet-root `CLAUDE.md`
one directory up carries the same cross-cutting rules plus fleet-only material (the publishing
playbook, the hygiene skill, the sibling servers). A standalone clone of this repo does not have it
and does not need it.

## Cross-cutting rules (all three lazy-ants MCP servers)

- **ESM + Node16 module resolution**: all relative imports MUST use the `.js` extension —
  `import { x } from '../helpers.js'`. TypeScript resolves `.js` → `.ts` at compile time.
- **NEVER** call `.strict()` on Zod schemas — it breaks MCP SDK schema generation.
- **Zod 4** (`zod ^4.4.3` here; requires MCP SDK ≥ 1.29). Two traps: the 1-arg
  `z.record(valueType)` overload is gone — use `z.record(z.string(), z.unknown())`; and
  `z.preprocess` outputs are tagged `optin: "optional"`, which silently drops required fields from
  the MCP `tools/list` `required[]` array. Runtime-verify `.describe()` propagation AND `required[]`
  via a `tools/list` round-trip in `{ io: 'input' }` mode before bumping the zod major.
- **Tool descriptions**: 1–2 sentences, no cross-references to other tools.
- **`CallToolResult` import path**: `@modelcontextprotocol/sdk/types.js`, NOT `server/mcp.js`.
- **`server.json` dual `version` fields**: root `version` is the MCP Registry version (unique per
  publish); `packages[0].version` is the npm version (must exist on npm). They may differ.
- **`@types/node` is capped at the `engines.node` floor** (Node 20). Reject Dependabot major bumps.
- **Git**: commit right after a change, present-tense imperative subject, never `git add -A`/`.`,
  no `Co-Authored-By` or "Generated with" trailers. Default branch `main`.
- **Counts in this file are pinned by `src/tests/smoke.test.ts`.** It is the source of truth — if a
  number here and a number there disagree, the test wins and this file is stale.

## Repository specifics

- **API**: Hetzner Cloud REST. Docs: `https://docs.hetzner.cloud/`. Quick reference:
  `.claude/shared/hetzner-api-reference.md`.
- **Env**: `HETZNER_API_TOKEN` (required). `HETZNER_STORAGE_API_TOKEN` (optional, for Storage Box
  tools — falls back to `HETZNER_API_TOKEN` via `||`, so an empty string also falls back).
- **Tool naming**: `hetzner_<action>_<resource>`.
- **Service module**: `src/services/hetzner.ts`. Cloud API calls go through `hetznerRequest()`;
  **Storage Box** calls go through `storageBoxRequest()` — a second cached axios client on the
  separate host `HETZNER_STORAGE_API_BASE` (`https://api.hetzner.com/v1`, **not** `api.hetzner.cloud`)
  reusing the same retry / 429-backoff / error normalization (`Hetzner API [code]: message`).
- **Wiring lives in `src/splits.ts`**, not in the entry files. It exports `SPLITS` and
  `ALL_REGISTRARS`; `src/index.ts` and every `src/entry-*.ts` consume those and import **no** tool
  registrar directly. Adding a tool module means registering it in `src/splits.ts`.
- **Handlers use `handleToolRequest()`**, which owns the try/catch → `toolError()` conversion and the
  `formatResponse()` return. None of the 185 registrations has its own `toolError` call; do not add
  per-handler try/catch or an explicit `formatResponse(data)` return.
- **Path segments**: use `pathSeg()` — already exported from `src/schemas/common.ts` — together with
  `PathSegmentSchema` / `IdOrNameSchema`. Do not hand-roll `encodeURIComponent`: it does not escape
  `.` or `..`, which is a path-traversal risk for string-keyed resources.
- **Layout**: 1 main + 8 split entry points + 19 tool modules + 185 tools across 15 domains
  (`TOTAL_TOOL_COUNT` is pinned at 185 in `src/tests/smoke.test.ts`).

  | Entry | Bin | Domains | Tools |
  |---|---|---|---|
  | `src/index.ts` | `hetzner-mcp-server` | All 15 | 185 |
  | `src/entry-servers.ts` | `hetzner-mcp-servers` | Servers, Reference Data | 34 |
  | `src/entry-networking.ts` | `hetzner-mcp-networking` | Networks, Firewalls | 21 |
  | `src/entry-load-balancers.ts` | `hetzner-mcp-load-balancers` | Load Balancers, Certificates | 28 |
  | `src/entry-ips.ts` | `hetzner-mcp-ips` | Floating IPs, Primary IPs | 20 |
  | `src/entry-storage.ts` | `hetzner-mcp-storage` | Volumes, Images | 17 |
  | `src/entry-storage-boxes.ts` | `hetzner-mcp-storage-boxes` | Storage Boxes | 29 |
  | `src/entry-config.ts` | `hetzner-mcp-config` | SSH Keys, ISOs, Placement Groups | 14 |
  | `src/entry-dns.ts` | `hetzner-mcp-dns` | DNS Zones | 22 |

- **Helpers**: `toolError(err)` and `formatResponse(data)` return `CallToolResult` from
  `@modelcontextprotocol/sdk/types.js` — both are called for you by `handleToolRequest()`.
- **Schemas**: `IdSchema`, `PaginationParams`, `LabelSelectorParam`, `LabelsSchema`, `pathSeg`,
  `PathSegmentSchema`, `IdOrNameSchema` in `src/schemas/common.ts`.
- **Custom assets** (in this repo, under `.claude/`):
  - Agent `.claude/agents/tool-developer.md` — pre-implementation protocol for new tools.
  - Slash command `/audit-tools` (`.claude/commands/audit-tools.md`).
