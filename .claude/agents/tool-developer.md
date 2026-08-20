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
3. **Confirm which split server** the tool belongs to (see entry point table in CLAUDE.md)
4. **Check `.claude/shared/hetzner-api-reference.md`** for API conventions (pagination, errors, rate limits)

## Implementation Workflow

1. **Types** — Add/update response interfaces in `src/types/<domain>.ts`
2. **Tools** — Add `server.registerTool()` call in `src/tools/<domain>.ts` inside the `register*Tools` function
3. **Wire** — Import and call the register function in the correct entry point(s). The layout is 1 main (`src/index.ts`) + 7 split entries (including `entry-dns`), documented in fleet `CLAUDE.md`; register in `src/index.ts` (the all-tools binary) AND in the matching split entry:
   - Servers, Reference Data (datacenters/locations/server-types), Pricing → `src/entry-servers.ts` + `src/index.ts`
   - Networks, Firewalls → `src/entry-networking.ts` + `src/index.ts`
   - Load Balancers, Certificates → `src/entry-load-balancers.ts` + `src/index.ts`
   - Floating IPs, Primary IPs → `src/entry-ips.ts` + `src/index.ts`
   - Volumes, Images → `src/entry-storage.ts` + `src/index.ts`
   - SSH Keys, ISOs, Placement Groups → `src/entry-config.ts` + `src/index.ts`
   - DNS Zones → `src/entry-dns.ts` + `src/index.ts`
4. **Build** — `npm run build`
5. **Test** — `npm test` (smoke tests verify tool counts — update expected counts if adding tools)
6. **Verify** — `HETZNER_API_TOKEN=test node dist/index.js` starts without error

## Verification Checklist

- [ ] Tool name follows `hetzner_<action>_<resource>` convention
- [ ] Description is 1-2 sentences, under 40 words
- [ ] Annotations match action type (see table in CLAUDE.md)
- [ ] All imports use `.js` extension
- [ ] No `.strict()` on Zod schemas
- [ ] Handler wrapped in try/catch with `toolError()`
- [ ] Handler returns `formatResponse(data)`
- [ ] `npm run build` passes
- [ ] `npm test` passes (update smoke test counts if tools were added/removed)

## References

- **Patterns & rules** → `CLAUDE.md` (tool registration pattern, annotations table, critical rules)
- **API conventions** → `.claude/shared/hetzner-api-reference.md`
- **Audit tool** → Run `/audit-tools` to check all conventions across the codebase

## Common Patterns

**GET (list/get):** `hetznerRequest('GET', '/resource', undefined, params)`
**POST (create/action):** `hetznerRequest('POST', '/resource', body)`
**PUT (update):** `const { id, ...body } = params; hetznerRequest('PUT', \`/resource/\${id}\`, body)`
**DELETE:** `hetznerRequest('DELETE', \`/resource/\${params.id}\`)`

## Gotchas

- **String-typed identifiers (`id_or_name`) must be URL-encoded before interpolation.** Hetzner's DNS Zones API (and any other resource that accepts a name *or* numeric ID) takes a `string` identifier. Raw template-literal interpolation lets `?`, `#`, `%`, `/`, `@` break out of the path segment — codex caught this on PR #24 as a path-injection vector. The encoder is a private `pathSeg(s: string)` helper inside `src/tools/zones.ts` (a thin `encodeURIComponent` wrapper) — it is NOT exported from `src/services/hetzner.ts`. Numeric `IdSchema` path segments (positive integer) need NO encoding — Zod rejects non-integers before the template runs, so injection isn't reachable. If a NEW tool ever takes a string name in the path, extract a shared helper at that point rather than assuming one already exists; do not reach for a non-existent `services/hetzner.ts` export.
- **Prefer the OpenAPI `cloud.spec.json` for endpoint existence and request/response schemas; use `hcloud-go` as a cross-check only — it is permitted to lag behind the REST spec.** The server calls the REST API directly, so the spec is authoritative (e.g. `POST /load_balancers/{id}/actions/change_dns_ptr` exists in `cloud.spec.json` but is absent from `hcloud-go`). Three plan-time docs-site inaccuracies surfaced in this fleet, all resolved against the spec/SDK: (a) `POST /zones/.../validate` doesn't exist; (b) the export/import paths are `GET /zones/.../zonefile` and `POST /zones/.../actions/import_zonefile`, NOT `/export` and `/import`; (c) `enable_backup` has no body (the `backup_window` field is deprecated). Re-read the spec at build time before shipping.
- **Hetzner deprecated per-action-id GET endpoints (April 2026).** Do NOT add `hetzner_get_<resource>_action` tools — only `hetzner_list_<resource>_actions` is forward-compatible. Applies fleet-wide (servers, LBs, volumes, networks, FIPs, PIPs, certificates, images, zones).
- **`paramsSerializer: { indexes: null }` in `src/services/hetzner.ts` is load-bearing.** Hetzner expects repeated query keys (`?type=A&type=AAAA`), but axios defaults to `?type[]=A&type[]=AAAA`. If you add array-valued query params, verify against the docs that Hetzner accepts them in the repeated-key form. The serializer was added in PR #24.
