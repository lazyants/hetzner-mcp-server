import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Verifies path + method + body/params shape for the ISOs module. Note that
 * `hetzner_attach_iso` and `hetzner_detach_iso` target server-action paths
 * (`/servers/{id}/actions/...`) but are owned by `src/tools/isos.ts`, so they
 * are tested here rather than in `server-actions.test.ts`.
 */

let mockRequest: ReturnType<typeof vi.fn>;

async function loadFreshServer(): Promise<{ McpServerCls: typeof McpServer }> {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv('HETZNER_API_TOKEN', 'test-token');

  mockRequest = vi.fn().mockResolvedValue({ data: { iso: { id: 1 } } });

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
  const { registerIsoTools } = await import('../../tools/isos.js');
  const server = new McpServerCls({ name: 't', version: '0.0.0' });
  registerIsoTools(server);
  return server;
}

describe('ISOs tools — path, method, and body/params shape', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('hetzner_list_isos: GET /isos with name + architecture + pagination', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_list_isos', {
      name: 'ubuntu-22.04',
      architecture: 'x86',
      page: 1,
      per_page: 25,
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/isos',
      data: undefined,
      params: { name: 'ubuntu-22.04', architecture: 'x86', page: 1, per_page: 25 },
    });
  });

  it('hetzner_get_iso: GET /isos/{id}', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_get_iso', { id: 4711 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/isos/4711',
      data: undefined,
      params: undefined,
    });
  });

  it('hetzner_attach_iso: POST /servers/{server_id}/actions/attach_iso with iso body (server_id stripped)', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_attach_iso', {
      server_id: 42,
      iso: 'ubuntu-22.04',
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/servers/42/actions/attach_iso',
      data: { iso: 'ubuntu-22.04' },
      params: undefined,
    });
  });

  it('hetzner_detach_iso: POST /servers/{server_id}/actions/detach_iso with no body', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_detach_iso', { server_id: 42 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/servers/42/actions/detach_iso',
      data: undefined,
      params: undefined,
    });
  });
});
