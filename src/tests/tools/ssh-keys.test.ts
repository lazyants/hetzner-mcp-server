import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Verifies path + method + body/params shape for CRUD tools in the SSH Keys
 * module. SSH keys have no protection or action surfaces, so this file is the
 * complete coverage for `src/tools/ssh-keys.ts`.
 */

let mockRequest: ReturnType<typeof vi.fn>;

async function loadFreshServer(): Promise<{ McpServerCls: typeof McpServer }> {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv('HETZNER_API_TOKEN', 'test-token');

  mockRequest = vi.fn().mockResolvedValue({ data: { ssh_key: { id: 1 } } });

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
  const { registerSshKeyTools } = await import('../../tools/ssh-keys.js');
  const server = new McpServerCls({ name: 't', version: '0.0.0' });
  registerSshKeyTools(server);
  return server;
}

describe('SSH Keys tools — path, method, and body/params shape', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('hetzner_list_ssh_keys: GET /ssh_keys with name + fingerprint + label_selector + pagination', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_list_ssh_keys', {
      name: 'deploy',
      label_selector: 'env=prod',
      fingerprint: 'aa:bb:cc:dd',
      page: 1,
      per_page: 25,
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/ssh_keys',
      data: undefined,
      params: {
        name: 'deploy',
        label_selector: 'env=prod',
        fingerprint: 'aa:bb:cc:dd',
        page: 1,
        per_page: 25,
      },
    });
  });

  it('hetzner_get_ssh_key: GET /ssh_keys/{id}', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_get_ssh_key', { id: 42 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/ssh_keys/42',
      data: undefined,
      params: undefined,
    });
  });

  it('hetzner_create_ssh_key: POST /ssh_keys with name + public_key + labels', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_create_ssh_key', {
      name: 'deploy',
      public_key: 'ssh-rsa AAAAB3NzaC1yc2E...',
      labels: { env: 'prod' },
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/ssh_keys',
      data: {
        name: 'deploy',
        public_key: 'ssh-rsa AAAAB3NzaC1yc2E...',
        labels: { env: 'prod' },
      },
      params: undefined,
    });
  });

  it('hetzner_update_ssh_key: PUT /ssh_keys/{id} strips id from body', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_update_ssh_key', {
      id: 42,
      name: 'renamed',
      labels: { env: 'staging' },
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'PUT',
      url: '/ssh_keys/42',
      data: { name: 'renamed', labels: { env: 'staging' } },
      params: undefined,
    });
  });

  it('hetzner_delete_ssh_key: DELETE /ssh_keys/{id}', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_delete_ssh_key', { id: 42 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'DELETE',
      url: '/ssh_keys/42',
      data: undefined,
      params: undefined,
    });
  });
});
