import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerServerTools } from './tools/servers.js';
import { registerImageTools } from './tools/images.js';
import { registerIsoTools } from './tools/isos.js';
import { registerPlacementGroupTools } from './tools/placement-groups.js';
import { registerDatacenterTools } from './tools/datacenters.js';
import { registerNetworkTools } from './tools/networks.js';
import { registerFirewallTools } from './tools/firewalls.js';
import { registerLoadBalancerTools } from './tools/load-balancers.js';
import { registerCertificateTools } from './tools/certificates.js';
import { registerVolumeTools } from './tools/volumes.js';
import { registerFloatingIpTools } from './tools/floating-ips.js';
import { registerPrimaryIpTools } from './tools/primary-ips.js';
import { registerSshKeyTools } from './tools/ssh-keys.js';
import { registerDnsZoneTools } from './tools/zones.js';
import { registerPricingTools } from './tools/pricing.js';
import { registerStorageBoxTools } from './tools/storage-boxes.js';

export type Registrar = (server: McpServer) => void;

export interface Split {
  bin: string;
  registrars: Registrar[];
  toolCount: number;
}

// Single source of truth for the tool-registrar partition across the 8 split
// entry binaries + the full server. Each entry-*.ts and index.ts consume this
// instead of hand-listing registrars, so the partition can never drift out of
// sync between the runtime wiring and the tests that assert tool counts.
export const SPLITS: Record<string, Split> = {
  servers: {
    bin: 'hetzner-mcp-servers',
    registrars: [registerServerTools, registerDatacenterTools, registerPricingTools],
    toolCount: 34,
  },
  networking: {
    bin: 'hetzner-mcp-networking',
    registrars: [registerNetworkTools, registerFirewallTools],
    toolCount: 21,
  },
  'load-balancers': {
    bin: 'hetzner-mcp-load-balancers',
    registrars: [registerLoadBalancerTools, registerCertificateTools],
    toolCount: 28,
  },
  ips: {
    bin: 'hetzner-mcp-ips',
    registrars: [registerFloatingIpTools, registerPrimaryIpTools],
    toolCount: 20,
  },
  storage: {
    bin: 'hetzner-mcp-storage',
    registrars: [registerVolumeTools, registerImageTools],
    toolCount: 17,
  },
  'storage-boxes': {
    bin: 'hetzner-mcp-storage-boxes',
    registrars: [registerStorageBoxTools],
    toolCount: 29,
  },
  config: {
    bin: 'hetzner-mcp-config',
    registrars: [registerSshKeyTools, registerIsoTools, registerPlacementGroupTools],
    toolCount: 14,
  },
  dns: {
    bin: 'hetzner-mcp-dns',
    registrars: [registerDnsZoneTools],
    toolCount: 22,
  },
};

// Flattened union in a deterministic order (SPLITS insertion order) — used by
// the full server (index.ts) and by tests that need to enumerate every tool.
export const ALL_REGISTRARS: Registrar[] = Object.values(SPLITS).flatMap((s) => s.registrars);

export const TOTAL_TOOL_COUNT: number = Object.values(SPLITS).reduce((n, s) => n + s.toolCount, 0);
