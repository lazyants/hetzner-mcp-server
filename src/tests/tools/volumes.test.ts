import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Verifies path + method + body/params shape for CRUD + module-specific action
 * tools in the Volumes module. Sibling files cover related action surfaces:
 *   - `change-protection.test.ts` — hetzner_change_volume_protection
 *   - `list-actions.test.ts`      — hetzner_list_volume_actions
 */

let mockRequest: ReturnType<typeof vi.fn>;

async function loadFreshServer(): Promise<{ McpServerCls: typeof McpServer }> {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv('HETZNER_API_TOKEN', 'test-token');

  mockRequest = vi.fn().mockResolvedValue({ data: { volume: { id: 1 } } });

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
  const { registerVolumeTools } = await import('../../tools/volumes.js');
  const server = new McpServerCls({ name: 't', version: '0.0.0' });
  registerVolumeTools(server);
  return server;
}

describe('Volumes tools — path, method, and body/params shape', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('hetzner_list_volumes: GET /volumes with filters + pagination', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_list_volumes', {
      name: 'data-vol',
      label_selector: 'env=prod',
      status: 'available',
      page: 2,
      per_page: 25,
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/volumes',
      data: undefined,
      params: { name: 'data-vol', label_selector: 'env=prod', status: 'available', page: 2, per_page: 25 },
    });
  });

  it('hetzner_get_volume: GET /volumes/{id}', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_get_volume', { id: 11 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/volumes/11',
      data: undefined,
      params: undefined,
    });
  });

  it('hetzner_create_volume: POST /volumes with location placement', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_create_volume', {
      name: 'data-vol',
      size: 50,
      location: 'fsn1',
      format: 'ext4',
      labels: { env: 'prod' },
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/volumes',
      data: { name: 'data-vol', size: 50, location: 'fsn1', format: 'ext4', labels: { env: 'prod' } },
      params: undefined,
    });
  });

  it('hetzner_create_volume: POST /volumes with server placement + automount', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_create_volume', {
      name: 'attached-vol',
      size: 20,
      server: 4711,
      automount: true,
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/volumes',
      data: { name: 'attached-vol', size: 20, server: 4711, automount: true },
      params: undefined,
    });
  });

  it('hetzner_update_volume: PUT /volumes/{id} strips id from body', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_update_volume', {
      id: 11,
      name: 'renamed-vol',
      labels: { env: 'staging' },
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'PUT',
      url: '/volumes/11',
      data: { name: 'renamed-vol', labels: { env: 'staging' } },
      params: undefined,
    });
  });

  it('hetzner_delete_volume: DELETE /volumes/{id}', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_delete_volume', { id: 11 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'DELETE',
      url: '/volumes/11',
      data: undefined,
      params: undefined,
    });
  });

  it('hetzner_attach_volume: POST /volumes/{id}/actions/attach strips id', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_attach_volume', { id: 11, server: 4711, automount: true });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/volumes/11/actions/attach',
      data: { server: 4711, automount: true },
      params: undefined,
    });
  });

  it('hetzner_detach_volume: POST /volumes/{id}/actions/detach with no body', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_detach_volume', { id: 11 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/volumes/11/actions/detach',
      data: undefined,
      params: undefined,
    });
  });

  it('hetzner_resize_volume: POST /volumes/{id}/actions/resize strips id', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_resize_volume', { id: 11, size: 100 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/volumes/11/actions/resize',
      data: { size: 100 },
      params: undefined,
    });
  });
});
