import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

const DOMAINS = [
  'servers', 'load_balancers', 'volumes', 'networks', 'firewalls', 'floating_ips',
  'primary_ips', 'certificates', 'images', 'zones', 'storage_boxes',
];
const terminal = { id: 7, status: 'success', progress: 100, command: 'create_server', error: null, resources: [{ id: 42, type: 'server' }] };

type RequestConfig = { url: string; baseURL?: string; params?: { page: number }; signal?: AbortSignal };
type Reply = (config: RequestConfig) => Promise<{ data: unknown }>;
let requests: ReturnType<typeof vi.fn<Reply>>;

async function setup(reply: Reply = async () => ({ data: { actions: [terminal] } })) {
  vi.resetModules();
  vi.stubEnv('HETZNER_API_TOKEN', 'cloud-token');
  vi.stubEnv('HETZNER_STORAGE_API_TOKEN', 'storage-token');
  requests = vi.fn(reply);
  vi.doMock('axios', async (importOriginal) => {
    const actual = await importOriginal<typeof import('axios')>();
    return {
      ...actual,
      default: {
        ...actual.default,
        create: (options: { baseURL: string }) => ({
          interceptors: { response: { use: vi.fn() } },
          request: (config: RequestConfig) => requests({ ...config, baseURL: options.baseURL }),
        }),
      },
    };
  });
  const { McpServer: Server } = await import('@modelcontextprotocol/sdk/server/mcp.js');
  const { registerActionTools } = await import('../../tools/actions.js');
  const server = new Server({ name: 'test', version: '0.0.0' });
  registerActionTools(server);
  const tool = (server as unknown as { _registeredTools: Record<string, {
    inputSchema: { parse: (args: Record<string, unknown>) => Record<string, unknown> };
    handler: (args: Record<string, unknown>, extra?: { signal: AbortSignal }) => Promise<CallToolResult>;
  }> })._registeredTools.hetzner_wait_for_action;
  return { server, call: (args: Record<string, unknown> = {}, signal?: AbortSignal) => tool.handler(tool.inputSchema.parse({ domain: 'servers', resource_id: 42, action_id: 7, timeout: 10, ...args }), signal ? { signal } : undefined) };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.unstubAllEnvs();
  // Vitest's isolated workers do not replace node:timers/promises with fake clocks.
  // Keep the standard abortable-sleep contract while scheduling on the fake clock.
  vi.doMock('node:timers/promises', () => ({
    setTimeout: (delay: number, value: unknown, options?: { signal?: AbortSignal }) => new Promise((resolve, reject) => {
      const signal = options?.signal;
      const abort = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        reject(signal?.reason);
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', abort);
        resolve(value);
      }, delay);
      if (signal?.aborted) abort();
      else signal?.addEventListener('abort', abort, { once: true });
    }),
  }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.doUnmock('node:timers/promises');
});

