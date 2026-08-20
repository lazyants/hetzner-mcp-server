# Hetzner Cloud API Quick Reference

Full documentation: https://docs.hetzner.cloud/

## Base URL

`https://api.hetzner.cloud/v1`

## Authentication

```
Authorization: Bearer <HETZNER_API_TOKEN>
```

## Rate Limits

- **3,600 requests/hour** per token
- Response headers: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`
- On 429: `Retry-After` header indicates wait time in seconds
- Our client handles 429 automatically (exponential backoff, max 3 retries)

## Error Response Format

```json
{
  "error": {
    "code": "uniqueness_error",
    "message": "server with the same name already exists"
  }
}
```

Common error codes: `uniqueness_error`, `not_found`, `forbidden`, `rate_limit_exceeded`, `invalid_input`, `server_limit_exceeded`, `action_failed`

## Pagination

All list endpoints return:

```json
{
  "<resource_key>": [...],
  "meta": {
    "pagination": {
      "page": 1,
      "per_page": 25,
      "previous_page": null,
      "next_page": 2,
      "last_page": 4,
      "total_entries": 100
    }
  }
}
```

Default: 25 per page. Maximum: 50 per page.

## URL Patterns by Domain

| Domain | Base Path | Actions Path |
|---|---|---|
| Servers | `/servers` | `/servers/{id}/actions/{action}` |
| Images | `/images` | `/servers/{id}/actions/create_image` |
| ISOs | `/isos` | `/servers/{id}/actions/attach_iso` |
| Placement Groups | `/placement_groups` | — |
| Datacenters | `/datacenters` | — |
| Locations | `/locations` | — |
| Server Types | `/server_types` | — |
| Networks | `/networks` | `/networks/{id}/actions/{action}` |
| Firewalls | `/firewalls` | `/firewalls/{id}/actions/{action}` |
| Load Balancers | `/load_balancers` | `/load_balancers/{id}/actions/{action}` |
| LB Types | `/load_balancer_types` | — |
| Certificates | `/certificates` | `/certificates/{id}/actions/retry` |
| Volumes | `/volumes` | `/volumes/{id}/actions/{action}` |
| Floating IPs | `/floating_ips` | `/floating_ips/{id}/actions/{action}` |
| Primary IPs | `/primary_ips` | `/primary_ips/{id}/actions/{action}` |
| SSH Keys | `/ssh_keys` | — |
| DNS Zones | `/zones` | `/zones/{id_or_name}/actions/{action}` |
| Zone RRSets | `/zones/{id_or_name}/rrsets` | `/zones/{id_or_name}/rrsets/{name}/{type}/actions/{action}` |

## Common Conventions

- **Labels**: `Record<string, string>` — filterable via `label_selector` query param (e.g., `env=prod,tier=web`)
- **Actions**: Most mutating operations return an `action` object with `id`, `status`, `progress`, `command`
- **Sorting**: `sort` query param, e.g., `id:asc`, `name:desc`
- **CRUD pattern**: GET (list/get), POST (create), PUT (update), DELETE (delete)
- **Sub-resource actions**: POST to `/resource/{id}/actions/{action_name}`

## Per-resource action history

Hetzner deprecated the global `/actions` endpoint in January 2025. Each resource exposes its own action history at `GET /<resource>/{id}/actions`. Supported on: `servers`, `load_balancers`, `volumes`, `networks`, `firewalls`, `floating_ips`, `primary_ips`, `certificates`, `images`, `zones` (DNS zones — `hetzner_list_zone_actions`).

Query parameters:

- `sort` — e.g. `id:asc`, `command:desc`, `started:desc`, `finished:desc`, `status:asc`
- `status` — comma-separated filter: `running`, `success`, `error`
- `page`, `per_page` — standard pagination (max 50)

Response shape: `{ "actions": [...], "meta": { "pagination": {...} } }`. Action history endpoints for individual action IDs (`GET /<resource>/{id}/actions/{action_id}`) were deprecated in Hetzner's April 2026 changelog — only the list endpoint is forward-compatible.

## DNS Zones (GA November 2025)

Zones use an `id_or_name` path segment — both the numeric ID and the FQDN ("example.com") resolve to the same resource. Tools accept either via the `IdOrNameSchema` union (`number | non-empty path-segment string`); handlers run path segments through `encodeURIComponent` before interpolating (defense-in-depth against reserved-char injection).

| Operation | Method + path |
|---|---|
| List zones | `GET /zones` (filters: `name`, `mode`, `label_selector`, `sort`) |
| Get zone | `GET /zones/{id_or_name}` |
| Create zone | `POST /zones` (body: `name`, `mode`, optional `ttl`/`labels`/`primary_nameservers`/`rrsets`/`zonefile`) |
| Update zone | `PUT /zones/{id_or_name}` (body: `labels`) |
| Delete zone | `DELETE /zones/{id_or_name}` |
| Export zonefile | `GET /zones/{id_or_name}/zonefile` (NOT `/export`) |
| Import zonefile | `POST /zones/{id_or_name}/actions/import_zonefile` (NOT `/import`) |
| Change protection | `POST /zones/{id_or_name}/actions/change_protection` |
| Change default TTL | `POST /zones/{id_or_name}/actions/change_ttl` |
| Change primary NSes | `POST /zones/{id_or_name}/actions/change_primary_nameservers` (secondary zones) |
| List zone actions | `GET /zones/{id_or_name}/actions` |

### RRSets

RRSets are addressed by `(zone, name, type)` triple. Record types: `A`, `AAAA`, `CAA`, `CNAME`, `DS`, `HINFO`, `HTTPS`, `MX`, `NS`, `PTR`, `RP`, `SOA`, `SRV`, `SVCB`, `TLSA`, `TXT`.

| Operation | Method + path |
|---|---|
| List RRSets | `GET /zones/{id_or_name}/rrsets` (filters: `name`, repeated `type`, `label_selector`, `sort`) |
| Get RRSet | `GET /zones/{id_or_name}/rrsets/{name}/{type}` |
| Create RRSet | `POST /zones/{id_or_name}/rrsets` |
| Update RRSet | `PUT /zones/{id_or_name}/rrsets/{name}/{type}` (body: `labels`) |
| Delete RRSet | `DELETE /zones/{id_or_name}/rrsets/{name}/{type}` |
| Change protection | `POST .../actions/change_protection` (body: `change`) |
| Change TTL | `POST .../actions/change_ttl` (body: `ttl`; `null` falls back to zone default) |
| Set records (replace) | `POST .../actions/set_records` |
| Add records | `POST .../actions/add_records` (with optional `ttl`) |
| Update record comments | `POST .../actions/update_records` (always sends `comment`; empty string clears) |
| Remove records | `POST .../actions/remove_records` |

**Gotchas:**

- There is no `/validate` endpoint (plan mentioned one; it does not exist in the API).
- The `type` query param on `list_rrsets` is an array. Hetzner expects repeated keys (`?type=A&type=AAAA`); the global axios client is configured with `paramsSerializer: { indexes: null }` to emit this format instead of axios's default `type[]=A&type[]=AAAA`.
- RRSet `name` may include `*` (wildcards) and `_` (e.g. `_acme-challenge`) — these are URL-safe per RFC 3986, but handlers still pass names through `encodeURIComponent` so any unforeseen reserved char is encoded.

## Storage Boxes (GA June 2025) — SECOND HOST

**Storage Boxes live on a DIFFERENT host: `https://api.hetzner.com/v1`** (NOT
`api.hetzner.cloud`). Same Bearer-token scheme; the server uses `storageBoxRequest()`
(a second cached axios client) with token `HETZNER_STORAGE_API_TOKEN || HETZNER_API_TOKEN`
and the same retry/429/error-normalization. Error body is the same
`{ error: { code, message } }` shape as Cloud.

