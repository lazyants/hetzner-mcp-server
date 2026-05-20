import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Verifies path + method + body/params shape for CRUD + subnet + route tools
 * in the Networks module. Sibling files cover related action surfaces:
 *   - `change-protection.test.ts` — hetzner_change_network_protection
 *   - `list-actions.test.ts`      — hetzner_list_network_actions
 *   - `server-actions.test.ts`    — hetzner_change_ip_range
 */

let mockRequest: ReturnType<typeof vi.fn>;

async function loadFreshServer(): Promise<{ McpServerCls: typeof McpServer }> {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv('HETZNER_API_TOKEN', 'test-token');

  mockRequest = vi.fn().mockResolvedValue({ data: { network: { id: 1 } } });

  vi.doMock('axios', async (importOriginal) => {
    const actual = await importOriginal<typeof import('axios')>();
    return {
      ...actual,
      default: {
        ...actual.default,
        create: () => ({
          interceptors: { response: { use: vi.fn() } },
          request: mockRequest,
        }),
      },
    };
  });

  const { McpServer: Cls } = await import('@modelcontextprotocol/sdk/server/mcp.js');
  return { McpServerCls: Cls };
}

interface RegisteredToolEntry {
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

async function callTool(server: McpServer, name: string, args: Record<string, unknown>): Promise<unknown> {
  const registry = (server as unknown as { _registeredTools: Record<string, RegisteredToolEntry> })._registeredTools;
  const entry = registry[name];
  if (!entry) throw new Error(`Tool not registered: ${name}`);
  return entry.handler(args);
}

async function setupServer(): Promise<McpServer> {
  const { McpServerCls } = await loadFreshServer();
  const { registerNetworkTools } = await import('../../tools/networks.js');
  const server = new McpServerCls({ name: 't', version: '0.0.0' });
  registerNetworkTools(server);
  return server;
}

describe('Networks tools — path, method, and body/params shape', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('hetzner_list_networks: GET /networks with filters + pagination', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_list_networks', {
      name: 'private',
      label_selector: 'env=prod',
      page: 1,
      per_page: 25,
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/networks',
      data: undefined,
      params: { name: 'private', label_selector: 'env=prod', page: 1, per_page: 25 },
    });
  });

  it('hetzner_get_network: GET /networks/{id}', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_get_network', { id: 4711 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/networks/4711',
      data: undefined,
      params: undefined,
    });
  });

  it('hetzner_create_network: POST /networks with subnets + routes', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_create_network', {
      name: 'private',
      ip_range: '10.0.0.0/8',
      subnets: [
        { type: 'cloud', ip_range: '10.0.1.0/24', network_zone: 'eu-central' },
      ],
      routes: [
        { destination: '10.100.0.0/16', gateway: '10.0.1.1' },
      ],
      labels: { env: 'prod' },
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/networks',
      data: {
        name: 'private',
        ip_range: '10.0.0.0/8',
        subnets: [{ type: 'cloud', ip_range: '10.0.1.0/24', network_zone: 'eu-central' }],
        routes: [{ destination: '10.100.0.0/16', gateway: '10.0.1.1' }],
        labels: { env: 'prod' },
      },
      params: undefined,
    });
  });

  it('hetzner_update_network: PUT /networks/{id} strips id from body', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_update_network', {
      id: 4711,
      name: 'renamed',
      expose_routes_to_vswitch: true,
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'PUT',
      url: '/networks/4711',
      data: { name: 'renamed', expose_routes_to_vswitch: true },
      params: undefined,
    });
  });

  it('hetzner_delete_network: DELETE /networks/{id}', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_delete_network', { id: 4711 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'DELETE',
      url: '/networks/4711',
      data: undefined,
      params: undefined,
    });
  });

  it('hetzner_add_subnet: POST /networks/{id}/actions/add_subnet with cloud subnet body', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_add_subnet', {
      id: 4711,
      type: 'cloud',
      network_zone: 'eu-central',
      ip_range: '10.0.2.0/24',
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/networks/4711/actions/add_subnet',
      data: { type: 'cloud', network_zone: 'eu-central', ip_range: '10.0.2.0/24' },
      params: undefined,
    });
  });

  it('hetzner_add_subnet: POST /networks/{id}/actions/add_subnet with vswitch body', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_add_subnet', {
      id: 4711,
      type: 'vswitch',
      network_zone: 'eu-central',
      vswitch_id: 1234,
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/networks/4711/actions/add_subnet',
      data: { type: 'vswitch', network_zone: 'eu-central', vswitch_id: 1234 },
      params: undefined,
    });
  });

  it('hetzner_delete_subnet: POST /networks/{id}/actions/delete_subnet with ip_range', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_delete_subnet', { id: 4711, ip_range: '10.0.2.0/24' });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/networks/4711/actions/delete_subnet',
      data: { ip_range: '10.0.2.0/24' },
      params: undefined,
    });
  });

  it('hetzner_add_route: POST /networks/{id}/actions/add_route with destination + gateway', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_add_route', {
      id: 4711,
      destination: '10.100.0.0/16',
      gateway: '10.0.1.1',
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/networks/4711/actions/add_route',
      data: { destination: '10.100.0.0/16', gateway: '10.0.1.1' },
      params: undefined,
    });
  });

  it('hetzner_delete_route: POST /networks/{id}/actions/delete_route with destination + gateway', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_delete_route', {
      id: 4711,
      destination: '10.100.0.0/16',
      gateway: '10.0.1.1',
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/networks/4711/actions/delete_route',
      data: { destination: '10.100.0.0/16', gateway: '10.0.1.1' },
      params: undefined,
    });
  });
});
