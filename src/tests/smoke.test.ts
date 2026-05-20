import { describe, it, expect } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { registerServerTools } from '../tools/servers.js';
import { registerImageTools } from '../tools/images.js';
import { registerIsoTools } from '../tools/isos.js';
import { registerPlacementGroupTools } from '../tools/placement-groups.js';
import { registerDatacenterTools } from '../tools/datacenters.js';
import { registerNetworkTools } from '../tools/networks.js';
import { registerFirewallTools } from '../tools/firewalls.js';
import { registerLoadBalancerTools } from '../tools/load-balancers.js';
import { registerCertificateTools } from '../tools/certificates.js';
import { registerVolumeTools } from '../tools/volumes.js';
import { registerFloatingIpTools } from '../tools/floating-ips.js';
import { registerPrimaryIpTools } from '../tools/primary-ips.js';
import { registerSshKeyTools } from '../tools/ssh-keys.js';
import { registerDnsZoneTools } from '../tools/zones.js';

function toolCount(server: McpServer): number {
  // _registeredTools is a plain object keyed by tool name
  return Object.keys((server as any)._registeredTools).length;
}

function freshServer(name = 'test-server'): McpServer {
  return new McpServer({ name, version: '0.0.0' });
}

describe('Tool registration smoke tests', () => {
  it('registers all 147 tools for full server', () => {
    const server = freshServer();
    registerServerTools(server);
    registerImageTools(server);
    registerIsoTools(server);
    registerPlacementGroupTools(server);
    registerDatacenterTools(server);
    registerNetworkTools(server);
    registerFirewallTools(server);
    registerLoadBalancerTools(server);
    registerCertificateTools(server);
    registerVolumeTools(server);
    registerFloatingIpTools(server);
    registerPrimaryIpTools(server);
    registerSshKeyTools(server);
    registerDnsZoneTools(server);
    expect(toolCount(server)).toBe(147);
  });

  it('registers 28 tools for servers split', () => {
    const server = freshServer();
    registerServerTools(server);
    registerDatacenterTools(server);
    expect(toolCount(server)).toBe(28);
  });

  it('registers 21 tools for networking split', () => {
    const server = freshServer();
    registerNetworkTools(server);
    registerFirewallTools(server);
    expect(toolCount(server)).toBe(21);
  });

  it('registers 25 tools for load-balancers split', () => {
    const server = freshServer();
    registerLoadBalancerTools(server);
    registerCertificateTools(server);
    expect(toolCount(server)).toBe(25);
  });

  it('registers 20 tools for ips split', () => {
    const server = freshServer();
    registerFloatingIpTools(server);
    registerPrimaryIpTools(server);
    expect(toolCount(server)).toBe(20);
  });

  it('registers 17 tools for storage split', () => {
    const server = freshServer();
    registerVolumeTools(server);
    registerImageTools(server);
    expect(toolCount(server)).toBe(17);
  });

  it('registers 14 tools for config split', () => {
    const server = freshServer();
    registerSshKeyTools(server);
    registerIsoTools(server);
    registerPlacementGroupTools(server);
    expect(toolCount(server)).toBe(14);
  });

  it('registers 22 tools for dns split', () => {
    const server = freshServer();
    registerDnsZoneTools(server);
    expect(toolCount(server)).toBe(22);
  });
});