29 tools (v2.3.0, `src/tools/storage-boxes-{core,snapshots,subaccounts}.ts`, entry
`hetzner-mcp-storage-boxes`):

| Group | Paths |
|---|---|
| Storage Boxes | `GET/POST /storage_boxes`, `GET/PUT/DELETE /storage_boxes/{id}`, `GET /storage_boxes/{id}/folders` |
| Box actions | `POST /storage_boxes/{id}/actions/{update_access_settings,reset_password,change_type,change_protection,enable_snapshot_plan,disable_snapshot_plan}`, `GET /storage_boxes/{id}/actions` (per-resource list — the global `/storage_boxes/actions` + by-id action GETs are excluded per `get-action-exclusion.test.ts`) |
| Snapshots | `GET/POST /storage_boxes/{id}/snapshots`, `GET/PUT/DELETE .../snapshots/{snapshot_id}`, `POST .../snapshots/{snapshot_id}/actions/rollback` |
| Subaccounts | `GET/POST /storage_boxes/{id}/subaccounts`, `GET/PUT/DELETE .../subaccounts/{subaccount_id}`, `POST .../subaccounts/{subaccount_id}/actions/{update_access_settings,reset_subaccount_password}` |
| Types | `GET /storage_box_types`, `GET /storage_box_types/{id}` |

**Gotchas:**

- The `/storage_boxes/{id}/snapshots` and `/subaccounts` LIST endpoints do **NOT**
  paginate (no `page`/`per_page` per the spec); only `/storage_boxes` + `/storage_box_types` do.
- `location` and `storage_box_type` are ID-or-Name **body** fields, not path segments;
  all path segments are numeric `IdSchema`, so no `pathSeg` needed there (but `pathSeg`
  is exported from `schemas/common.ts` for any future string-keyed segment).
- Deprecated `/datacenters` tools are removed after **2026-10-01** (HTTP 410) — see GH issue #43.
