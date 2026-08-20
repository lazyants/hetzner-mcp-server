# hetzner-mcp-server

[![Tests](https://github.com/lazyants/hetzner-mcp-server/actions/workflows/test.yml/badge.svg)](https://github.com/lazyants/hetzner-mcp-server/actions/workflows/test.yml)

MCP server for the [Hetzner Cloud API](https://docs.hetzner.cloud/). Manage servers, networks, volumes, firewalls, load balancers, and more through the Model Context Protocol.

**185 tools** across 15 resource domains, with 9 entry points so you can pick the right server for your MCP client's tool limit. A read-only API-reference Resource (`reference://hetzner/api`) is also exposed on every entry point.

## Installation

```bash
npm install -g @lazyants/hetzner-mcp-server
```

Or run directly:

```bash
npx @lazyants/hetzner-mcp-server
```

## Configuration

Set your Hetzner Cloud API token:

```bash
export HETZNER_API_TOKEN=your-token-here
```

Get a token from the [Hetzner Cloud Console](https://console.hetzner.cloud/) under Security > API Tokens.

The Storage Box tools call a separate host (`https://api.hetzner.com/v1`). They use `HETZNER_STORAGE_API_TOKEN` if set, otherwise fall back to `HETZNER_API_TOKEN`, so a single token keeps working. Set `HETZNER_STORAGE_API_TOKEN` only if you scope Storage Box access to a dedicated token:

```bash
export HETZNER_STORAGE_API_TOKEN=your-storage-token-here  # optional
```

## Entry Points

| Command | Domains | Tools |
|---|---|---|
| `hetzner-mcp-server` | All 15 domains | 185 |
| `hetzner-mcp-servers` | Servers, Datacenters/Locations/Server Types, Pricing | 34 |
| `hetzner-mcp-networking` | Networks, Firewalls | 21 |
| `hetzner-mcp-load-balancers` | Load Balancers, Certificates | 28 |
| `hetzner-mcp-ips` | Floating IPs, Primary IPs | 20 |
| `hetzner-mcp-storage` | Volumes, Images | 17 |
| `hetzner-mcp-storage-boxes` | Storage Boxes (+ snapshots, subaccounts, types) | 29 |
| `hetzner-mcp-config` | SSH Keys, ISOs, Placement Groups | 14 |
| `hetzner-mcp-dns` | DNS Zones | 22 |

Use split servers to reduce context size — pick only the splits you need.

## Claude Code

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "hetzner": {
      "command": "npx",
      "args": ["-y", "@lazyants/hetzner-mcp-server"],
      "env": {
        "HETZNER_API_TOKEN": "your-token-here"
      }
    }
  }
}
```

Or use split servers (pick the splits you need):

```json
{
  "mcpServers": {
    "hetzner-servers": {
      "command": "npx",
      "args": ["-y", "-p", "@lazyants/hetzner-mcp-server", "hetzner-mcp-servers"],
      "env": { "HETZNER_API_TOKEN": "your-token-here" }
    },
    "hetzner-networking": {
      "command": "npx",
      "args": ["-y", "-p", "@lazyants/hetzner-mcp-server", "hetzner-mcp-networking"],
      "env": { "HETZNER_API_TOKEN": "your-token-here" }
    }
  }
}
```

## Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "hetzner": {
      "command": "npx",
      "args": ["-y", "@lazyants/hetzner-mcp-server"],
      "env": {
        "HETZNER_API_TOKEN": "your-token-here"
      }
    }
  }
}
```

## Tools

### Servers (27 tools) — servers

`hetzner_list_servers`, `hetzner_get_server`, `hetzner_create_server`, `hetzner_update_server`, `hetzner_delete_server`, `hetzner_power_on`, `hetzner_power_off`, `hetzner_reboot`, `hetzner_reset`, `hetzner_shutdown`, `hetzner_rebuild_server`, `hetzner_resize_server`, `hetzner_enable_rescue`, `hetzner_disable_rescue`, `hetzner_get_server_metrics`, `hetzner_list_server_actions`, `hetzner_change_server_protection`, `hetzner_request_console`, `hetzner_enable_backup`, `hetzner_disable_backup`, `hetzner_change_alias_ips`, `hetzner_change_dns_ptr`, `hetzner_attach_server_to_network`, `hetzner_detach_server_from_network`, `hetzner_add_server_to_placement_group`, `hetzner_remove_server_from_placement_group`, `hetzner_reset_server_password`

### Images (7 tools) — storage

`hetzner_list_images`, `hetzner_get_image`, `hetzner_update_image`, `hetzner_delete_image`, `hetzner_create_image`, `hetzner_change_image_protection`, `hetzner_list_image_actions`

### ISOs (4 tools) — config

`hetzner_list_isos`, `hetzner_get_iso`, `hetzner_attach_iso`, `hetzner_detach_iso`

### Placement Groups (5 tools) — config

`hetzner_list_placement_groups`, `hetzner_get_placement_group`, `hetzner_create_placement_group`, `hetzner_update_placement_group`, `hetzner_delete_placement_group`

### Reference Data (7 tools) — servers

`hetzner_list_datacenters`, `hetzner_get_datacenter`, `hetzner_list_locations`, `hetzner_get_location`, `hetzner_list_server_types`, `hetzner_get_server_type`, `hetzner_get_pricing`

> `hetzner_list_datacenters` / `hetzner_get_datacenter` are deprecated by Hetzner and removed after 2026-10-01 (HTTP 410). Use `hetzner_list_server_types` (`locations[].available/recommended`) and `hetzner_list_locations` instead.

### Networks (12 tools) — networking

`hetzner_list_networks`, `hetzner_get_network`, `hetzner_create_network`, `hetzner_update_network`, `hetzner_delete_network`, `hetzner_add_subnet`, `hetzner_delete_subnet`, `hetzner_add_route`, `hetzner_delete_route`, `hetzner_change_network_protection`, `hetzner_change_ip_range`, `hetzner_list_network_actions`

### Firewalls (9 tools) — networking

`hetzner_list_firewalls`, `hetzner_get_firewall`, `hetzner_create_firewall`, `hetzner_update_firewall`, `hetzner_delete_firewall`, `hetzner_set_firewall_rules`, `hetzner_apply_firewall`, `hetzner_remove_firewall`, `hetzner_list_firewall_actions`

### Load Balancers (21 tools) — load-balancers

`hetzner_list_load_balancers`, `hetzner_get_load_balancer`, `hetzner_create_load_balancer`, `hetzner_update_load_balancer`, `hetzner_delete_load_balancer`, `hetzner_add_lb_target`, `hetzner_remove_lb_target`, `hetzner_add_lb_service`, `hetzner_update_lb_service`, `hetzner_delete_lb_service`, `hetzner_change_lb_algorithm`, `hetzner_change_lb_type`, `hetzner_attach_lb_to_network`, `hetzner_detach_lb_from_network`, `hetzner_get_lb_metrics`, `hetzner_list_lb_types`, `hetzner_change_load_balancer_protection`, `hetzner_list_load_balancer_actions`, `hetzner_enable_lb_public_interface`, `hetzner_disable_lb_public_interface`, `hetzner_change_lb_dns_ptr`

### Certificates (7 tools) — load-balancers

`hetzner_list_certificates`, `hetzner_get_certificate`, `hetzner_create_certificate`, `hetzner_update_certificate`, `hetzner_delete_certificate`, `hetzner_retry_certificate`, `hetzner_list_certificate_actions`

### Volumes (10 tools) — storage

`hetzner_list_volumes`, `hetzner_get_volume`, `hetzner_create_volume`, `hetzner_update_volume`, `hetzner_delete_volume`, `hetzner_attach_volume`, `hetzner_detach_volume`, `hetzner_resize_volume`, `hetzner_change_volume_protection`, `hetzner_list_volume_actions`

### Floating IPs (10 tools) — ips

`hetzner_list_floating_ips`, `hetzner_get_floating_ip`, `hetzner_create_floating_ip`, `hetzner_update_floating_ip`, `hetzner_delete_floating_ip`, `hetzner_assign_floating_ip`, `hetzner_unassign_floating_ip`, `hetzner_change_floating_ip_rdns`, `hetzner_change_floating_ip_protection`, `hetzner_list_floating_ip_actions`

### Primary IPs (10 tools) — ips

`hetzner_list_primary_ips`, `hetzner_get_primary_ip`, `hetzner_create_primary_ip`, `hetzner_update_primary_ip`, `hetzner_delete_primary_ip`, `hetzner_assign_primary_ip`, `hetzner_unassign_primary_ip`, `hetzner_change_primary_ip_rdns`, `hetzner_change_primary_ip_protection`, `hetzner_list_primary_ip_actions`

### SSH Keys (5 tools) — config

`hetzner_list_ssh_keys`, `hetzner_get_ssh_key`, `hetzner_create_ssh_key`, `hetzner_update_ssh_key`, `hetzner_delete_ssh_key`

### DNS Zones (22 tools) — dns

`hetzner_list_zones`, `hetzner_get_zone`, `hetzner_create_zone`, `hetzner_update_zone`, `hetzner_delete_zone`, `hetzner_change_zone_protection`, `hetzner_change_zone_ttl`, `hetzner_change_zone_primary_nameservers`, `hetzner_export_zonefile`, `hetzner_import_zonefile`, `hetzner_list_zone_actions`, `hetzner_list_zone_rrsets`, `hetzner_get_zone_rrset`, `hetzner_create_zone_rrset`, `hetzner_update_zone_rrset`, `hetzner_delete_zone_rrset`, `hetzner_change_zone_rrset_protection`, `hetzner_change_zone_rrset_ttl`, `hetzner_add_zone_rrset_records`, `hetzner_remove_zone_rrset_records`, `hetzner_set_zone_rrset_records`, `hetzner_update_zone_rrset_records`

### Storage Boxes (29 tools) — storage-boxes

Storage Boxes use the `https://api.hetzner.com/v1` host. Token: `HETZNER_STORAGE_API_TOKEN` (falls back to `HETZNER_API_TOKEN`).

`hetzner_list_storage_boxes`, `hetzner_create_storage_box`, `hetzner_get_storage_box`, `hetzner_update_storage_box`, `hetzner_delete_storage_box`, `hetzner_list_storage_box_folders`, `hetzner_list_storage_box_actions`, `hetzner_change_storage_box_protection`, `hetzner_change_storage_box_type`, `hetzner_reset_storage_box_password`, `hetzner_update_storage_box_access_settings`, `hetzner_rollback_storage_box_snapshot`, `hetzner_enable_storage_box_snapshot_plan`, `hetzner_disable_storage_box_snapshot_plan`, `hetzner_list_storage_box_types`, `hetzner_get_storage_box_type`, `hetzner_list_storage_box_snapshots`, `hetzner_create_storage_box_snapshot`, `hetzner_get_storage_box_snapshot`, `hetzner_update_storage_box_snapshot`, `hetzner_delete_storage_box_snapshot`, `hetzner_list_storage_box_subaccounts`, `hetzner_create_storage_box_subaccount`, `hetzner_get_storage_box_subaccount`, `hetzner_update_storage_box_subaccount`, `hetzner_delete_storage_box_subaccount`, `hetzner_change_storage_box_subaccount_home_directory`, `hetzner_reset_storage_box_subaccount_password`, `hetzner_update_storage_box_subaccount_access_settings`

## Security

- **Never commit your API token** to version control
- Use **read-only tokens** when you only need to list/get resources
- **Create and delete tools cost real money** — Hetzner bills for provisioned resources
- The server handles rate limiting automatically (3,600 requests/hour, exponential backoff on 429)

## Disclaimer

Create, update, and delete operations may incur charges on your Hetzner Cloud account. Use read-only API tokens when possible. The authors are not responsible for any costs incurred.

## Releasing

Releases ship via the GitHub Release event. Maintainer flow:

1. Bump the version in `package.json` and `server.json` (both `#/version` and `#/packages[0].version`), then run `npm install --package-lock-only` to sync `package-lock.json`. `node scripts/check-versions.mjs` hard-fails unless `package.json#/version` matches `server.json#/packages[0].version`; `server.json#/version` is checked loosely — it may legitimately be *ahead* (registry-only republishes bump just that field), so a stale value passes with a `WARN:` line and no failure. Read the script's output rather than trusting its exit code. `CHANGELOG.md` is not checked at all.
2. Update `CHANGELOG.md`.
3. Commit, and **merge the version bump to `main` before creating the release**. Then create the tag yourself, on a SHA you have checked, and only then create the release from it:

   ```bash
   V=X.Y.Z && PR=<release-pr-number> &&
     SHA="$(gh pr view "$PR" --json mergeCommit -q .mergeCommit.oid)" && test -n "$SHA" &&
     git fetch origin main && git merge-base --is-ancestor "$SHA" origin/main &&
     PKG="$(git show "$SHA:package.json")" &&
     test "$(printf '%s' "$PKG" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).version')" = "$V" &&
     CL="$(git show "$SHA:CHANGELOG.md")" &&
     printf '%s\n' "$CL" | awk -v v="$V" 'index($0,"## ["v"]")==1{f=1;next} /^## \[/{f=0} /^\[[0-9]+\.[0-9]+\.[0-9]+\]:/{f=0} f' > "/tmp/notes-v$V.md" &&
     grep -q '[^[:space:]]' "/tmp/notes-v$V.md" &&
     git tag -a "v$V" "$SHA" -m "v$V" &&
     git push origin "v$V" &&
     gh release create "v$V" --verify-tag --notes-file "/tmp/notes-v$V.md"
   ```

   **Never run a bare `gh release create vX.Y.Z`.** With no existing tag it places one on the **tip of the default branch**, so running it while the bump is still on a release branch tags the *previous* release's commit. The workflow then publishes whatever version it finds in that commit's `package.json`, and you get a `vX.Y.Z` GitHub Release that silently republishes the old version. The publish workflow now refuses to continue when `GITHUB_REF_NAME` is not `v<package.json version>`, so that exact scenario fails before `npm publish` rather than silently republishing. The sequence above is still required, and guards a case the workflow cannot: the workflow guard only runs once a release already exists, and it passes for any commit carrying the right version — so it catches a *mis-tagged* release, not the *wrong commit* being tagged.

   Each element is load-bearing:

   - **`gh pr view … .mergeCommit.oid`** names the release PR's own squash commit. Do not substitute `git rev-parse origin/main` — that is merely whatever is on `main` at the moment you look, so an unrelated merge landing in the gap gets tagged and shipped instead. `gh` exits 0 and prints nothing for an unmerged PR, hence the explicit `test -n`.
   - **The `&&` chain** stops on the first failure instead of falling through to the irreversible step. Both `git show` calls are assigned to a variable rather than piped directly, so their exit status is actually checked — a pipeline reports only its *last* command's status unless `pipefail` is set, which is not assumed here.
   - **`git merge-base --is-ancestor`** proves the commit is reachable from `main`. Mere existence is not enough — a commit can be present locally because some other branch was fetched.
   - **The version test reads `package.json` out of the target commit**, not the working tree, which would still show the right version while `$SHA` pointed elsewhere.
   - **The `awk`** lifts that version's section out of the commit's `CHANGELOG.md` for `--notes-file`. It stops at the next `## [` heading *or* at the first link-reference definition, because the oldest entry has no heading after it and would otherwise swallow the entire link-reference block. `grep -q` rather than `test -s` guards the result: a section empty apart from its blank line still produces a one-byte file, which `test -s` accepts.
4. The `Publish to npm + MCP Registry` workflow runs automatically: it `npm publish`es with provenance, polls the registry until the tarball is available, then pushes the matching `server.json` to the MCP Registry via `mcp-publisher`.

The workflow skips `npm publish` cleanly if the version is already on npm (cutover guard for releases that were partially published manually).

### npm authentication

Publishing uses **npm Trusted Publishing**: the workflow's GitHub OIDC token (`id-token: write`) is exchanged for a one-shot publish token at runtime. No `NPM_TOKEN` secret needs to live in the repo.

The binding is configured in the npm web UI (package → Trusted Publishers): provider `GitHub Actions`, organization `lazyants`, repository `hetzner-mcp-server`, workflow `publish-registry.yml`.

## License

[FSL-1.1-MIT](LICENSE) — see [LICENSE](LICENSE) for the full terms. Versions `1.1.1` and earlier remain MIT-licensed.
