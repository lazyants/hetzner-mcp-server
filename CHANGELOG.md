# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

- npm package: [`@lazyants/hetzner-mcp-server`](https://www.npmjs.com/package/@lazyants/hetzner-mcp-server)
- MCP Registry: [`io.github.lazyants/hetzner`](https://registry.modelcontextprotocol.io/v0/servers?search=io.github.lazyants/hetzner)

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

[2.0.0]: https://github.com/lazyants/hetzner-mcp-server/releases/tag/v2.0.0
[1.1.1]: https://github.com/lazyants/hetzner-mcp-server/releases/tag/v1.1.1
[1.1.0]: https://github.com/lazyants/hetzner-mcp-server/releases/tag/v1.1.0
[1.0.0]: https://github.com/lazyants/hetzner-mcp-server/releases/tag/v1.0.0
