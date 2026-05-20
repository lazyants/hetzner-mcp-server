import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Verifies path + method + body/params shape for CRUD + module-specific action
 * tools in the Load Balancers module. Sibling files cover related action surfaces:
 *   - `change-protection.test.ts` — hetzner_change_load_balancer_protection
 *   - `list-actions.test.ts`      — hetzner_list_load_balancer_actions
 */

let mockRequest: ReturnType<typeof vi.fn>;

async function loadFreshServer(): Promise<{ McpServerCls: typeof McpServer }> {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv('HETZNER_API_TOKEN', 'test-token');

  mockRequest = vi.fn().mockResolvedValue({ data: { load_balancer: { id: 1 } } });

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
  const { registerLoadBalancerTools } = await import('../../tools/load-balancers.js');
  const server = new McpServerCls({ name: 't', version: '0.0.0' });
  registerLoadBalancerTools(server);
  return server;
}

describe('Load Balancers tools — path, method, and body/params shape', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('hetzner_list_load_balancers: GET /load_balancers with name + label + pagination', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_list_load_balancers', {
      name: 'edge-lb',
      label_selector: 'env=prod',
      page: 1,
      per_page: 25,
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/load_balancers',
      data: undefined,
      params: { name: 'edge-lb', label_selector: 'env=prod', page: 1, per_page: 25 },
    });
  });

  it('hetzner_get_load_balancer: GET /load_balancers/{id}', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_get_load_balancer', { id: 7 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/load_balancers/7',
      data: undefined,
      params: undefined,
    });
  });

  it('hetzner_create_load_balancer: POST /load_balancers with targets + services', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_create_load_balancer', {
      name: 'edge-lb',
      load_balancer_type: 'lb11',
      location: 'fsn1',
      algorithm: { type: 'round_robin' },
      targets: [{ type: 'server', server: { id: 4711 }, use_private_ip: true }],
      services: [
        {
          protocol: 'http',
          listen_port: 80,
          destination_port: 8080,
          proxyprotocol: false,
          health_check: { protocol: 'http', port: 8080, interval: 15, timeout: 10, retries: 3 },
        },
      ],
      labels: { env: 'prod' },
      network: 9001,
      public_interface: true,
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/load_balancers',
      data: {
        name: 'edge-lb',
        load_balancer_type: 'lb11',
        location: 'fsn1',
        algorithm: { type: 'round_robin' },
        targets: [{ type: 'server', server: { id: 4711 }, use_private_ip: true }],
        services: [
          {
            protocol: 'http',
            listen_port: 80,
            destination_port: 8080,
            proxyprotocol: false,
            health_check: { protocol: 'http', port: 8080, interval: 15, timeout: 10, retries: 3 },
          },
        ],
        labels: { env: 'prod' },
        network: 9001,
        public_interface: true,
      },
      params: undefined,
    });
  });

  it('hetzner_update_load_balancer: PUT /load_balancers/{id} strips id from body', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_update_load_balancer', {
      id: 7,
      name: 'renamed-lb',
      labels: { env: 'staging' },
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'PUT',
      url: '/load_balancers/7',
      data: { name: 'renamed-lb', labels: { env: 'staging' } },
      params: undefined,
    });
  });

  it('hetzner_delete_load_balancer: DELETE /load_balancers/{id}', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_delete_load_balancer', { id: 7 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'DELETE',
      url: '/load_balancers/7',
      data: undefined,
      params: undefined,
    });
  });

  it('hetzner_add_lb_target: POST /load_balancers/{id}/actions/add_target with server target', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_add_lb_target', {
      id: 7,
      type: 'server',
      server: { id: 4711 },
      use_private_ip: true,
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/load_balancers/7/actions/add_target',
      data: { type: 'server', server: { id: 4711 }, use_private_ip: true },
      params: undefined,
    });
  });

  it('hetzner_remove_lb_target: POST /load_balancers/{id}/actions/remove_target with label selector', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_remove_lb_target', {
      id: 7,
      type: 'label_selector',
      label_selector: { selector: 'env=prod' },
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/load_balancers/7/actions/remove_target',
      data: { type: 'label_selector', label_selector: { selector: 'env=prod' } },
      params: undefined,
    });
  });

  it('hetzner_add_lb_service: POST /load_balancers/{id}/actions/add_service with http settings', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_add_lb_service', {
      id: 7,
      protocol: 'https',
      listen_port: 443,
      destination_port: 8080,
      proxyprotocol: false,
      health_check: { protocol: 'https', port: 8080, interval: 15, timeout: 10, retries: 3 },
      http: { sticky_sessions: true, cookie_name: 'lb', cookie_lifetime: 300, redirect_http: true, timeout_idle: 60 },
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/load_balancers/7/actions/add_service',
      data: {
        protocol: 'https',
        listen_port: 443,
        destination_port: 8080,
        proxyprotocol: false,
        health_check: { protocol: 'https', port: 8080, interval: 15, timeout: 10, retries: 3 },
        http: { sticky_sessions: true, cookie_name: 'lb', cookie_lifetime: 300, redirect_http: true, timeout_idle: 60 },
      },
      params: undefined,
    });
  });

  it('hetzner_update_lb_service: POST /load_balancers/{id}/actions/update_service strips id', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_update_lb_service', {
      id: 7,
      protocol: 'http',
      listen_port: 80,
      destination_port: 8081,
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/load_balancers/7/actions/update_service',
      data: { protocol: 'http', listen_port: 80, destination_port: 8081 },
      params: undefined,
    });
  });

  it('hetzner_delete_lb_service: POST /load_balancers/{id}/actions/delete_service with listen_port', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_delete_lb_service', { id: 7, listen_port: 443 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/load_balancers/7/actions/delete_service',
      data: { listen_port: 443 },
      params: undefined,
    });
  });

  it('hetzner_change_lb_algorithm: POST /load_balancers/{id}/actions/change_algorithm strips id', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_change_lb_algorithm', { id: 7, type: 'least_connections' });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/load_balancers/7/actions/change_algorithm',
      data: { type: 'least_connections' },
      params: undefined,
    });
  });

  it('hetzner_change_lb_type: POST /load_balancers/{id}/actions/change_type strips id', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_change_lb_type', { id: 7, load_balancer_type: 'lb21' });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/load_balancers/7/actions/change_type',
      data: { load_balancer_type: 'lb21' },
      params: undefined,
    });
  });

  it('hetzner_attach_lb_to_network: POST /load_balancers/{id}/actions/attach_to_network strips id', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_attach_lb_to_network', { id: 7, network: 9001, ip: '10.0.0.5' });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/load_balancers/7/actions/attach_to_network',
      data: { network: 9001, ip: '10.0.0.5' },
      params: undefined,
    });
  });

  it('hetzner_detach_lb_from_network: POST /load_balancers/{id}/actions/detach_from_network strips id', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_detach_lb_from_network', { id: 7, network: 9001 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/load_balancers/7/actions/detach_from_network',
      data: { network: 9001 },
      params: undefined,
    });
  });

  it('hetzner_get_lb_metrics: GET /load_balancers/{id}/metrics with type + time range', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_get_lb_metrics', {
      id: 7,
      type: 'requests_per_second',
      start: '2026-05-01T00:00:00Z',
      end: '2026-05-01T01:00:00Z',
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/load_balancers/7/metrics',
      data: undefined,
      params: {
        type: 'requests_per_second',
        start: '2026-05-01T00:00:00Z',
        end: '2026-05-01T01:00:00Z',
      },
    });
  });

  it('hetzner_list_lb_types: GET /load_balancer_types with name + pagination', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_list_lb_types', { name: 'lb11', page: 1, per_page: 25 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/load_balancer_types',
      data: undefined,
      params: { name: 'lb11', page: 1, per_page: 25 },
    });
  });
});
