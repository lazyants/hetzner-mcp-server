import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Verifies path + method + body/params shape for the core CRUD + power-control
 * tools in the Servers module. Sibling files cover related surfaces:
 *   - `change-protection.test.ts` — hetzner_change_server_protection
 *   - `list-actions.test.ts`      — hetzner_list_server_actions
 *   - `server-actions.test.ts`    — request_console, enable/disable_backup,
 *                                   change_alias_ips, change_dns_ptr
 *
 * This file backfills everything else in `src/tools/servers.ts`.
 */

let mockRequest: ReturnType<typeof vi.fn>;

async function loadFreshServer(): Promise<{ McpServerCls: typeof McpServer }> {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv('HETZNER_API_TOKEN', 'test-token');

  mockRequest = vi.fn().mockResolvedValue({ data: { server: { id: 1 } } });

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
  const { registerServerTools } = await import('../../tools/servers.js');
  const server = new McpServerCls({ name: 't', version: '0.0.0' });
  registerServerTools(server);
  return server;
}

describe('Servers tools — path, method, and body/params shape', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  it('hetzner_list_servers: GET /servers with all filters + pagination', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_list_servers', {
      name: 'web-1',
      label_selector: 'env=prod',
      status: 'running',
      page: 1,
      per_page: 25,
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/servers',
      data: undefined,
      params: { name: 'web-1', label_selector: 'env=prod', status: 'running', page: 1, per_page: 25 },
    });
  });

  it('hetzner_list_servers: GET /servers with no filters strips undefined', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_list_servers', {});
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/servers',
      data: undefined,
      params: {},
    });
  });

  it('hetzner_get_server: GET /servers/{id}', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_get_server', { id: 42 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/servers/42',
      data: undefined,
      params: undefined,
    });
  });

  it('hetzner_create_server: POST /servers with full body', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_create_server', {
      name: 'web-1',
      server_type: 'cx22',
      image: 'ubuntu-22.04',
      location: 'fsn1',
      ssh_keys: ['key-name', 123],
      networks: [4711],
      firewalls: [{ firewall: 99 }],
      user_data: '#cloud-config',
      labels: { env: 'prod' },
      placement_group: 7,
      public_net: { enable_ipv4: true, enable_ipv6: false },
      automount: false,
      start_after_create: true,
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/servers',
      data: {
        name: 'web-1',
        server_type: 'cx22',
        image: 'ubuntu-22.04',
        location: 'fsn1',
        ssh_keys: ['key-name', 123],
        networks: [4711],
        firewalls: [{ firewall: 99 }],
        user_data: '#cloud-config',
        labels: { env: 'prod' },
        placement_group: 7,
        public_net: { enable_ipv4: true, enable_ipv6: false },
        automount: false,
        start_after_create: true,
      },
      params: undefined,
    });
  });

  it('hetzner_create_server: POST /servers with minimal body', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_create_server', {
      name: 'minimal',
      server_type: 'cx22',
      image: 'ubuntu-22.04',
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/servers',
      data: { name: 'minimal', server_type: 'cx22', image: 'ubuntu-22.04' },
      params: undefined,
    });
  });

  it('hetzner_update_server: PUT /servers/{id} strips id from body', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_update_server', { id: 42, name: 'renamed', labels: { env: 'staging' } });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'PUT',
      url: '/servers/42',
      data: { name: 'renamed', labels: { env: 'staging' } },
      params: undefined,
    });
  });

  it('hetzner_delete_server: DELETE /servers/{id}', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_delete_server', { id: 42 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'DELETE',
      url: '/servers/42',
      data: undefined,
      params: undefined,
    });
  });

  // ---------------------------------------------------------------------------
  // Power control (all parameterless POST actions)
  // ---------------------------------------------------------------------------

  it.each([
    ['hetzner_power_on',  'poweron'],
    ['hetzner_power_off', 'poweroff'],
    ['hetzner_reboot',    'reboot'],
    ['hetzner_reset',     'reset'],
    ['hetzner_shutdown',  'shutdown'],
  ])('%s: POST /servers/{id}/actions/%s (no body)', async (toolName, action) => {
    const server = await setupServer();
    await callTool(server, toolName, { id: 42 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: `/servers/42/actions/${action}`,
      data: undefined,
      params: undefined,
    });
  });

  // ---------------------------------------------------------------------------
  // Rebuild / resize / rescue
  // ---------------------------------------------------------------------------

  it('hetzner_rebuild_server: POST /servers/{id}/actions/rebuild with image + user_data', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_rebuild_server', { id: 42, image: 'debian-12', user_data: '#cloud-config' });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/servers/42/actions/rebuild',
      data: { image: 'debian-12', user_data: '#cloud-config' },
      params: undefined,
    });
  });

  it('hetzner_resize_server: POST /servers/{id}/actions/change_type with server_type + upgrade_disk', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_resize_server', { id: 42, server_type: 'cx32', upgrade_disk: false });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/servers/42/actions/change_type',
      data: { server_type: 'cx32', upgrade_disk: false },
      params: undefined,
    });
  });

  it('hetzner_enable_rescue: POST /servers/{id}/actions/enable_rescue with type + ssh_keys', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_enable_rescue', { id: 42, type: 'linux64', ssh_keys: [1, 2, 3] });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/servers/42/actions/enable_rescue',
      data: { type: 'linux64', ssh_keys: [1, 2, 3] },
      params: undefined,
    });
  });

  it('hetzner_enable_rescue: POST /servers/{id}/actions/enable_rescue with empty body', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_enable_rescue', { id: 42 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/servers/42/actions/enable_rescue',
      data: {},
      params: undefined,
    });
  });

  it('hetzner_disable_rescue: POST /servers/{id}/actions/disable_rescue (no body)', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_disable_rescue', { id: 42 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/servers/42/actions/disable_rescue',
      data: undefined,
      params: undefined,
    });
  });

  // ---------------------------------------------------------------------------
  // Metrics
  // ---------------------------------------------------------------------------

  it('hetzner_get_server_metrics: GET /servers/{id}/metrics with type/start/end as query params', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_get_server_metrics', {
      id: 42,
      type: 'cpu,disk',
      start: '2025-01-01T00:00:00Z',
      end: '2025-01-02T00:00:00Z',
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/servers/42/metrics',
      data: undefined,
      params: { type: 'cpu,disk', start: '2025-01-01T00:00:00Z', end: '2025-01-02T00:00:00Z' },
    });
  });
});
