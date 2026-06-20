import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Verifies path + method + params shape for the read-only reference-data tools
 * in `src/tools/datacenters.ts` (datacenters, locations, server types). All
 * tools are GET-only — no CRUD, no protection, no action surfaces — so this
 * file is the complete coverage for the module.
 */

let mockRequest: ReturnType<typeof vi.fn>;

async function loadFreshServer(): Promise<{ McpServerCls: typeof McpServer }> {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv('HETZNER_API_TOKEN', 'test-token');

  mockRequest = vi.fn().mockResolvedValue({ data: { datacenter: { id: 1 } } });

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
  const { registerDatacenterTools } = await import('../../tools/datacenters.js');
  const server = new McpServerCls({ name: 't', version: '0.0.0' });
  registerDatacenterTools(server);
  return server;
}

describe('Datacenters / Locations / Server Types tools — path, method, and params shape', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('hetzner_list_datacenters: GET /datacenters with name + pagination', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_list_datacenters', {
      name: 'fsn1-dc14',
      page: 1,
      per_page: 25,
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/datacenters',
      data: undefined,
      params: { name: 'fsn1-dc14', page: 1, per_page: 25 },
    });
  });

  it('hetzner_get_datacenter: GET /datacenters/{id}', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_get_datacenter', { id: 4 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/datacenters/4',
      data: undefined,
      params: undefined,
    });
  });

  it('hetzner_list_locations: GET /locations with name + pagination', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_list_locations', {
      name: 'fsn1',
      page: 1,
      per_page: 25,
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/locations',
      data: undefined,
      params: { name: 'fsn1', page: 1, per_page: 25 },
    });
  });

  it('hetzner_get_location: GET /locations/{id}', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_get_location', { id: 1 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/locations/1',
      data: undefined,
      params: undefined,
    });
  });

  it('hetzner_list_server_types: GET /server_types with name + pagination', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_list_server_types', {
      name: 'cx22',
      page: 1,
      per_page: 25,
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/server_types',
      data: undefined,
      params: { name: 'cx22', page: 1, per_page: 25 },
    });
  });

  it('hetzner_get_server_type: GET /server_types/{id}', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_get_server_type', { id: 22 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/server_types/22',
      data: undefined,
      params: undefined,
    });
  });
});

/**
 * Hetzner deprecated /datacenters on 2026-06-02; the endpoints return HTTP 410
 * after 2026-10-01. We deprecate the two tools in place (still functional until
 * then) and surface the removal date + replacement guidance in their
 * descriptions. This test makes the follow-up removal discoverable and locks the
 * deprecation notice so it cannot be silently dropped before the cutover.
 */
interface ToolWithMeta {
  description?: string;
}

function toolMeta(server: McpServer, name: string): ToolWithMeta {
  const registry = (server as unknown as { _registeredTools: Record<string, ToolWithMeta> })._registeredTools;
  const entry = registry[name];
  if (!entry) throw new Error(`Tool not registered: ${name}`);
  return entry;
}

describe('Datacenters deprecation notice (removed after 2026-10-01)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('list/get datacenter descriptions flag deprecation, the 2026-10-01 removal, and the replacements', async () => {
    const server = await setupServer();
    for (const name of ['hetzner_list_datacenters', 'hetzner_get_datacenter']) {
      const desc = toolMeta(server, name).description ?? '';
      expect(desc, name).toMatch(/deprecated/i);
      expect(desc, name).toContain('2026-10-01');
      expect(desc, name).toContain('hetzner_list_server_types');
      expect(desc, name).toContain('hetzner_list_locations');
    }
  });
});
