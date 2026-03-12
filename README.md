# hetzner-mcp-server

[![Tests](https://github.com/lazyants/hetzner-mcp-server/actions/workflows/test.yml/badge.svg)](https://github.com/lazyants/hetzner-mcp-server/actions/workflows/test.yml)

MCP server for the [Hetzner Cloud API](https://docs.hetzner.cloud/). Manage servers, networks, volumes, firewalls, load balancers, and more through the Model Context Protocol.

**104 tools** across 13 resource domains, with 7 entry points so you can pick the right server for your MCP client's tool limit.

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

## Entry Points

| Command | Domains | Tools |
|---|---|---|
| `hetzner-mcp-server` | All 13 domains | 104 |
| `hetzner-mcp-servers` | Servers, Datacenters/Locations/Server Types | 22 |
| `hetzner-mcp-networking` | Networks, Firewalls | 17 |
| `hetzner-mcp-load-balancers` | Load Balancers, Certificates | 22 |
| `hetzner-mcp-ips` | Floating IPs, Primary IPs | 16 |
| `hetzner-mcp-storage` | Volumes, Images | 13 |
| `hetzner-mcp-config` | SSH Keys, ISOs, Placement Groups | 14 |

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

### Servers (16 tools) — servers

`hetzner_list_servers`, `hetzner_get_server`, `hetzner_create_server`, `hetzner_update_server`, `hetzner_delete_server`, `hetzner_power_on`, `hetzner_power_off`, `hetzner_reboot`, `hetzner_reset`, `hetzner_shutdown`, `hetzner_rebuild_server`, `hetzner_resize_server`, `hetzner_enable_rescue`, `hetzner_disable_rescue`, `hetzner_get_server_metrics`, `hetzner_list_server_actions`

### Images (5 tools) — storage

`hetzner_list_images`, `hetzner_get_image`, `hetzner_update_image`, `hetzner_delete_image`, `hetzner_create_image`

### ISOs (4 tools) — config

`hetzner_list_isos`, `hetzner_get_iso`, `hetzner_attach_iso`, `hetzner_detach_iso`

### Placement Groups (5 tools) — config

`hetzner_list_placement_groups`, `hetzner_get_placement_group`, `hetzner_create_placement_group`, `hetzner_update_placement_group`, `hetzner_delete_placement_group`

### Reference Data (6 tools) — servers

`hetzner_list_datacenters`, `hetzner_get_datacenter`, `hetzner_list_locations`, `hetzner_get_location`, `hetzner_list_server_types`, `hetzner_get_server_type`

### Networks (9 tools) — networking

`hetzner_list_networks`, `hetzner_get_network`, `hetzner_create_network`, `hetzner_update_network`, `hetzner_delete_network`, `hetzner_add_subnet`, `hetzner_delete_subnet`, `hetzner_add_route`, `hetzner_delete_route`

### Firewalls (8 tools) — networking

`hetzner_list_firewalls`, `hetzner_get_firewall`, `hetzner_create_firewall`, `hetzner_update_firewall`, `hetzner_delete_firewall`, `hetzner_set_firewall_rules`, `hetzner_apply_firewall`, `hetzner_remove_firewall`

### Load Balancers (16 tools) — load-balancers

`hetzner_list_load_balancers`, `hetzner_get_load_balancer`, `hetzner_create_load_balancer`, `hetzner_update_load_balancer`, `hetzner_delete_load_balancer`, `hetzner_add_lb_target`, `hetzner_remove_lb_target`, `hetzner_add_lb_service`, `hetzner_update_lb_service`, `hetzner_delete_lb_service`, `hetzner_change_lb_algorithm`, `hetzner_change_lb_type`, `hetzner_attach_lb_to_network`, `hetzner_detach_lb_from_network`, `hetzner_get_lb_metrics`, `hetzner_list_lb_types`

### Certificates (6 tools) — load-balancers

`hetzner_list_certificates`, `hetzner_get_certificate`, `hetzner_create_certificate`, `hetzner_update_certificate`, `hetzner_delete_certificate`, `hetzner_retry_certificate`

### Volumes (8 tools) — storage

`hetzner_list_volumes`, `hetzner_get_volume`, `hetzner_create_volume`, `hetzner_update_volume`, `hetzner_delete_volume`, `hetzner_attach_volume`, `hetzner_detach_volume`, `hetzner_resize_volume`

### Floating IPs (8 tools) — ips

`hetzner_list_floating_ips`, `hetzner_get_floating_ip`, `hetzner_create_floating_ip`, `hetzner_update_floating_ip`, `hetzner_delete_floating_ip`, `hetzner_assign_floating_ip`, `hetzner_unassign_floating_ip`, `hetzner_change_floating_ip_rdns`

### Primary IPs (8 tools) — ips

`hetzner_list_primary_ips`, `hetzner_get_primary_ip`, `hetzner_create_primary_ip`, `hetzner_update_primary_ip`, `hetzner_delete_primary_ip`, `hetzner_assign_primary_ip`, `hetzner_unassign_primary_ip`, `hetzner_change_primary_ip_rdns`

### SSH Keys (5 tools) — config

`hetzner_list_ssh_keys`, `hetzner_get_ssh_key`, `hetzner_create_ssh_key`, `hetzner_update_ssh_key`, `hetzner_delete_ssh_key`

## Security

- **Never commit your API token** to version control
- Use **read-only tokens** when you only need to list/get resources
- **Create and delete tools cost real money** — Hetzner bills for provisioned resources
- The server handles rate limiting automatically (3,600 requests/hour, exponential backoff on 429)

## Disclaimer

Create, update, and delete operations may incur charges on your Hetzner Cloud account. Use read-only API tokens when possible. The authors are not responsible for any costs incurred.

## License

MIT — see [LICENSE](LICENSE) for details.
