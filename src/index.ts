#!/usr/bin/env node
import { createServer, startServer } from './server.js';
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

const server = createServer('hetzner-mcp-server');

// Compute
registerServerTools(server);
registerImageTools(server);
registerIsoTools(server);
registerPlacementGroupTools(server);
registerDatacenterTools(server);

// Network
registerNetworkTools(server);
registerFirewallTools(server);
registerLoadBalancerTools(server);
registerCertificateTools(server);

// Resources
registerVolumeTools(server);
registerFloatingIpTools(server);
registerPrimaryIpTools(server);
registerSshKeyTools(server);

// DNS
registerDnsZoneTools(server);

startServer(server).catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
