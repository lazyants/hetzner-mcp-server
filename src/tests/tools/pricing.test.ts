import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Verifies hetzner_get_pricing issues GET /pricing with no body and no query
 * params, mirroring the axios-mock path tests for the other Wave-2 tools.
 */
let mockRequest: ReturnType<typeof vi.fn>;

async function loadFreshServer(): Promise<{ McpServerCls: typeof McpServer }> {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv('HETZNER_API_TOKEN', 'test-token');

  mockRequest = vi.fn().mockResolvedValue({ data: { pricing: { currency: 'EUR' } } });

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

describe('Pricing tool — path, method, and body shape', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('hetzner_get_pricing: GET /pricing with no body and no params', async () => {
    const { McpServerCls } = await loadFreshServer();
    const { registerPricingTools } = await import('../../tools/pricing.js');
    const server = new McpServerCls({ name: 't', version: '0.0.0' });
    registerPricingTools(server);

    await callTool(server, 'hetzner_get_pricing', {});

    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/pricing',
      data: undefined,
      params: undefined,
    });
  });
});
