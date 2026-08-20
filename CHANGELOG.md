# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

- npm package: [`@lazyants/hetzner-mcp-server`](https://www.npmjs.com/package/@lazyants/hetzner-mcp-server)
- MCP Registry: [`io.github.lazyants/hetzner`](https://registry.modelcontextprotocol.io/v0/servers?search=io.github.lazyants/hetzner)

## [2.4.0] — 2026-08-20

### Added

- `hetzner_create_server` now accepts a `volumes` array, so volumes can be attached
  at creation time instead of requiring a separate attach call — the `automount`
  flag already referenced volumes but there was no way to supply them (#64).
- `hetzner_list_server_actions` gains `sort` and `status` filters, bringing it in
  line with the other ten `list_<resource>_actions` tools (#64).
- `hetzner_create_primary_ip` gains an optional `assignee_id`, so a Primary IP can
  be created and assigned in one call (#63).
- `PathSegmentSchema` in `schemas/common.ts`: a second guard layer alongside
  `pathSeg()` that rejects `.`, `..`, empty and embedded-slash values before a URL
  is built. `encodeURIComponent` never escapes `.`, so `pathSeg('..')` was a no-op.
  Applied to `IdOrNameSchema` and the nine path-interpolated zone RRSet `name`
  fields (#66).

### Changed

- **`hetzner_create_primary_ip`: the `datacenter` parameter is replaced by
  `location`.** Hetzner removed `datacenter` from `POST /primary_ips`
  (`additionalProperties: false`), so calls passing it were already being rejected
  upstream. `location` matches the convention used by servers, volumes and load
  balancers (#63).
- `assignee_type` is now pinned explicitly whenever `assignee_id` is supplied
  without it. Hetzner's default flips from `server` to `unassigned` on 2026-08-01,
  which would have silently stopped create-and-assign calls from assigning (#63).
- `index.ts` and the eight `entry-*.ts` binaries iterate a shared `SPLITS` /
  `ALL_REGISTRARS` map from the new `src/splits.ts` instead of hand-listing
  `register*Tools` calls, so the entry-point partition can no longer drift between
  runtime wiring and the tests asserting tool counts (#67).
- Removed the unused `src/types/` tree (15 files); `ZONE_RRSET_TYPES` moved to its
  sole consumer, and `MAX_PER_PAGE` is now the single source of the `per_page`
  ceiling in `PaginationParams` (#66).
- Extracted an `rrsetPath()` helper so the zone/name/type path is built and
  encoded in exactly one place (#66).

### Fixed

- **429 backoff was defeated by malformed headers.** `Retry-After` and
  `ratelimit-reset` were parsed with a bare `parseInt`, which returns `NaN` for an
  HTTP-date `Retry-After`; `Math.max(0, NaN)` is `NaN` and `setTimeout(NaN)` fires
  immediately, so a rate-limited request retried in a tight loop. Ported lexware's
  `parseRetryAfterMs` (delta-seconds plus strict IMF-fixdate parsing, clamped to
  the `setTimeout` ceiling) and guarded the `ratelimit-reset` fallback with a strict
  `/^\d+$/` parse so a malformed value falls back to exponential backoff (#61, #65).

### Security

- **Request-body secrets are now scrubbed from chained error causes.**
  `scrubConfig` left `config.data` — the serialized request body — intact when an
  `AxiosError` was chained as `{ cause: err }`, so a certificate `private_key`, a
  Storage Box `password`, or a DNS TSIG key could reach a logger walking the cause
  via `util.inspect(err, { depth: null })` or `AxiosError.toJSON()` (#51, #65).
- Regenerated `package-lock.json` to clear the `npm audit` gate, which had gone red
  as the advisory database moved: 6 production vulnerabilities, 3 high
  (`fast-uri`, `axios`, `ip-address` high; `hono`, `@hono/node-server` moderate;
  `body-parser` low). No manifest change was needed — every package resolved past
  its advisory range within the ranges already declared (#71, #73).

### Removed

- **`dist/types/**` is no longer published (45 files).** The `src/types/` tree was
  dead code — 14 of its 15 modules exported only TypeScript `interface`
  declarations, so their compiled `.js` files were empty stubs and no runtime value
  can break. The single runtime export, `ZONE_RRSET_TYPES`, moved into
  `src/tools/zones.ts` and is no longer exported from a published path.

  This package declares no `exports` map, so deep imports such as
  `@lazyants/hetzner-mcp-server/dist/types/servers.js` were resolvable, and **type
  imports of those interfaces will stop resolving.** No compatibility shim is
  provided: the package's product is its nine stdio `bin` entries, and no library
  API is documented. If you were importing these types, copy the interfaces you
  need — they were never part of a supported surface.

### Internal

- Test-coverage gaps closed by the `splits.ts` refactor: the Zod-4
  `required[]`/`describe` enumeration test was building its "full server" from 15 of
  16 registrars (156 of 185 tools, omitting Storage Boxes) and now covers all 185;
  the annotation test swept 3 registrars and now sweeps every registered tool for
  boolean-hint presence and the read-only/destructive exclusivity invariant. The
  `get_action`-exclusion GET scan was widened to also catch `storageBoxRequest`
  calls (#53, #67).

## [2.3.1] — 2026-06-22

### Security

- Redact the bearer token (`HETZNER_API_TOKEN` / `HETZNER_STORAGE_API_TOKEN`) from
  rethrown axios error cause chains (defense-in-depth, #44). API errors are wrapped
  as `new Error(msg, { cause: err })`; the chained `AxiosError` previously retained
  the token in `config.headers.Authorization` and Node's raw `request._header` block,
  so a logger walking the cause via `util.inspect(err, { depth: null })` or
  `AxiosError.toJSON()` could surface it. A central `wrapHetznerError` now sanitizes
  the error in place — scrubbing `Authorization`/`proxy-authorization`/`cookie`
  headers (case-insensitively) on both `config` refs, and dropping `config.auth`/
  `proxy.auth`, the `request`/`response.request` objects, and any object `cause`. The
  single `request()` chokepoint routes both the Cloud (`api.hetzner.cloud`) and
  Storage Box (`api.hetzner.com`) call paths through it, so both token families are
  covered. Thrown messages are unchanged. Locked with a regression test asserting no
  token survives `util.inspect(depth:null)` or `toJSON()`, through both
  `hetznerRequest` and `storageBoxRequest`.

## [2.3.0] — 2026-06-20

### Added

- **Storage Boxes domain (29 new tools, 156 → 185)** on a new
  `hetzner-mcp-storage-boxes` entry point: Storage Box CRUD, folders, actions,
  protection/type/password/access-settings actions, snapshot plan
  enable/disable + rollback; snapshots CRUD; subaccounts CRUD plus
  home-directory/password/access-settings actions; and Storage Box types.
  Storage Boxes call the separate `https://api.hetzner.com/v1` host via a second
  cached client that reuses the same retry, 429 backoff, and error
  normalization. The client resolves its token as `HETZNER_STORAGE_API_TOKEN ??
  HETZNER_API_TOKEN`, so a single existing token keeps working; a dedicated
  Storage Box token is supported if you scope one.
- `pathSeg` (URL path-segment encoder) was promoted from `tools/zones.ts` to the
  shared `schemas/common.ts` and is now unit-tested.

### Deprecated

- `hetzner_list_datacenters` / `hetzner_get_datacenter` now flag Hetzner's
  deprecation of `/datacenters` (removed after 2026-10-01, HTTP 410) and point
  to `hetzner_list_server_types` (`locations[].available/recommended`) and
  `hetzner_list_locations`. The tools still work until the cutover and are not
  yet removed.

## [2.2.1] — 2026-06-20

### Security

- Bump the `hono` override to `^4.12.25` and add a `form-data` `^4.0.6`
  override to clear two HIGH advisories that started failing the
  `npm audit --audit-level=moderate --omit=dev` CI gate: `form-data` CRLF
  injection via unescaped multipart field/file names (GHSA-hmw2-7cc7-3qxx)
  and the `hono` `serve-static` path traversal et al. (`hono <= 4.12.24`).
  Dependency-only change; no runtime or API behaviour changes.

## [2.2.0] — 2026-06-13

### Added

- **9 new Cloud API tools** (147 → 156): `hetzner_attach_server_to_network`,
  `hetzner_detach_server_from_network`, `hetzner_add_server_to_placement_group`,
  `hetzner_remove_server_from_placement_group`, `hetzner_reset_server_password`
  (surfaces the returned `root_password`), `hetzner_enable_lb_public_interface`,
  `hetzner_disable_lb_public_interface`, `hetzner_change_lb_dns_ptr`
  (`dns_ptr` required-and-nullable), and `hetzner_get_pricing` (new
  `src/tools/pricing.ts` module, `GET /pricing`) (PR #37).
- **Read-only API-reference Resource** `reference://hetzner/api`
  (`text/markdown`), embedded as a package-safe compiled string and
  registered on the main binary plus all 7 split entry points (PR #37).

### Fixed

- `hetzner_attach_lb_to_network` now forwards the optional `ip_range`
  field to the Hetzner API for spec-compliance (PR #37).

## [2.1.1] — 2026-06-13

### Security

- Pinned a `qs` override (`^6.15.2`) to clear the transitive
  npm-audit DoS advisory (GHSA-q8mj-m7cp-5q26) and reinstate a clean
  `npm audit` gate. No runtime behavior change (PR #35).

### Changed

- Bumped grouped minor+patch deps (PR #34): lockfile-only refresh of
  five transitive packages. No behavior changes.

## [2.1.0] — 2026-05-20

### Added

- **DNS Zones module** (`src/tools/zones.ts`) + new entry binary
  `hetzner-mcp-dns` (`src/entry-dns.ts`) covering 22 tools across
  the Hetzner DNS Zones API (zones CRUD, RRSets CRUD,
  primary-nameserver changes, protection, TTL changes, zonefile
  import/export). Wraps the GA Nov 2025 surface on the existing
  `api.hetzner.cloud` baseURL + token (PR #24).
- **`change_*_protection` across 7 resources**: servers, load
  balancers, volumes, networks, floating IPs, primary IPs, images.
  Adds the data-loss guard rails the API has supported for years
  but were never wrapped (PR #21).
- **Per-resource `list_*_actions` for 8 resources**: load balancers,
  volumes, floating IPs, primary IPs, networks, firewalls,
  certificates, images (PR #23). Replaces the global `/actions`
  endpoint Hetzner deprecated in January 2025.
- **Server actions**: `request_console`, `enable_backup`,
  `disable_backup`, `change_alias_ips`, `change_dns_ptr` (servers);
  `change_ip_range` (networks). Plus `must_be_unassigned`
  precondition notes on `delete_floating_ip` / `delete_primary_ip`
  descriptions (PR #25).
- **Per-tool axios-mock test coverage** across all 14 tool modules
  (PRs #26, #28, #29, #30). Every tool now has at least one test
  asserting path/method/body/query shape against a mocked
  `hetznerRequest()`.
- README tool counts updated to reflect the 147-tool surface
  (PR #27).

### Changed

- **Migrated to Zod 4** (`zod ^4.4.3`). Brings hetzner into line
  with `@lazyants/lexware-mcp-server` and
  `@lazyants/transkribus-mcp-server` (both already on Zod 4 since
  their 2.0.1). All `z.record(z.unknown())` call sites updated to
  the Zod-4 two-argument form `z.record(z.string(), z.unknown())`.
  Runtime-verified `.describe()` propagation and `tools/list`
  `required[]` correctness on the full schema surface (PR #22).
- Bumped grouped minor+patch deps (PR #18): see the Dependabot PR
  for the exact diff. No behavior changes.

### Fixed

- `formatResponse` no longer sets `structuredContent` for array
  payloads. The MCP SDK rejects arrays in `structuredContent`;
  previously this would crash on any tool returning a top-level
  array (e.g. paginated `list_*` shortcuts). Now array payloads
  go through the JSON-stringified `content[]` path only (PR #31).

### Note on tool count

Total registered tools grew from 104 to 147 (+43): +22 DNS Zones
(PR #24), +8 `list_*_actions` (PR #23), +6 server/network actions
(PR #25), +7 `change_*_protection` (PR #21). Smoke test asserts
147 across full server + per-entry splits (28/21/25/20/17/14/22).

## [2.0.0] — 2026-05-05

### Changed

- **License updated to [FSL-1.1-MIT](LICENSE).** Versions `1.1.1` and
  earlier remain under their original MIT license. (The license change
  is what makes this a semver-major bump; the rest of the entries below
  would be minor/patch on their own.)
- **Dependencies:** bumped `typescript` to `^6.0.0`, `vitest` to `^4.1.0`,
  `actions/checkout` to `v6`, `actions/setup-node` to `v6`. `zod` stays
  on `^3.25.0` — the MCP SDK has known `.describe()` propagation bugs
  with zod 4 (see CLAUDE.md "Critical Rules").
- **Releasing:** GitHub Releases now auto-publish to npm with provenance
  (`--provenance --access public`) before pushing to the MCP Registry.
  Authentication uses npm Trusted Publishing — the `id-token: write`
  workflow permission is exchanged for a one-shot publish token via the
  trusted-publisher binding configured in the npm web UI. No `NPM_TOKEN`
  secret is stored in the repo. The workflow installs `mcp-publisher`
  early and smoke-tests it before the irreversible `npm publish` so a
  broken publisher binary fails fast. Skips `npm publish` cleanly if the
  version is already on npm (cutover/recovery guard).
- **CI:** test workflow runs on Node 20 and 22 with npm cache, lint,
  version-sync check, and `npm audit --audit-level=moderate --omit=dev`.

### Added

- **ESLint 9 flat config** (`eslint.config.mjs`) with
  `tseslint.configs.recommended` + `globals.node`. New `npm run lint`
  script, plus a Lint step in `test.yml` that runs before the version
  sync and audit gates.
- `.github/dependabot.yml` for weekly npm + GitHub Actions updates,
  grouped minor+patch, ignoring `@types/node` major bumps.
- `scripts/check-versions.mjs` enforces `package.json#version`
  matches `server.json#/packages[0].version` (hard fail) and warns on
  registry-version regressions; wired into `test.yml`,
  `publish-registry.yml`, and the `prepublishOnly` hook.
- `SECURITY.md` with a vulnerability disclosure path.
- `CHANGELOG.md` (this file).
- `engines.node >= 20` in `package.json`.
- **Hetzner API field additions** from the upstream changelog:
  - `hetzner_rebuild_server` accepts an optional `user_data` field for
    cloud-init overrides (Hetzner change 2026-01-16).
  - Load Balancer HTTP service schemas (`add_service`, `update_service`)
    accept an optional `timeout_idle` field (30–300 s; Hetzner change
    2026-04-30).
  - `hetzner_create_primary_ip` no longer requires `assignee_type`
    (Hetzner change 2026-04-27).

## [1.1.1] — 2026-05-04

### Fixed

- Registry publish: bumped only the registry-side `version` (root
  `1.1.1`) while keeping `packages[0].version` at `1.1.0` to republish
  with icon metadata without re-publishing to npm.

## [1.1.0] — 2026-05-04

### Added

- Logo and icon metadata in `server.json` for directory listings.
- `stdio` transport entry in `server.json` for the MCP Registry.

## [1.0.0] — 2026-03-04

### Added

- Initial release.
- 104 MCP tools across 13 resource domains: servers, networks, firewalls,
  load balancers, certificates, volumes, images, floating IPs, primary
  IPs, SSH keys, ISOs, placement groups, reference data
  (datacenters/locations/server types).
- Six split entry points (`hetzner-mcp-servers`, `hetzner-mcp-networking`,
  `hetzner-mcp-load-balancers`, `hetzner-mcp-ips`, `hetzner-mcp-storage`,
  `hetzner-mcp-config`) for context-size optimization.
- Bearer-token authentication via `HETZNER_API_TOKEN`.
- Rate-limit handling with exponential backoff (max 3 retries on 429).
- GitHub Actions test and MCP Registry publish workflows.

[2.3.0]: https://github.com/lazyants/hetzner-mcp-server/releases/tag/v2.3.0
[2.2.1]: https://github.com/lazyants/hetzner-mcp-server/releases/tag/v2.2.1
[2.2.0]: https://github.com/lazyants/hetzner-mcp-server/releases/tag/v2.2.0
[2.1.1]: https://github.com/lazyants/hetzner-mcp-server/releases/tag/v2.1.1
[2.1.0]: https://github.com/lazyants/hetzner-mcp-server/releases/tag/v2.1.0
[2.0.0]: https://github.com/lazyants/hetzner-mcp-server/releases/tag/v2.0.0
[1.1.1]: https://github.com/lazyants/hetzner-mcp-server/releases/tag/v1.1.1
[1.1.0]: https://github.com/lazyants/hetzner-mcp-server/releases/tag/v1.1.0
[1.0.0]: https://github.com/lazyants/hetzner-mcp-server/releases/tag/v1.0.0