describe('wait_for_action polling', () => {
  it.each(DOMAINS)('returns the full terminal action for %s using its own API host', async (domain) => {
    const { call } = await setup();
    const result = await call({ domain });
    expect(result.structuredContent).toEqual(terminal);
    expect(result.isError).toBeUndefined();
    expect(requests).toHaveBeenCalledOnce();
    expect(requests).toHaveBeenCalledWith({
      method: 'GET', url: `/${domain}/42/actions`, data: undefined,
      params: { page: 1, per_page: 50, sort: 'id:desc' }, signal: expect.any(AbortSignal),
      baseURL: domain === 'storage_boxes' ? 'https://api.hetzner.com/v1' : 'https://api.hetzner.cloud/v1',
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('searches older pages before waiting and returns terminal error details unchanged', async () => {
    const action = { ...terminal, status: 'error', error: { code: 'action_failed', message: 'attachment failed' } };
    const { call } = await setup(async (config) => ({ data: config.params?.page === 1
      ? { actions: [{ ...terminal, id: 999 }], meta: { pagination: { next_page: 2 } } }
      : { actions: [action], meta: { pagination: { next_page: null } } } }));
    const result = await call();
    expect(result.structuredContent).toEqual(action);
    expect(result.isError).toBeUndefined();
    expect(requests.mock.calls.map(([config]) => config.params!.page)).toEqual([1, 2]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('polls a running action until success', async () => {
    let polls = 0;
    const { call } = await setup(async () => ({ data: { actions: [++polls < 3 ? { ...terminal, status: 'running' } : terminal] } }));
    const result = call();
    await vi.advanceTimersByTimeAsync(2000);
    expect((await result).structuredContent).toEqual(terminal);
    expect(requests).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['missing', 'unknown'])('keeps %s actions pending until the bounded timeout', async (state) => {
    const { call } = await setup(async () => ({ data: { actions: state === 'missing' ? [] : [{ ...terminal, status: 'queued' }] } }));
    const result = call({ timeout: 2.5 });
    await vi.advanceTimersByTimeAsync(2500);
    expect(await result).toMatchObject({ isError: true, content: [{ type: 'text', text: 'Error: Timed out waiting for action 7 after 2.5 seconds' }] });
    expect(requests).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(5000);
    expect(requests).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels during a polling delay and removes its caller listener', async () => {
    const cancellation = new AbortController();
    const remove = vi.spyOn(cancellation.signal, 'removeEventListener');
    const { call } = await setup(async () => ({ data: { actions: [{ ...terminal, status: 'running' }] } }));
    const result = call({}, cancellation.signal);
    await vi.advanceTimersByTimeAsync(0);
    cancellation.abort();
    expect(await result).toMatchObject({ isError: true, content: [{ text: 'Error: Action wait cancelled' }] });
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    await vi.advanceTimersByTimeAsync(10000);
    expect(requests).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not request anything for an already-cancelled call', async () => {
    const cancellation = new AbortController();
    cancellation.abort();
    const { call } = await setup();
    expect(await call({}, cancellation.signal)).toMatchObject({ isError: true });
    expect(requests).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('bounds a pending request and stops polling after its deadline', async () => {
    const { call } = await setup((config) => new Promise((_resolve, reject) => {
      config.signal!.addEventListener('abort', () => reject(new Error('request cancelled')), { once: true });
    }));
    const result = call({ timeout: 2 });
    await vi.advanceTimersByTimeAsync(2000);
    expect(await result).toMatchObject({ isError: true, content: [{ text: 'Error: Timed out waiting for action 7 after 2 seconds' }] });
    expect(requests).toHaveBeenCalledOnce();
    expect(requests.mock.calls[0][0].signal!.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('bounds a long 429 Retry-After delay through the actual HTTP client', async () => {
    // Exercise native timers/promises abort behavior here; the deadline remains fake.
    vi.doUnmock('node:timers/promises');
    vi.resetModules();
    vi.stubEnv('HETZNER_API_TOKEN', 'test-token');
    const attempts = vi.fn();
    vi.doMock('axios', async (importOriginal) => {
      const actual = await importOriginal<typeof import('axios')>();
      return {
        ...actual,
        default: {
          ...actual.default,
          create: (options: Parameters<typeof actual.default.create>[0]) => actual.default.create({
            ...options,
            adapter: async (config) => {
              attempts();
              throw new actual.AxiosError('rate limited', 'ERR_BAD_RESPONSE', config, undefined, {
                status: 429, statusText: 'Too Many Requests', data: {}, headers: { 'retry-after': '3600' }, config,
              });
            },
          }),
        },
      };
    });
    const { McpServer: Server } = await import('@modelcontextprotocol/sdk/server/mcp.js');
    const { registerActionTools } = await import('../../tools/actions.js');
    const server = new Server({ name: 'test', version: '0.0.0' });
    registerActionTools(server);
    const handler = (server as unknown as { _registeredTools: Record<string, {
      handler: (args: Record<string, unknown>) => Promise<CallToolResult>;
    }> })._registeredTools.hetzner_wait_for_action.handler;
    const result = handler({ domain: 'servers', resource_id: 42, action_id: 7, timeout: 2 });
    await vi.advanceTimersByTimeAsync(2000);
    expect(await result).toMatchObject({ isError: true, content: [{ text: 'Error: Timed out waiting for action 7 after 2 seconds' }] });
    await vi.advanceTimersByTimeAsync(3_600_000);
    expect(attempts).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('aborts a real hanging HTTP request when the deadline expires', async () => {
    vi.resetModules();
    vi.stubEnv('HETZNER_API_TOKEN', 'test-token');
    const { createServer } = await import('node:http');
    let seen: () => void = () => {};
    const requestSeen = new Promise<void>((resolve) => { seen = resolve; });
    const http = createServer(() => seen()); // Leave the response pending.
    await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
    const address = http.address();
    if (!address || typeof address === 'string') throw new Error('Expected a TCP listener');
    const baseURL = `http://127.0.0.1:${address.port}`;
    vi.doMock('axios', async (importOriginal) => {
      const actual = await importOriginal<typeof import('axios')>();
      return {
        ...actual,
        default: { ...actual.default, create: (options: Parameters<typeof actual.default.create>[0]) => actual.default.create({ ...options, baseURL }) },
      };
    });
    const { McpServer: Server } = await import('@modelcontextprotocol/sdk/server/mcp.js');
    const { registerActionTools } = await import('../../tools/actions.js');
    const server = new Server({ name: 'test', version: '0.0.0' });
    registerActionTools(server);
    const handler = (server as unknown as { _registeredTools: Record<string, {
      handler: (args: Record<string, unknown>) => Promise<CallToolResult>;
    }> })._registeredTools.hetzner_wait_for_action.handler;
    try {
      const result = handler({ domain: 'servers', resource_id: 42, action_id: 7, timeout: 2 });
      await requestSeen;
      await vi.advanceTimersByTimeAsync(2000);
      expect(await result).toMatchObject({ isError: true, content: [{ text: 'Error: Timed out waiting for action 7 after 2 seconds' }] });
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      http.closeAllConnections();
      await new Promise<void>((resolve, reject) => http.close((error) => error ? reject(error) : resolve()));
    }
  });
});

describe('wait_for_action discovery and cancellation', () => {
  it('is registered once in the full server and exposed with its schema in every split', async () => {
    await setup();
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');
    const { McpServer: Server } = await import('@modelcontextprotocol/sdk/server/mcp.js');
    const { ALL_REGISTRARS, SPLITS, TOTAL_TOOL_COUNT } = await import('../../splits.js');
    expect(new Set(ALL_REGISTRARS).size).toBe(ALL_REGISTRARS.length);
    for (const [name, registrars, count] of [
      ['full', ALL_REGISTRARS, TOTAL_TOOL_COUNT],
      ...Object.entries(SPLITS).map(([name, split]) => [name, split.registrars, split.toolCount]),
    ] as Array<[string, typeof ALL_REGISTRARS, number]>) {
      const server = new Server({ name, version: '0.0.0' });
      for (const register of registrars) register(server);
      const client = new Client({ name: 'test-client', version: '0.0.0' });
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
      await server.connect(serverTransport);
      await client.connect(clientTransport);
      try {
        const tools = (await client.listTools()).tools;
        expect(tools).toHaveLength(count);
        const waiting = tools.filter((tool) => tool.name === 'hetzner_wait_for_action');
        expect(waiting).toHaveLength(1);
        expect(waiting[0].inputSchema.required).toEqual(['domain', 'resource_id', 'action_id']);
        expect(waiting[0].inputSchema.properties?.domain).toMatchObject({ enum: DOMAINS });
        expect(waiting[0].annotations).toEqual({ readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true });
        const invalid = await client.callTool({ name: 'hetzner_wait_for_action', arguments: { domain: 'unknown', resource_id: 42, action_id: 7 } });
        expect(invalid.isError).toBe(true);
        const invalidTimeout = await client.callTool({ name: 'hetzner_wait_for_action', arguments: { domain: 'servers', resource_id: 42, action_id: 7, timeout: 3601 } });
        expect(invalidTimeout.isError).toBe(true);
      } finally {
        await client.close();
        await server.close();
      }
    }
    expect(requests).not.toHaveBeenCalled();
  });

  it('receives MCP client cancellation through the handler wrapper', async () => {
    const { server } = await setup(async () => ({ data: { actions: [{ ...terminal, status: 'running' }] } }));
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    try {
      const cancellation = new AbortController();
      const result = client.callTool({ name: 'hetzner_wait_for_action', arguments: { domain: 'servers', resource_id: 42, action_id: 7, timeout: 10 } }, undefined, { signal: cancellation.signal }).catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(0);
      cancellation.abort();
      expect(await result).toBeInstanceOf(Error);
      await vi.advanceTimersByTimeAsync(5000);
      expect(requests).toHaveBeenCalledOnce();
    } finally {
      await client.close();
      await server.close();
    }
    expect(vi.getTimerCount()).toBe(0);
  });
});
