import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Verifies path + method + body/params shape for CRUD tools in the Placement
 * Groups module. Placement groups have no protection or action surfaces, so
 * this file is the complete coverage for `src/tools/placement-groups.ts`.
 */

let mockRequest: ReturnType<typeof vi.fn>;

async function loadFreshServer(): Promise<{ McpServerCls: typeof McpServer }> {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv('HETZNER_API_TOKEN', 'test-token');

  mockRequest = vi.fn().mockResolvedValue({ data: { placement_group: { id: 1 } } });

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
  const { registerPlacementGroupTools } = await import('../../tools/placement-groups.js');
  const server = new McpServerCls({ name: 't', version: '0.0.0' });
  registerPlacementGroupTools(server);
  return server;
}

describe('Placement Groups tools — path, method, and body/params shape', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('hetzner_list_placement_groups: GET /placement_groups with name + label_selector + pagination', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_list_placement_groups', {
      name: 'web-cluster',
      label_selector: 'tier=web',
      page: 1,
      per_page: 25,
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/placement_groups',
      data: undefined,
      params: { name: 'web-cluster', label_selector: 'tier=web', page: 1, per_page: 25 },
    });
  });

  it('hetzner_get_placement_group: GET /placement_groups/{id}', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_get_placement_group', { id: 7 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/placement_groups/7',
      data: undefined,
      params: undefined,
    });
  });

  it('hetzner_create_placement_group: POST /placement_groups with name + type + labels', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_create_placement_group', {
      name: 'web-cluster',
      type: 'spread',
      labels: { tier: 'web' },
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/placement_groups',
      data: { name: 'web-cluster', type: 'spread', labels: { tier: 'web' } },
      params: undefined,
    });
  });

  it('hetzner_update_placement_group: PUT /placement_groups/{id} strips id from body', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_update_placement_group', {
      id: 7,
      name: 'renamed',
      labels: { tier: 'api' },
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'PUT',
      url: '/placement_groups/7',
      data: { name: 'renamed', labels: { tier: 'api' } },
      params: undefined,
    });
  });

  it('hetzner_delete_placement_group: DELETE /placement_groups/{id}', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_delete_placement_group', { id: 7 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'DELETE',
      url: '/placement_groups/7',
      data: undefined,
      params: undefined,
    });
  });
});
