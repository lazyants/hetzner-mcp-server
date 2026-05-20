import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Verifies path + method + body/params shape for CRUD + create-from-server
 * tools in the Images module. Sibling files cover related action surfaces:
 *   - `change-protection.test.ts` — hetzner_change_image_protection
 *   - `list-actions.test.ts`      — hetzner_list_image_actions
 */

let mockRequest: ReturnType<typeof vi.fn>;

async function loadFreshServer(): Promise<{ McpServerCls: typeof McpServer }> {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv('HETZNER_API_TOKEN', 'test-token');

  mockRequest = vi.fn().mockResolvedValue({ data: { image: { id: 1 } } });

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
  const { registerImageTools } = await import('../../tools/images.js');
  const server = new McpServerCls({ name: 't', version: '0.0.0' });
  registerImageTools(server);
  return server;
}

describe('Images tools — path, method, and body/params shape', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('hetzner_list_images: GET /images with filters + sort + pagination', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_list_images', {
      type: 'snapshot',
      status: 'available',
      architecture: 'x86',
      name: 'web-server-snap',
      label_selector: 'env=prod',
      sort: 'created:desc',
      page: 1,
      per_page: 25,
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/images',
      data: undefined,
      params: {
        type: 'snapshot',
        status: 'available',
        architecture: 'x86',
        name: 'web-server-snap',
        label_selector: 'env=prod',
        sort: 'created:desc',
        page: 1,
        per_page: 25,
      },
    });
  });

  it('hetzner_get_image: GET /images/{id}', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_get_image', { id: 789 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/images/789',
      data: undefined,
      params: undefined,
    });
  });

  it('hetzner_update_image: PUT /images/{id} strips id from body', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_update_image', {
      id: 789,
      description: 'updated description',
      type: 'snapshot',
      labels: { env: 'prod' },
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'PUT',
      url: '/images/789',
      data: { description: 'updated description', type: 'snapshot', labels: { env: 'prod' } },
      params: undefined,
    });
  });

  it('hetzner_delete_image: DELETE /images/{id}', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_delete_image', { id: 789 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'DELETE',
      url: '/images/789',
      data: undefined,
      params: undefined,
    });
  });

  it('hetzner_create_image: POST /servers/{server_id}/actions/create_image strips server_id', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_create_image', {
      server_id: 4711,
      type: 'snapshot',
      description: 'nightly snapshot',
      labels: { env: 'prod' },
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/servers/4711/actions/create_image',
      data: { type: 'snapshot', description: 'nightly snapshot', labels: { env: 'prod' } },
      params: undefined,
    });
  });
});
