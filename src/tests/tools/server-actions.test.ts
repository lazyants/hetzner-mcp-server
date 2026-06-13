import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Captures the args of the most recent axios request() call so each test
 * can assert path + method + body shape for miscellaneous server and
 * network actions (request_console, enable/disable_backup, change_alias_ips,
 * change_dns_ptr, change_ip_range).
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

describe('miscellaneous server + network actions — path and body shape', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('hetzner_request_console: POST /servers/{id}/actions/request_console (no body)', async () => {
    const { McpServerCls } = await loadFreshServer();
    const { registerServerTools } = await import('../../tools/servers.js');
    const server = new McpServerCls({ name: 't', version: '0.0.0' });
    registerServerTools(server);

    await callTool(server, 'hetzner_request_console', { id: 42 });

    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/servers/42/actions/request_console',
      data: undefined,
      params: undefined,
    });
  });

  it('hetzner_enable_backup: POST /servers/{id}/actions/enable_backup (no body)', async () => {
    const { McpServerCls } = await loadFreshServer();
    const { registerServerTools } = await import('../../tools/servers.js');
    const server = new McpServerCls({ name: 't', version: '0.0.0' });
    registerServerTools(server);

    await callTool(server, 'hetzner_enable_backup', { id: 7 });

    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/servers/7/actions/enable_backup',
      data: undefined,
      params: undefined,
    });
  });

  it('hetzner_disable_backup: POST /servers/{id}/actions/disable_backup (no body)', async () => {
    const { McpServerCls } = await loadFreshServer();
    const { registerServerTools } = await import('../../tools/servers.js');
    const server = new McpServerCls({ name: 't', version: '0.0.0' });
    registerServerTools(server);

    await callTool(server, 'hetzner_disable_backup', { id: 13 });

    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/servers/13/actions/disable_backup',
      data: undefined,
      params: undefined,
    });
  });

  it('hetzner_change_alias_ips: POST /servers/{id}/actions/change_alias_ips with network + alias_ips', async () => {
    const { McpServerCls } = await loadFreshServer();
    const { registerServerTools } = await import('../../tools/servers.js');
    const server = new McpServerCls({ name: 't', version: '0.0.0' });
    registerServerTools(server);

    await callTool(server, 'hetzner_change_alias_ips', {
      id: 21,
      network: 4711,
      alias_ips: ['10.0.0.5', '10.0.0.6'],
    });

    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/servers/21/actions/change_alias_ips',
      data: { network: 4711, alias_ips: ['10.0.0.5', '10.0.0.6'] },
      params: undefined,
    });
  });

  it('hetzner_change_alias_ips: accepts empty alias_ips array (clears all aliases)', async () => {
    const { McpServerCls } = await loadFreshServer();
    const { registerServerTools } = await import('../../tools/servers.js');
    const server = new McpServerCls({ name: 't', version: '0.0.0' });
    registerServerTools(server);

    await callTool(server, 'hetzner_change_alias_ips', {
      id: 22,
      network: 4712,
      alias_ips: [],
    });

    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/servers/22/actions/change_alias_ips',
      data: { network: 4712, alias_ips: [] },
      params: undefined,
    });
  });

  it('hetzner_change_dns_ptr: POST /servers/{id}/actions/change_dns_ptr with ip + dns_ptr', async () => {
    const { McpServerCls } = await loadFreshServer();
    const { registerServerTools } = await import('../../tools/servers.js');
    const server = new McpServerCls({ name: 't', version: '0.0.0' });
    registerServerTools(server);

    await callTool(server, 'hetzner_change_dns_ptr', {
      id: 99,
      ip: '203.0.113.5',
      dns_ptr: 'host.example.com',
    });

    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/servers/99/actions/change_dns_ptr',
      data: { ip: '203.0.113.5', dns_ptr: 'host.example.com' },
      params: undefined,
    });
  });

  it('hetzner_change_dns_ptr: accepts dns_ptr: null to reset PTR record', async () => {
    const { McpServerCls } = await loadFreshServer();
    const { registerServerTools } = await import('../../tools/servers.js');
    const server = new McpServerCls({ name: 't', version: '0.0.0' });
    registerServerTools(server);

    await callTool(server, 'hetzner_change_dns_ptr', {
      id: 100,
      ip: '203.0.113.6',
      dns_ptr: null,
    });

    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/servers/100/actions/change_dns_ptr',
      data: { ip: '203.0.113.6', dns_ptr: null },
      params: undefined,
    });
  });

  it('hetzner_change_ip_range: POST /networks/{id}/actions/change_ip_range with CIDR body', async () => {
    const { McpServerCls } = await loadFreshServer();
    const { registerNetworkTools } = await import('../../tools/networks.js');
    const server = new McpServerCls({ name: 't', version: '0.0.0' });
    registerNetworkTools(server);

    await callTool(server, 'hetzner_change_ip_range', {
      id: 33,
      ip_range: '10.0.0.0/8',
    });

    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/networks/33/actions/change_ip_range',
      data: { ip_range: '10.0.0.0/8' },
      params: undefined,
    });
  });

  it('hetzner_attach_server_to_network: POST /servers/{id}/actions/attach_to_network with network + ip + alias_ips + ip_range', async () => {
    const { McpServerCls } = await loadFreshServer();
    const { registerServerTools } = await import('../../tools/servers.js');
    const server = new McpServerCls({ name: 't', version: '0.0.0' });
    registerServerTools(server);

    await callTool(server, 'hetzner_attach_server_to_network', {
      id: 42,
      network: 4711,
      ip: '10.0.0.5',
      alias_ips: ['10.0.0.6'],
      ip_range: '10.0.1.0/24',
    });

    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/servers/42/actions/attach_to_network',
      data: { network: 4711, ip: '10.0.0.5', alias_ips: ['10.0.0.6'], ip_range: '10.0.1.0/24' },
      params: undefined,
    });
  });

  it('hetzner_attach_server_to_network: forwards only the required network when optional fields omitted', async () => {
    const { McpServerCls } = await loadFreshServer();
    const { registerServerTools } = await import('../../tools/servers.js');
    const server = new McpServerCls({ name: 't', version: '0.0.0' });
    registerServerTools(server);

    await callTool(server, 'hetzner_attach_server_to_network', { id: 43, network: 4712 });

    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/servers/43/actions/attach_to_network',
      data: { network: 4712 },
      params: undefined,
    });
  });

  it('hetzner_detach_server_from_network: POST /servers/{id}/actions/detach_from_network with network', async () => {
    const { McpServerCls } = await loadFreshServer();
    const { registerServerTools } = await import('../../tools/servers.js');
    const server = new McpServerCls({ name: 't', version: '0.0.0' });
    registerServerTools(server);

    await callTool(server, 'hetzner_detach_server_from_network', { id: 42, network: 4711 });

    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/servers/42/actions/detach_from_network',
      data: { network: 4711 },
      params: undefined,
    });
  });

  it('hetzner_add_server_to_placement_group: POST /servers/{id}/actions/add_to_placement_group with placement_group', async () => {
    const { McpServerCls } = await loadFreshServer();
    const { registerServerTools } = await import('../../tools/servers.js');
    const server = new McpServerCls({ name: 't', version: '0.0.0' });
    registerServerTools(server);

    await callTool(server, 'hetzner_add_server_to_placement_group', { id: 42, placement_group: 909 });

    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/servers/42/actions/add_to_placement_group',
      data: { placement_group: 909 },
      params: undefined,
    });
  });

  it('hetzner_remove_server_from_placement_group: POST /servers/{id}/actions/remove_from_placement_group (no body)', async () => {
    const { McpServerCls } = await loadFreshServer();
    const { registerServerTools } = await import('../../tools/servers.js');
    const server = new McpServerCls({ name: 't', version: '0.0.0' });
    registerServerTools(server);

    await callTool(server, 'hetzner_remove_server_from_placement_group', { id: 42 });

    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/servers/42/actions/remove_from_placement_group',
      data: undefined,
      params: undefined,
    });
  });

  it('hetzner_reset_server_password: POST /servers/{id}/actions/reset_password (no body) and surfaces root_password', async () => {
    const { McpServerCls } = await loadFreshServer();
    // Reset-password returns a one-time root_password alongside the action.
    mockRequest.mockResolvedValueOnce({
      data: { action: { id: 9, status: 'running' }, root_password: 'zaq1XSW@cde3' },
    });
    const { registerServerTools } = await import('../../tools/servers.js');
    const server = new McpServerCls({ name: 't', version: '0.0.0' });
    registerServerTools(server);

    const result = (await callTool(server, 'hetzner_reset_server_password', { id: 42 })) as {
      content: { text: string }[];
      structuredContent?: { root_password?: string };
    };

    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/servers/42/actions/reset_password',
      data: undefined,
      params: undefined,
    });
    // The generated root password must be surfaced to the caller.
    expect(result.structuredContent?.root_password).toBe('zaq1XSW@cde3');
    expect(result.content[0].text).toContain('zaq1XSW@cde3');
  });
});
