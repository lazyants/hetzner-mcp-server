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

function sentBody(): unknown {
  expect(mockRequest).toHaveBeenCalledTimes(1);
  return mockRequest.mock.calls[0][0].data;
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
    expect(sentBody()).toStrictEqual({ name: 'data-vol', size: 50, location: 'fsn1', format: 'ext4', labels: { env: 'prod' } });
  });

  it('hetzner_create_volume: POST /volumes with assignee placement + automount', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_create_volume', {
      name: 'attached-vol',
      size: 20,
      assignee: { id: 4711, type: 'server' },
      automount: true,
    });
    expect(sentBody()).toStrictEqual({ name: 'attached-vol', size: 20, automount: true, assignee: { id: 4711, type: 'server' } });
    expect(mockRequest.mock.calls[0][0]).toMatchObject({ method: 'POST', url: '/volumes' });
  });

  it('hetzner_create_volume: translates the legacy server input into assignee', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_create_volume', {
      name: 'attached-vol',
      size: 20,
      server: 4711,
      automount: true,
    });
    expect(sentBody()).toStrictEqual({ name: 'attached-vol', size: 20, automount: true, assignee: { id: 4711, type: 'server' } });
  });

  it('hetzner_create_volume: rejects assignee combined with server before I/O', async () => {
    const server = await setupServer();
    const result = await callTool(server, 'hetzner_create_volume', {
      name: 'attached-vol',
      size: 20,
      server: 4711,
      assignee: { id: 4712, type: 'server' },
    });
    expect(result).toMatchObject({ isError: true, content: [{ type: 'text', text: 'Error: Provide either assignee or server, not both' }] });
    expect(mockRequest).not.toHaveBeenCalled();
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

  it('hetzner_attach_volume: POST /volumes/{id}/actions/attach sends assignee and strips id', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_attach_volume', { id: 11, assignee: { id: 4711, type: 'server' }, automount: true });
    expect(mockRequest.mock.calls[0][0]).toMatchObject({ method: 'POST', url: '/volumes/11/actions/attach', params: undefined });
    expect(sentBody()).toStrictEqual({ automount: true, assignee: { id: 4711, type: 'server' } });
  });

  it('hetzner_attach_volume: translates the legacy server input into assignee', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_attach_volume', { id: 11, server: 4711 });
    expect(sentBody()).toStrictEqual({ assignee: { id: 4711, type: 'server' } });
  });

  it.each([
    [{ id: 11, server: 4711, assignee: { id: 4712, type: 'server' } }, 'Error: Provide either assignee or server, not both'],
    [{ id: 11, automount: true }, 'Error: Provide assignee (or the deprecated server) to attach the volume to'],
  ])('hetzner_attach_volume: rejects a conflicting or missing target before I/O (%j)', async (args, message) => {
    const server = await setupServer();
    const result = await callTool(server, 'hetzner_attach_volume', args);
    expect(result).toMatchObject({ isError: true, content: [{ type: 'text', text: message }] });
    expect(mockRequest).not.toHaveBeenCalled();
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

describe('Volumes tools — assignee contract through MCP', () => {
  const attachedVolume = { id: 11, name: 'data-vol', server: 4711, assignee: { id: 4711, type: 'server' } };

  async function connect(split: 'full' | 'storage') {
    const { McpServerCls } = await loadFreshServer();
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');
    const { ALL_REGISTRARS, SPLITS } = await import('../../splits.js');
    const server = new McpServerCls({ name: 'test', version: '0.0.0' });
    for (const register of split === 'full' ? ALL_REGISTRARS : SPLITS.storage.registrars) register(server);
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    return { client, close: async () => { await client.close(); await server.close(); } };
  }

  it.each(['full', 'storage'] as const)('advertises and validates the assignee object in the %s registration', async (split) => {
    const { client, close } = await connect(split);
    try {
      const tools = (await client.listTools()).tools;
      const create = tools.find((entry) => entry.name === 'hetzner_create_volume')!.inputSchema;
      const attach = tools.find((entry) => entry.name === 'hetzner_attach_volume')!.inputSchema;
      expect(create.required).toEqual(['name', 'size']);
      expect(attach.required).toEqual(['id']);
      for (const schema of [create, attach]) {
        const assignee = schema.properties!.assignee as { required: string[]; properties: Record<string, { const?: string; type?: string }> };
        expect(assignee.required).toEqual(['id', 'type']);
        expect(assignee.properties.id.type).toBe('integer');
        expect(assignee.properties.type.const).toBe('server');
      }

      const attached = await client.callTool({ name: 'hetzner_attach_volume', arguments: { id: 11, assignee: { id: 4711, type: 'server' } } });
      expect(attached.isError).toBeFalsy();
      expect(sentBody()).toStrictEqual({ assignee: { id: 4711, type: 'server' } });

      mockRequest.mockClear();
      for (const args of [
        { id: 11, assignee: { id: 4711, type: 'load_balancer' } },
        { id: 11, assignee: { id: 4711 } },
        { id: 11 },
        { id: 11, server: 4711, assignee: { id: 4711, type: 'server' } },
      ]) {
        const rejected = await client.callTool({ name: 'hetzner_attach_volume', arguments: args });
        expect(rejected.isError).toBe(true);
      }
      expect(mockRequest).not.toHaveBeenCalled();
    } finally {
      await close();
    }
  });

  it.each([
    ['hetzner_get_volume', { id: 11 }, { volume: attachedVolume }],
    ['hetzner_list_volumes', {}, { volumes: [attachedVolume, { id: 12, name: 'free-vol', server: null, assignee: null }] }],
  ])('%s returns both assignee and the transitional server field unchanged', async (name, args, payload) => {
    const { client, close } = await connect('storage');
    try {
      mockRequest.mockResolvedValue({ data: payload });
      const result = await client.callTool({ name, arguments: args });
      expect(result.structuredContent).toEqual(payload);
    } finally {
      await close();
    }
  });
});
