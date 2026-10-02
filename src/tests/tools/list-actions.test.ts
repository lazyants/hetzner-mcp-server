import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Captures the args of the most recent axios request() call so each test
 * can assert path + method + query shape for list_<resource>_actions tools.
 *
 * Pattern mirrors `change-protection.test.ts` — Hetzner deprecated the
 * global `/actions` endpoint in January 2025; each resource exposes its
 * own action history at GET /<resource>/{id}/actions with `sort`,
 * `status`, `page`, and `per_page` query params.
 */
let mockRequest: ReturnType<typeof vi.fn>;

async function loadFreshServer(): Promise<{ McpServerCls: typeof McpServer }> {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv('HETZNER_API_TOKEN', 'test-token');

  mockRequest = vi.fn().mockResolvedValue({ data: { actions: [], meta: { pagination: {} } } });

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
  inputSchema: { parse: (args: Record<string, unknown>) => Record<string, unknown> };
}

async function callTool(server: McpServer, name: string, args: Record<string, unknown>): Promise<unknown> {
  const registry = (server as unknown as { _registeredTools: Record<string, RegisteredToolEntry> })._registeredTools;
  const entry = registry[name];
  if (!entry) throw new Error(`Tool not registered: ${name}`);
  return entry.handler(args);
}

describe('list_<resource>_actions tools — path, method, and query shape', () => {
  it('all eleven action-list schemas accept arrays and preserve their order through the request path', async () => {
    const { McpServerCls } = await loadFreshServer();
    const { ALL_REGISTRARS } = await import('../../splits.js');
    const server = new McpServerCls({ name: 't', version: '0.0.0' });
    for (const register of ALL_REGISTRARS) register(server);
    const registry = (server as unknown as { _registeredTools: Record<string, RegisteredToolEntry> })._registeredTools;
    const tools = Object.entries(registry).filter(([name]) => /^hetzner_list_.+_actions$/.test(name));
    expect(tools).toHaveLength(11);
    for (const [name, entry] of tools) {
      const id = name === 'hetzner_list_zone_actions' ? { id_or_name: 'example.com' } : { id: 42 };
      const query = { sort: ['id:desc', 'command:asc'], status: ['success', 'error'], page: 2, per_page: 25 };
      const args = entry.inputSchema.parse({ ...id, ...query });
      await entry.handler(args);
      expect(mockRequest, name).toHaveBeenLastCalledWith({
        method: 'GET', url: expect.stringMatching(/^\/[a-z_]+\/(42|example\.com)\/actions$/),
        data: undefined, params: query,
      });
      expect(entry.inputSchema.parse({ ...id, sort: 'id:asc', status: 'running' })).toEqual({ ...id, sort: 'id:asc', status: 'running' });
    }
  });

  it('the HTTP client serializes sort and status as repeated keys without brackets or commas', async () => {
    vi.resetModules();
    vi.stubEnv('HETZNER_API_TOKEN', 'test-token');
    let serializedUrl = '';
    vi.doMock('axios', async (importOriginal) => {
      const actual = await importOriginal<typeof import('axios')>();
      return {
        ...actual,
        default: {
          ...actual.default,
          create: (options: Parameters<typeof actual.default.create>[0]) => actual.default.create({
            ...options,
            adapter: async (config) => {
              serializedUrl = actual.default.getUri(config);
              return { data: { actions: [] }, status: 200, statusText: 'OK', headers: {}, config };
            },
          }),
        },
      };
    });
    const { hetznerRequest } = await import('../../services/hetzner.js');
    await hetznerRequest('GET', '/servers/42/actions', undefined, { sort: ['id:desc', 'command:asc'], status: ['success', 'error'] });
    const url = new URL(serializedUrl);
    expect(url.searchParams.getAll('sort')).toEqual(['id:desc', 'command:asc']);
    expect(url.searchParams.getAll('status')).toEqual(['success', 'error']);
    expect([...url.searchParams.keys()]).toEqual(['sort', 'sort', 'status', 'status']);
  });

  beforeEach(() => {
    vi.resetModules();
  });

  it('hetzner_list_load_balancer_actions: GET /load_balancers/{id}/actions with sort + status + pagination', async () => {
    const { McpServerCls } = await loadFreshServer();
    const { registerLoadBalancerTools } = await import('../../tools/load-balancers.js');
    const server = new McpServerCls({ name: 't', version: '0.0.0' });
    registerLoadBalancerTools(server);

    await callTool(server, 'hetzner_list_load_balancer_actions', {
      id: 7,
      sort: 'id:desc',
      status: ['success', 'error'],
      page: 1,
      per_page: 25,
    });

    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/load_balancers/7/actions',
      data: undefined,
      params: { sort: 'id:desc', status: ['success', 'error'], page: 1, per_page: 25 },
    });
  });

  it('hetzner_list_volume_actions: GET /volumes/{id}/actions with id only', async () => {
    const { McpServerCls } = await loadFreshServer();
    const { registerVolumeTools } = await import('../../tools/volumes.js');
    const server = new McpServerCls({ name: 't', version: '0.0.0' });
    registerVolumeTools(server);

    await callTool(server, 'hetzner_list_volume_actions', { id: 11 });

    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/volumes/11/actions',
      data: undefined,
      params: {},
    });
  });

  it('hetzner_list_floating_ip_actions: GET /floating_ips/{id}/actions with status filter', async () => {
    const { McpServerCls } = await loadFreshServer();
    const { registerFloatingIpTools } = await import('../../tools/floating-ips.js');
    const server = new McpServerCls({ name: 't', version: '0.0.0' });
    registerFloatingIpTools(server);

    await callTool(server, 'hetzner_list_floating_ip_actions', { id: 123, status: 'running' });

    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/floating_ips/123/actions',
      data: undefined,
      params: { status: 'running' },
    });
  });

  it('hetzner_list_primary_ip_actions: GET /primary_ips/{id}/actions with pagination', async () => {
    const { McpServerCls } = await loadFreshServer();
    const { registerPrimaryIpTools } = await import('../../tools/primary-ips.js');
    const server = new McpServerCls({ name: 't', version: '0.0.0' });
    registerPrimaryIpTools(server);

    await callTool(server, 'hetzner_list_primary_ip_actions', { id: 456, page: 2, per_page: 50 });

    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/primary_ips/456/actions',
      data: undefined,
      params: { page: 2, per_page: 50 },
    });
  });

  it('hetzner_list_network_actions: GET /networks/{id}/actions with sort', async () => {
    const { McpServerCls } = await loadFreshServer();
    const { registerNetworkTools } = await import('../../tools/networks.js');
    const server = new McpServerCls({ name: 't', version: '0.0.0' });
    registerNetworkTools(server);

    await callTool(server, 'hetzner_list_network_actions', { id: 99, sort: 'command:asc' });

    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/networks/99/actions',
      data: undefined,
      params: { sort: 'command:asc' },
    });
  });

  it('hetzner_list_firewall_actions: GET /firewalls/{id}/actions with id only', async () => {
    const { McpServerCls } = await loadFreshServer();
    const { registerFirewallTools } = await import('../../tools/firewalls.js');
    const server = new McpServerCls({ name: 't', version: '0.0.0' });
    registerFirewallTools(server);

    await callTool(server, 'hetzner_list_firewall_actions', { id: 5 });

    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/firewalls/5/actions',
      data: undefined,
      params: {},
    });
  });

  it('hetzner_list_certificate_actions: GET /certificates/{id}/actions with id only', async () => {
    const { McpServerCls } = await loadFreshServer();
    const { registerCertificateTools } = await import('../../tools/certificates.js');
    const server = new McpServerCls({ name: 't', version: '0.0.0' });
    registerCertificateTools(server);

    await callTool(server, 'hetzner_list_certificate_actions', { id: 17 });

    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/certificates/17/actions',
      data: undefined,
      params: {},
    });
  });

  it('hetzner_list_server_actions: GET /servers/{id}/actions with sort + status + pagination', async () => {
    const { McpServerCls } = await loadFreshServer();
    const { registerServerTools } = await import('../../tools/servers.js');
    const server = new McpServerCls({ name: 't', version: '0.0.0' });
    registerServerTools(server);

    await callTool(server, 'hetzner_list_server_actions', { id: 3, sort: 'id:asc', status: 'running', page: 1, per_page: 25 });

    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/servers/3/actions',
      data: undefined,
      params: { sort: 'id:asc', status: 'running', page: 1, per_page: 25 },
    });
  });

  it('hetzner_list_image_actions: GET /images/{id}/actions with status + pagination', async () => {
    const { McpServerCls } = await loadFreshServer();
    const { registerImageTools } = await import('../../tools/images.js');
    const server = new McpServerCls({ name: 't', version: '0.0.0' });
    registerImageTools(server);

    await callTool(server, 'hetzner_list_image_actions', { id: 789, status: 'success', per_page: 10 });

    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/images/789/actions',
      data: undefined,
      params: { status: 'success', per_page: 10 },
    });
  });
});
