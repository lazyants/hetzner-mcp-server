import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Verifies path + method + body/params shape for CRUD + module-specific action
 * tools in the Floating IPs module. Sibling files cover cross-cutting surfaces:
 *   - `change-protection.test.ts` — hetzner_change_floating_ip_protection
 *   - `list-actions.test.ts`      — hetzner_list_floating_ip_actions
 */

let mockRequest: ReturnType<typeof vi.fn>;

async function loadFreshServer(): Promise<{ McpServerCls: typeof McpServer }> {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv('HETZNER_API_TOKEN', 'test-token');

  mockRequest = vi.fn().mockResolvedValue({ data: { floating_ip: { id: 1 } } });

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
  const { registerFloatingIpTools } = await import('../../tools/floating-ips.js');
  const server = new McpServerCls({ name: 't', version: '0.0.0' });
  registerFloatingIpTools(server);
  return server;
}

describe('Floating IPs tools — path, method, and body/params shape', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('hetzner_list_floating_ips: GET /floating_ips with filters + pagination', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_list_floating_ips', {
      name: 'edge-ip',
      label_selector: 'env=prod',
      page: 1,
      per_page: 25,
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/floating_ips',
      data: undefined,
      params: { name: 'edge-ip', label_selector: 'env=prod', page: 1, per_page: 25 },
    });
  });

  it('hetzner_get_floating_ip: GET /floating_ips/{id}', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_get_floating_ip', { id: 123 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/floating_ips/123',
      data: undefined,
      params: undefined,
    });
  });

  it('hetzner_create_floating_ip: POST /floating_ips with home_location body', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_create_floating_ip', {
      type: 'ipv4',
      home_location: 'fsn1',
      name: 'edge-ip',
      description: 'edge node ingress',
      labels: { env: 'prod' },
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/floating_ips',
      data: {
        type: 'ipv4',
        home_location: 'fsn1',
        name: 'edge-ip',
        description: 'edge node ingress',
        labels: { env: 'prod' },
      },
      params: undefined,
    });
  });

  it('hetzner_create_floating_ip: POST /floating_ips with server assignee body', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_create_floating_ip', {
      type: 'ipv6',
      server: 4711,
      name: 'edge-ip-v6',
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/floating_ips',
      data: { type: 'ipv6', server: 4711, name: 'edge-ip-v6' },
      params: undefined,
    });
  });

  it('hetzner_update_floating_ip: PUT /floating_ips/{id} strips id from body', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_update_floating_ip', {
      id: 123,
      name: 'renamed',
      description: 'updated desc',
      labels: { env: 'staging' },
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'PUT',
      url: '/floating_ips/123',
      data: { name: 'renamed', description: 'updated desc', labels: { env: 'staging' } },
      params: undefined,
    });
  });

  it('hetzner_delete_floating_ip: DELETE /floating_ips/{id}', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_delete_floating_ip', { id: 123 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'DELETE',
      url: '/floating_ips/123',
      data: undefined,
      params: undefined,
    });
  });

  it('hetzner_assign_floating_ip: POST /floating_ips/{id}/actions/assign with server body', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_assign_floating_ip', { id: 123, server: 4711 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/floating_ips/123/actions/assign',
      data: { server: 4711 },
      params: undefined,
    });
  });

  it('hetzner_unassign_floating_ip: POST /floating_ips/{id}/actions/unassign (no body)', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_unassign_floating_ip', { id: 123 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/floating_ips/123/actions/unassign',
      data: undefined,
      params: undefined,
    });
  });

  it('hetzner_change_floating_ip_rdns: POST /floating_ips/{id}/actions/change_dns_ptr with ip + dns_ptr', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_change_floating_ip_rdns', {
      id: 123,
      ip: '203.0.113.42',
      dns_ptr: 'edge.example.com',
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/floating_ips/123/actions/change_dns_ptr',
      data: { ip: '203.0.113.42', dns_ptr: 'edge.example.com' },
      params: undefined,
    });
  });

  it('hetzner_change_floating_ip_rdns: POST with dns_ptr=null resets the entry', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_change_floating_ip_rdns', {
      id: 123,
      ip: '203.0.113.42',
      dns_ptr: null,
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/floating_ips/123/actions/change_dns_ptr',
      data: { ip: '203.0.113.42', dns_ptr: null },
      params: undefined,
    });
  });
});
