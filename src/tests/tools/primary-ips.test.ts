import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Verifies path + method + body/params shape for CRUD + module-specific action
 * tools in the Primary IPs module. Sibling files cover cross-cutting surfaces:
 *   - `change-protection.test.ts` — hetzner_change_primary_ip_protection
 *   - `list-actions.test.ts`      — hetzner_list_primary_ip_actions
 */

let mockRequest: ReturnType<typeof vi.fn>;

async function loadFreshServer(): Promise<{ McpServerCls: typeof McpServer }> {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv('HETZNER_API_TOKEN', 'test-token');

  mockRequest = vi.fn().mockResolvedValue({ data: { primary_ip: { id: 1 } } });

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
  const { registerPrimaryIpTools } = await import('../../tools/primary-ips.js');
  const server = new McpServerCls({ name: 't', version: '0.0.0' });
  registerPrimaryIpTools(server);
  return server;
}

describe('Primary IPs tools — path, method, and body/params shape', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('hetzner_list_primary_ips: GET /primary_ips with filters + pagination', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_list_primary_ips', {
      name: 'web-ip',
      label_selector: 'env=prod',
      ip: '203.0.113.10',
      page: 1,
      per_page: 25,
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/primary_ips',
      data: undefined,
      params: {
        name: 'web-ip',
        label_selector: 'env=prod',
        ip: '203.0.113.10',
        page: 1,
        per_page: 25,
      },
    });
  });

  it('hetzner_get_primary_ip: GET /primary_ips/{id}', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_get_primary_ip', { id: 456 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/primary_ips/456',
      data: undefined,
      params: undefined,
    });
  });

  it('hetzner_create_primary_ip: POST /primary_ips with location body', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_create_primary_ip', {
      type: 'ipv4',
      assignee_type: 'server',
      name: 'web-ip',
      location: 'fsn1',
      auto_delete: true,
      labels: { env: 'prod' },
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/primary_ips',
      data: {
        type: 'ipv4',
        assignee_type: 'server',
        name: 'web-ip',
        location: 'fsn1',
        auto_delete: true,
        labels: { env: 'prod' },
      },
      params: undefined,
    });
  });

  it('hetzner_create_primary_ip: POST /primary_ips with assignee_id forwards create-and-assign body', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_create_primary_ip', {
      type: 'ipv4',
      name: 'web-ip',
      assignee_id: 4711,
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/primary_ips',
      data: {
        type: 'ipv4',
        name: 'web-ip',
        assignee_id: 4711,
      },
      params: undefined,
    });
  });

  it('hetzner_update_primary_ip: PUT /primary_ips/{id} strips id from body', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_update_primary_ip', {
      id: 456,
      name: 'renamed',
      auto_delete: false,
      labels: { env: 'staging' },
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'PUT',
      url: '/primary_ips/456',
      data: { name: 'renamed', auto_delete: false, labels: { env: 'staging' } },
      params: undefined,
    });
  });

  it('hetzner_delete_primary_ip: DELETE /primary_ips/{id}', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_delete_primary_ip', { id: 456 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'DELETE',
      url: '/primary_ips/456',
      data: undefined,
      params: undefined,
    });
  });

  it('hetzner_assign_primary_ip: POST /primary_ips/{id}/actions/assign with assignee body', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_assign_primary_ip', {
      id: 456,
      assignee_id: 4711,
      assignee_type: 'server',
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/primary_ips/456/actions/assign',
      data: { assignee_id: 4711, assignee_type: 'server' },
      params: undefined,
    });
  });

  it('hetzner_unassign_primary_ip: POST /primary_ips/{id}/actions/unassign (no body)', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_unassign_primary_ip', { id: 456 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/primary_ips/456/actions/unassign',
      data: undefined,
      params: undefined,
    });
  });

  it('hetzner_change_primary_ip_rdns: POST /primary_ips/{id}/actions/change_dns_ptr with ip + dns_ptr', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_change_primary_ip_rdns', {
      id: 456,
      ip: '203.0.113.10',
      dns_ptr: 'web.example.com',
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/primary_ips/456/actions/change_dns_ptr',
      data: { ip: '203.0.113.10', dns_ptr: 'web.example.com' },
      params: undefined,
    });
  });

  it('hetzner_change_primary_ip_rdns: POST with dns_ptr=null resets the entry', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_change_primary_ip_rdns', {
      id: 456,
      ip: '203.0.113.10',
      dns_ptr: null,
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/primary_ips/456/actions/change_dns_ptr',
      data: { ip: '203.0.113.10', dns_ptr: null },
      params: undefined,
    });
  });
});
