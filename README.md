# Hetzner MCP Server

Manage Hetzner Cloud servers, networks, storage, DNS and load balancers from an MCP client.
Requires **Node.js 22.12 or newer**.

## Setup

Create an API token in the [Hetzner Cloud Console](https://console.hetzner.cloud/).
Use a read-only token for inspection; write operations can create billable resources.

For [Claude Code](https://code.claude.com/docs/en/mcp#option-3-add-a-local-stdio-server):

```bash
claude mcp add --transport stdio --env HETZNER_API_TOKEN=your-token \
  hetzner -- npx -y @lazyants/hetzner-mcp-server
```

For Claude Desktop and clients that accept `mcpServers` JSON:

```json
{
  "mcpServers": {
    "hetzner": {
      "command": "npx",
      "args": ["-y", "@lazyants/hetzner-mcp-server"],
      "env": { "HETZNER_API_TOKEN": "your-token" }
    }
  }
}
```

For a separate Storage Box token, also set `HETZNER_STORAGE_API_TOKEN`.
Otherwise, Storage Box tools use `HETZNER_API_TOKEN`.

## Smaller servers

The default command exposes all tools. To load only one resource group, run a split command:

```bash
npx -y -p @lazyants/hetzner-mcp-server hetzner-mcp-networking
```

In a client configuration, replace `args` with:

```json
["-y", "-p", "@lazyants/hetzner-mcp-server", "hetzner-mcp-networking"]
```

Other groups: `servers`, `load-balancers`, `ips`, `storage`, `storage-boxes`, `config` and `dns`.
Use the same `hetzner-mcp-` command prefix and token configuration.

Every server exposes the API reference at `reference://hetzner/api`.
See [CHANGELOG.md](CHANGELOG.md) for release changes.

## Releasing

Maintainer instructions: [release guide](https://github.com/lazyants/hetzner-mcp-server/blob/main/docs/releasing.md).

## License

[FSL-1.1-MIT](LICENSE). Versions 1.1.1 and earlier remain MIT-licensed.
