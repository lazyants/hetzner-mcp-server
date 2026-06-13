import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Stable URI + name for the read-only API-reference Resource.
export const REFERENCE_URI = 'reference://hetzner/api';
export const REFERENCE_NAME = 'hetzner-api-reference';

// Package-safe reference content: built from an ARRAY of plain quoted lines
// joined by '\n', NOT a template literal. Markdown contains backtick code
// fences and ${...}-like placeholder text that would corrupt a template
// literal; an array of single-quoted lines is immune to those hazards.
// This compiles into dist/ so npm/npx consumers can read it without a
// runtime file read (the .claude/shared reference lives outside the package).
export const REFERENCE_MD = [
  '# Hetzner Cloud API Reference',
  '',
  'Quick reference for the Hetzner Cloud API surface exposed by this MCP server.',
  'Full documentation: https://docs.hetzner.cloud/',
  '',
  '## Base URL',
  '',
  '`https://api.hetzner.cloud/v1`',
  '',
  '## Authentication',
  '',
  'Bearer token via the `HETZNER_API_TOKEN` environment variable.',
  '',
  '## Rate limits',
  '',
  '- 3,600 requests/hour per token.',
  '- The client retries 429 responses automatically (exponential backoff, max 3 retries).',
  '',
  '## Pagination',
  '',
  'List endpoints accept `page` and `per_page` (max 50, default 25) and return a',
  '`meta.pagination` object.',
  '',
  '## Domains and base paths',
  '',
  '| Domain | Base path | Actions path |',
  '|---|---|---|',
  '| Servers | `/servers` | `/servers/{id}/actions/{action}` |',
  '| Images | `/images` | `/servers/{id}/actions/create_image` |',
  '| ISOs | `/isos` | `/servers/{id}/actions/attach_iso` |',
  '| Placement Groups | `/placement_groups` | — |',
  '| Datacenters | `/datacenters` | — |',
  '| Locations | `/locations` | — |',
  '| Server Types | `/server_types` | — |',
  '| Pricing | `/pricing` | — |',
  '| Networks | `/networks` | `/networks/{id}/actions/{action}` |',
  '| Firewalls | `/firewalls` | `/firewalls/{id}/actions/{action}` |',
  '| Load Balancers | `/load_balancers` | `/load_balancers/{id}/actions/{action}` |',
  '| LB Types | `/load_balancer_types` | — |',
  '| Certificates | `/certificates` | `/certificates/{id}/actions/retry` |',
  '| Volumes | `/volumes` | `/volumes/{id}/actions/{action}` |',
  '| Floating IPs | `/floating_ips` | `/floating_ips/{id}/actions/{action}` |',
  '| Primary IPs | `/primary_ips` | `/primary_ips/{id}/actions/{action}` |',
  '| SSH Keys | `/ssh_keys` | — |',
  '| DNS Zones | `/zones` | `/zones/{id_or_name}/actions/{action}` |',
  '| Zone RRSets | `/zones/{id_or_name}/rrsets` | `/zones/{id_or_name}/rrsets/{name}/{type}/actions/{action}` |',
  '',
  '## Conventions',
  '',
  '- Labels are key-value pairs, filterable via the `label_selector` query param.',
  '- Mutating operations return an `action` object with `id`, `status`, `progress`, `command`.',
  '- CRUD: GET (list/get), POST (create/action), PUT (update), DELETE (delete).',
  '- Sub-resource actions: POST to `/<resource>/{id}/actions/{action}`.',
  '',
  '## Per-resource action history',
  '',
  'Hetzner deprecated the global `/actions` endpoint. Each resource exposes its own',
  'action history at `GET /<resource>/{id}/actions` (filters: `sort`, `status`,',
  '`page`, `per_page`). Per-action-id GET endpoints are deprecated; only the list',
  'endpoint is forward-compatible. Supported on: servers, load_balancers, volumes,',
  'networks, firewalls, floating_ips, primary_ips, certificates, images, zones.',
  '',
].join('\n');

// Register the read-only API-reference Resource on a server instance. Called
// from index.ts AND every entry-*.ts so split-binary deployments also expose it.
export function registerReferenceResource(server: McpServer): void {
  server.registerResource(
    REFERENCE_NAME,
    REFERENCE_URI,
    {
      title: 'Hetzner Cloud API Reference',
      description: 'Quick reference for the Hetzner Cloud API domains, endpoints, and conventions covered by this MCP server.',
      mimeType: 'text/markdown',
    },
    (uri) => ({
      // uri arrives as a URL object; ReadResourceResult.contents[].uri must be a string.
      contents: [
        {
          uri: uri.toString(),
          mimeType: 'text/markdown',
          text: REFERENCE_MD,
        },
      ],
    })
  );
}
