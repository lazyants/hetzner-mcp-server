# hetzner-mcp-server

Guidance for working in this repository. It carries the **coding and convention** rules — enough to
write and review code here without another file. It is deliberately NOT the whole story:

- **Validation and CI** are defined by `.github/workflows/test.yml` (the required sequence: `npm ci`,
  lint, `node scripts/check-versions.mjs`, `npm audit --audit-level=moderate --omit=dev`, build,
  tests, on the Node 20 + 22 matrix). Read that file — it is versioned here and is the source of
  truth, not a summary of it.
- **Releasing** is in `README.md` § Releasing, including the guarded tagging sequence.
- **Fleet-wide material** — the publishing playbook, the hygiene skill, the sibling servers — is in
  the fleet-root `CLAUDE.md` of the `lazy-ants/development/mcp/` checkout. A standalone clone does
  not have it; everything needed to work in *this* repo is here or in the two files named above.

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
- **This file does not restate structure that lives in code.** No inventories, no counts, no
  duplicated tables — a copy of a fact rots the moment the code moves, and nothing here is checked
  by any test. Where you need a structural fact, read the file that owns it (named below in each
  case) or run the one-liner. If you find a bare count or a duplicated table here, it is a bug:
  delete it and point at the source.

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
  `formatResponse()` return. No tool registration in this repo has its own `toolError` call; do not add
  per-handler try/catch or an explicit `formatResponse(data)` return.
- **Path segments**: use `pathSeg()` — already exported from `src/schemas/common.ts` — together with
  `PathSegmentSchema` / `IdOrNameSchema`. Do not hand-roll `encodeURIComponent`: it does not escape
  `.` or `..`, which is a path-traversal risk for string-keyed resources.
- **Layout**: `src/index.ts` (all tools) plus the `src/entry-*.ts` split binaries. **`src/splits.ts`
  is the authoritative partition** — it names every split, the registrars in it, its `toolCount`,
  and its `bin`. Do not duplicate that table anywhere: `src/tests/smoke.test.ts` checks the runtime
  registrations against `SPLITS` itself, so a prose copy is unverified by construction and drifts
  the moment a split changes. Read `src/splits.ts` for the partition and `package.json` `bin` for
  the published commands.

- **Helpers**: `toolError(err)` and `formatResponse(data)` return `CallToolResult` from
  `@modelcontextprotocol/sdk/types.js` — both are called for you by `handleToolRequest()`.
- **Schemas**: `IdSchema`, `PaginationParams`, `LabelSelectorParam`, `LabelsSchema`, `pathSeg`,
  `PathSegmentSchema`, `IdOrNameSchema` in `src/schemas/common.ts`.
- **Custom assets** (in this repo, under `.claude/`):
  - Agent `.claude/agents/tool-developer.md` — pre-implementation protocol for new tools.
  - Slash command `/audit-tools` (`.claude/commands/audit-tools.md`).
