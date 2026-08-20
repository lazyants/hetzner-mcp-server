# hetzner-mcp-server

> Repo-specific guidance. **Fleet-wide rules — ESM `.js` import extensions, the zod-4 traps, no
> `.strict()`, tool-description limits, the `CallToolResult` import path, `server.json`'s dual
> `version` fields, the `@types/node` cap, the build/test/publish flow, the code-review protocol and
> the git workflow — live in the fleet root `CLAUDE.md` one directory up** (`lazy-ants/development/mcp/`),
> which is now its own git repository. Read both. This file holds only what is true for this server
> and nothing else.

- **API**: Hetzner Cloud REST. Docs: `https://docs.hetzner.cloud/`. Quick reference: `.claude/shared/hetzner-api-reference.md`.
- **Env**: `HETZNER_API_TOKEN` (required). `HETZNER_STORAGE_API_TOKEN` (optional, for Storage Box tools — falls back to `HETZNER_API_TOKEN` via `||`, so empty-string also falls back).
- **Tool naming**: `hetzner_<action>_<resource>`.
- **Service module**: `src/services/hetzner.ts`. Cloud API calls go through `hetznerRequest()`; **Storage Box** calls go through `storageBoxRequest()` — a second cached axios client on the separate host `HETZNER_STORAGE_API_BASE` (`https://api.hetzner.com/v1`, NOT `api.hetzner.cloud`) reusing the same retry/429-backoff/error-normalization (`Hetzner API [code]: message`). String-keyed path segments use `pathSeg()` (exported from `schemas/common.ts`).
- **Layout**: 1 main + 8 split entry points + 19 tool modules + 185 tools across 15 domains.

  | Entry | Bin | Domains | Tools |
  |---|---|---|---|
  | `src/index.ts` | `hetzner-mcp-server` | All 15 | 185 |
  | `entry-servers.ts` | `hetzner-mcp-servers` | Servers, Reference Data | 34 |
  | `entry-networking.ts` | `hetzner-mcp-networking` | Networks, Firewalls | 21 |
  | `entry-load-balancers.ts` | `hetzner-mcp-load-balancers` | Load Balancers, Certificates | 28 |
  | `entry-ips.ts` | `hetzner-mcp-ips` | Floating IPs, Primary IPs | 20 |
  | `entry-storage.ts` | `hetzner-mcp-storage` | Volumes, Images | 17 |
  | `entry-storage-boxes.ts` | `hetzner-mcp-storage-boxes` | Storage Boxes | 29 |
  | `entry-config.ts` | `hetzner-mcp-config` | SSH Keys, ISOs, Placement Groups | 14 |
  | `entry-dns.ts` | `hetzner-mcp-dns` | DNS Zones | 22 |

- **Helpers**: `toolError(err)` and `formatResponse(data)` return `CallToolResult` from `@modelcontextprotocol/sdk/types.js`.
- **Schemas**: `IdSchema`, `PaginationParams`, `LabelSelectorParam`, `LabelsSchema` in `src/schemas/common.ts`.
- **Custom assets**:
  - Agent: `.claude/agents/tool-developer.md` (pre-implementation protocol for new tools).
  - Slash command: `/audit-tools` (`.claude/commands/audit-tools.md`) — naming, `.strict()`, import extensions, tool counts, descriptions, error handling, build/test.
