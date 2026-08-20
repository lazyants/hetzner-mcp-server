---
name: tool-developer
description: Workflow agent for creating and maintaining Hetzner MCP tools
---

# Tool Developer Agent

Specialized workflow for adding, modifying, or debugging tools in this MCP server.

## Pre-Implementation Protocol

Before creating or modifying a tool:

1. **Check Hetzner API docs** at https://docs.hetzner.cloud/ for the endpoint's exact path, method, request body, and response shape
2. **Review an existing similar tool file** — find the closest domain in `src/tools/` and follow its patterns exactly
3. **Confirm which split the tool belongs to** — read `src/splits.ts`, the authoritative partition.
   `CLAUDE.md` deliberately no longer duplicates it.
4. **Check `.claude/shared/hetzner-api-reference.md`** for API conventions (pagination, errors, rate limits)

## Implementation Workflow

1. **Types** — Add/update response interfaces in `src/types/<domain>.ts`
2. **Tools** — Add `server.registerTool()` call in `src/tools/<domain>.ts` inside the `register*Tools` function
3. **Wire — edit `src/splits.ts` and nothing else.** It is the single source of truth for the
   registrar partition. `src/index.ts` and every `src/entry-*.ts` binary consume `ALL_REGISTRARS`
   / `SPLITS` from it and import **no** tool registrar directly, so editing an entry file is both
   unnecessary and wrong. Add the registrar to the right `SPLITS` key and bump that split's
   `toolCount`:
   - Servers, Reference Data (datacenters/locations/server-types), Pricing → `servers`
   - Networks, Firewalls → `networking`
   - Load Balancers, Certificates → `load-balancers`
   - Floating IPs, Primary IPs → `ips`
   - Volumes, Images → `storage`
   - Storage Boxes → `storage-boxes`
   - SSH Keys, ISOs, Placement Groups → `config`
   - DNS Zones → `dns`
4. **Build** — `npm run build`
5. **Test** — `npm test` (smoke tests verify tool counts — update expected counts if adding tools)
6. **Verify** — `HETZNER_API_TOKEN=test node dist/index.js` starts without error

## Verification Checklist

- [ ] Tool name follows `hetzner_<action>_<resource>` convention
- [ ] Description is 1-2 sentences, under 40 words
- [ ] Annotations match the action verb. Every tool in `src/tools/` follows this exactly — measured
      2026-08-20, no exceptions within a verb. `openWorldHint` is `true` everywhere; each of these
      tools calls the Hetzner API.

      | Verb | `readOnlyHint` | `destructiveHint` | `idempotentHint` |
      |---|---|---|---|
      | `get`, `list` | `true` | `false` | `true` |
      | `update` | `false` | `false` | `true` |
      | `delete` | `false` | `true` | `true` |
      | `create` | `false` | `false` | `false` |

      For a verb not listed, copy the closest existing tool rather than inventing a combination.
- [ ] All imports use `.js` extension
- [ ] No `.strict()` on Zod schemas
- [ ] Handler passed through `handleToolRequest()` — it owns BOTH the try/catch → `toolError()`
      conversion and the `formatResponse()` return. Do **not** add your own try/catch or return
      `formatResponse(data)` explicitly; no existing registration in `src/tools/` does.
- [ ] `npm run build` passes
- [ ] `npm test` passes (update smoke test counts if tools were added/removed)

## References

- **Conventions & critical rules** → `CLAUDE.md` (naming, wiring via `src/splits.ts`, the
  `handleToolRequest` contract, the `pathSeg` path-traversal rule)
- **Split partition, registrars, per-split tool counts** → `src/splits.ts`
- **Tool registration pattern** → the closest existing module in `src/tools/`
- **API conventions** → `.claude/shared/hetzner-api-reference.md`
- **Audit tool** → Run `/audit-tools` to check all conventions across the codebase

## Common Patterns

Each is the body of a `handleToolRequest(async (params) => { ... })` callback — return the raw
value, not a `CallToolResult`.

**GET (list/get):** `hetznerRequest('GET', '/resource', undefined, params)`
**POST (create/action):** `hetznerRequest('POST', '/resource', body)`
**PUT (update):** `const { id, ...body } = params; hetznerRequest('PUT', \`/resource/\${id}\`, body)`
**DELETE:** `hetznerRequest('DELETE', \`/resource/\${params.id}\`)`
**Storage Box:** `storageBoxRequest(...)` — a second client on `api.hetzner.com`, not `api.hetzner.cloud`.

## Gotchas

- **String-typed identifiers (`id_or_name`) must go through the shared `pathSeg()` helper.** It is
  exported from `src/schemas/common.ts` (`zones.ts` imports it from there) and is paired with
  `PathSegmentSchema` / `IdOrNameSchema`. Use all three together for any resource that accepts a
  name *or* numeric ID. Do **not** hand-roll `encodeURIComponent`: it does not escape `.` or `..`,
  so a bare wrapper reintroduces path traversal — which is why the schemas exist alongside the
  helper. Raw template-literal interpolation additionally lets `?`, `#`, `%`, `/`, `@` break out of
  the path segment; codex caught that on PR #24. Numeric `IdSchema` segments need no encoding — Zod
  rejects non-integers before the template runs.
- **Prefer the OpenAPI `cloud.spec.json` for endpoint existence and request/response schemas; use `hcloud-go` as a cross-check only — it is permitted to lag behind the REST spec.** The server calls the REST API directly, so the spec is authoritative (e.g. `POST /load_balancers/{id}/actions/change_dns_ptr` exists in `cloud.spec.json` but is absent from `hcloud-go`). Three plan-time docs-site inaccuracies surfaced in this fleet, all resolved against the spec/SDK: (a) `POST /zones/.../validate` doesn't exist; (b) the export/import paths are `GET /zones/.../zonefile` and `POST /zones/.../actions/import_zonefile`, NOT `/export` and `/import`; (c) `enable_backup` has no body (the `backup_window` field is deprecated). Re-read the spec at build time before shipping.
- **Hetzner deprecated per-action-id GET endpoints (April 2026).** Do NOT add `hetzner_get_<resource>_action` tools — only `hetzner_list_<resource>_actions` is forward-compatible. Applies fleet-wide (servers, LBs, volumes, networks, FIPs, PIPs, certificates, images, zones).
- **`paramsSerializer: { indexes: null }` in `src/services/hetzner.ts` is load-bearing.** Hetzner expects repeated query keys (`?type=A&type=AAAA`), but axios defaults to `?type[]=A&type[]=AAAA`. If you add array-valued query params, verify against the docs that Hetzner accepts them in the repeated-key form. The serializer was added in PR #24.
