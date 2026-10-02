import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

let mockRequest: ReturnType<typeof vi.fn>;
let serializedUrl: string;

const response = {
  members: [
    { type: 'server', id: 1, ip: '10.0.1.2', alias_ips: ['10.0.1.3'], subnet: '10.0.1.0/24', status: 'error' },
    { type: 'load_balancer', id: 2, ip: '10.0.2.2', alias_ips: [], subnet: '10.0.2.0/24', status: 'attaching' },
    { type: 'server', id: 3, ip: '10.0.2.3', alias_ips: [], subnet: '10.0.2.0/24', status: 'detaching' },
    { type: 'server', id: 4, ip: '10.0.2.4', alias_ips: [], subnet: '10.0.2.0/24', status: 'updating' },
  ],
  meta: { pagination: { page: 2, per_page: 25, previous_page: 1, next_page: 3, last_page: 4, total_entries: 100 } },
};

async function setup() {
  vi.resetModules();
  vi.stubEnv('HETZNER_API_TOKEN', 'test-token');
  mockRequest = vi.fn().mockResolvedValue({ data: response });
  vi.doMock('axios', async (importOriginal) => {
    const actual = await importOriginal<typeof import('axios')>();
    return {
      ...actual,
      default: {
        ...actual.default,
        create: () => ({ interceptors: { response: { use: vi.fn() } }, request: mockRequest }),
      },
    };
  });
  const { McpServer: Server } = await import('@modelcontextprotocol/sdk/server/mcp.js');
  const { registerNetworkTools } = await import('../../tools/networks.js');
  const server = new Server({ name: 'test', version: '0.0.0' });
  registerNetworkTools(server);
  return server;
}

function tool(server: McpServer) {
  return (server as unknown as { _registeredTools: Record<string, {
    handler: (args: Record<string, unknown>) => Promise<CallToolResult>;
  }> })._registeredTools.hetzner_list_network_members;
}

describe('Network members', () => {
  beforeEach(() => vi.unstubAllEnvs());

  it('forwards repeated filters and pagination without placing the ID in the query', async () => {
    const server = await setup();
    const params = {
      type: ['server', 'load_balancer'], subnet: ['10.0.1.0/24', '10.0.2.0/24'],
      status: ['error', 'attaching'], sort: ['id:asc', 'status:desc'], page: 2, per_page: 25,
    };
    const result = await tool(server).handler({ id: 42, ...params });
    expect(mockRequest).toHaveBeenCalledWith({ method: 'GET', url: '/networks/42/members', data: undefined, params });
    expect(result).toEqual({ content: [{ type: 'text', text: JSON.stringify(response, null, 2) }], structuredContent: response });
  });

  it('accepts scalar filters and an ID-only call', async () => {
    const server = await setup();
    await tool(server).handler({ id: 42, type: 'server', subnet: '10.0.1.0/24', status: 'ok', sort: 'ip:asc' });
    expect(mockRequest).toHaveBeenLastCalledWith({
      method: 'GET', url: '/networks/42/members', data: undefined,
      params: { type: 'server', subnet: '10.0.1.0/24', status: 'ok', sort: 'ip:asc' },
    });
    await tool(server).handler({ id: 42 });
    expect(mockRequest).toHaveBeenLastCalledWith({ method: 'GET', url: '/networks/42/members', data: undefined, params: {} });
  });

  it.each(['full', 'networking'])('exposes required ID, filters, and read-only annotations through %s MCP discovery', async (split) => {
    await setup();
    const { McpServer: Server } = await import('@modelcontextprotocol/sdk/server/mcp.js');
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');
    const { ALL_REGISTRARS, SPLITS } = await import('../../splits.js');
    const server = new Server({ name: 'test', version: '0.0.0' });
    for (const register of split === 'full' ? ALL_REGISTRARS : SPLITS.networking.registrars) register(server);
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    try {
      const listed = (await client.listTools()).tools.find((entry) => entry.name === 'hetzner_list_network_members');
      expect(listed?.inputSchema.required).toEqual(['id']);
      expect(Object.keys(listed!.inputSchema.properties!)).toEqual(['id', 'type', 'subnet', 'status', 'sort', 'page', 'per_page']);
      expect(listed?.annotations).toEqual({ readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true });
      const invalid = await client.callTool({ name: 'hetzner_list_network_members', arguments: {} });
      expect(invalid.isError).toBe(true);
      expect(mockRequest).not.toHaveBeenCalled();
      const invalidStatus = await client.callTool({ name: 'hetzner_list_network_members', arguments: { id: 42, status: 'success' } });
      expect(invalidStatus.isError).toBe(true);
      const result = await client.callTool({ name: 'hetzner_list_network_members', arguments: { id: 42, status: ['error', 'updating'] } });
      expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(response, null, 2) }]);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it('serializes arrays as repeated query keys using the real axios client', async () => {
    vi.resetModules();
    vi.stubEnv('HETZNER_API_TOKEN', 'test-token');
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
              return { data: response, status: 200, statusText: 'OK', headers: {}, config };
            },
          }),
        },
      };
    });
    const { McpServer: Server } = await import('@modelcontextprotocol/sdk/server/mcp.js');
    const { registerNetworkTools } = await import('../../tools/networks.js');
    const server = new Server({ name: 'test', version: '0.0.0' });
    registerNetworkTools(server);
    await tool(server).handler({ id: 42, type: ['server', 'load_balancer'], subnet: ['10.0.1.0/24', '10.0.2.0/24'], status: ['error', 'attaching'], sort: ['id:asc', 'ip:desc'] });
    const url = new URL(serializedUrl);
    expect(url.pathname).toBe('/v1/networks/42/members');
    expect(url.searchParams.getAll('type')).toEqual(['server', 'load_balancer']);
    expect(url.searchParams.getAll('subnet')).toEqual(['10.0.1.0/24', '10.0.2.0/24']);
    expect(url.searchParams.getAll('status')).toEqual(['error', 'attaching']);
    expect(url.searchParams.getAll('sort')).toEqual(['id:asc', 'ip:desc']);
    expect([...url.searchParams.keys()]).not.toContain('id');
    expect(serializedUrl).not.toContain('[]');
  });
});
