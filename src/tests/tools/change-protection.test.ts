import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Captures the args of the most recent axios request() call so each test
 * can assert path + method + body shape for change_protection actions.
 */
let mockRequest: ReturnType<typeof vi.fn>;

async function loadFreshServer(): Promise<{ McpServerCls: typeof McpServer }> {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv('HETZNER_API_TOKEN', 'test-token');

  mockRequest = vi.fn().mockResolvedValue({ data: { action: { id: 1, status: 'success' } } });

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
  // _registeredTools is the SDK-internal tool registry; `handler` is the
  // function returned by handleToolRequest (bypasses Zod parsing, which is
  // fine here since we feed valid args).
  const registry = (server as unknown as { _registeredTools: Record<string, RegisteredToolEntry> })._registeredTools;
  const entry = registry[name];
  if (!entry) throw new Error(`Tool not registered: ${name}`);
  return entry.handler(args);
}

describe('change_protection tools — path and body shape', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('hetzner_change_server_protection: POST /servers/{id}/actions/change_protection with delete + rebuild', async () => {
    const { McpServerCls } = await loadFreshServer();
    const { registerServerTools } = await import('../../tools/servers.js');
    const server = new McpServerCls({ name: 't', version: '0.0.0' });
    registerServerTools(server);

    await callTool(server, 'hetzner_change_server_protection', { id: 42, delete: true, rebuild: false });

    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/servers/42/actions/change_protection',
      data: { delete: true, rebuild: false },
      params: undefined,
    });
  });

  it('hetzner_change_load_balancer_protection: POST /load_balancers/{id}/actions/change_protection with delete only', async () => {
    const { McpServerCls } = await loadFreshServer();
    const { registerLoadBalancerTools } = await import('../../tools/load-balancers.js');
    const server = new McpServerCls({ name: 't', version: '0.0.0' });
    registerLoadBalancerTools(server);

    await callTool(server, 'hetzner_change_load_balancer_protection', { id: 7, delete: true });

    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/load_balancers/7/actions/change_protection',
      data: { delete: true },
      params: undefined,
    });
  });

  it('hetzner_change_volume_protection: POST /volumes/{id}/actions/change_protection with delete only', async () => {
    const { McpServerCls } = await loadFreshServer();
    const { registerVolumeTools } = await import('../../tools/volumes.js');
    const server = new McpServerCls({ name: 't', version: '0.0.0' });
    registerVolumeTools(server);

    await callTool(server, 'hetzner_change_volume_protection', { id: 11, delete: false });

    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/volumes/11/actions/change_protection',
      data: { delete: false },
      params: undefined,
    });
  });

  it('hetzner_change_network_protection: POST /networks/{id}/actions/change_protection with delete only', async () => {
    const { McpServerCls } = await loadFreshServer();
    const { registerNetworkTools } = await import('../../tools/networks.js');
    const server = new McpServerCls({ name: 't', version: '0.0.0' });
    registerNetworkTools(server);

    await callTool(server, 'hetzner_change_network_protection', { id: 99, delete: true });

    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/networks/99/actions/change_protection',
      data: { delete: true },
      params: undefined,
    });
  });

  it('hetzner_change_floating_ip_protection: POST /floating_ips/{id}/actions/change_protection with delete only', async () => {
    const { McpServerCls } = await loadFreshServer();
    const { registerFloatingIpTools } = await import('../../tools/floating-ips.js');
    const server = new McpServerCls({ name: 't', version: '0.0.0' });
    registerFloatingIpTools(server);

    await callTool(server, 'hetzner_change_floating_ip_protection', { id: 123, delete: true });

    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/floating_ips/123/actions/change_protection',
      data: { delete: true },
      params: undefined,
    });
  });

  it('hetzner_change_primary_ip_protection: POST /primary_ips/{id}/actions/change_protection with delete only', async () => {
    const { McpServerCls } = await loadFreshServer();
    const { registerPrimaryIpTools } = await import('../../tools/primary-ips.js');
    const server = new McpServerCls({ name: 't', version: '0.0.0' });
    registerPrimaryIpTools(server);

    await callTool(server, 'hetzner_change_primary_ip_protection', { id: 456, delete: true });

    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/primary_ips/456/actions/change_protection',
      data: { delete: true },
      params: undefined,
    });
  });

  it('hetzner_change_image_protection: POST /images/{id}/actions/change_protection with delete only', async () => {
    const { McpServerCls } = await loadFreshServer();
    const { registerImageTools } = await import('../../tools/images.js');
    const server = new McpServerCls({ name: 't', version: '0.0.0' });
    registerImageTools(server);

    await callTool(server, 'hetzner_change_image_protection', { id: 789, delete: true });

    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/images/789/actions/change_protection',
      data: { delete: true },
      params: undefined,
    });
  });

  it('hetzner_change_server_protection: omits unset fields (only delete sent)', async () => {
    const { McpServerCls } = await loadFreshServer();
    const { registerServerTools } = await import('../../tools/servers.js');
    const server = new McpServerCls({ name: 't', version: '0.0.0' });
    registerServerTools(server);

    await callTool(server, 'hetzner_change_server_protection', { id: 1, delete: true });

    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/servers/1/actions/change_protection',
      data: { delete: true },
      params: undefined,
    });
  });
});
