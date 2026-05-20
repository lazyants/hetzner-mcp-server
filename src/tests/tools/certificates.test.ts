import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Verifies path + method + body/params shape for CRUD + module-specific action
 * tools in the Certificates module. Sibling files cover cross-cutting surfaces:
 *   - `list-actions.test.ts` — hetzner_list_certificate_actions
 *
 * Certificates have no `change_protection` tool, so there is no entry in
 * `change-protection.test.ts` for this resource.
 */

let mockRequest: ReturnType<typeof vi.fn>;

async function loadFreshServer(): Promise<{ McpServerCls: typeof McpServer }> {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv('HETZNER_API_TOKEN', 'test-token');

  mockRequest = vi.fn().mockResolvedValue({ data: { certificate: { id: 1 } } });

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
  const { registerCertificateTools } = await import('../../tools/certificates.js');
  const server = new McpServerCls({ name: 't', version: '0.0.0' });
  registerCertificateTools(server);
  return server;
}

describe('Certificates tools — path, method, and body/params shape', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('hetzner_list_certificates: GET /certificates with filters + pagination', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_list_certificates', {
      name: 'wildcard-example-com',
      label_selector: 'env=prod',
      type: 'managed',
      page: 1,
      per_page: 25,
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/certificates',
      data: undefined,
      params: {
        name: 'wildcard-example-com',
        label_selector: 'env=prod',
        type: 'managed',
        page: 1,
        per_page: 25,
      },
    });
  });

  it('hetzner_get_certificate: GET /certificates/{id}', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_get_certificate', { id: 17 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/certificates/17',
      data: undefined,
      params: undefined,
    });
  });

  it('hetzner_create_certificate: POST /certificates with uploaded PEM body', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_create_certificate', {
      name: 'wildcard-example-com',
      type: 'uploaded',
      certificate: '-----BEGIN CERTIFICATE-----\nMIIB...\n-----END CERTIFICATE-----\n',
      private_key: '-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n',
      labels: { env: 'prod' },
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/certificates',
      data: {
        name: 'wildcard-example-com',
        type: 'uploaded',
        certificate: '-----BEGIN CERTIFICATE-----\nMIIB...\n-----END CERTIFICATE-----\n',
        private_key: '-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n',
        labels: { env: 'prod' },
      },
      params: undefined,
    });
  });

  it('hetzner_create_certificate: POST /certificates with managed domain_names body', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_create_certificate', {
      name: 'managed-example-com',
      type: 'managed',
      domain_names: ['example.com', 'www.example.com'],
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/certificates',
      data: {
        name: 'managed-example-com',
        type: 'managed',
        domain_names: ['example.com', 'www.example.com'],
      },
      params: undefined,
    });
  });

  it('hetzner_update_certificate: PUT /certificates/{id} strips id from body', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_update_certificate', {
      id: 17,
      name: 'renamed',
      labels: { env: 'staging' },
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'PUT',
      url: '/certificates/17',
      data: { name: 'renamed', labels: { env: 'staging' } },
      params: undefined,
    });
  });

  it('hetzner_delete_certificate: DELETE /certificates/{id}', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_delete_certificate', { id: 17 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'DELETE',
      url: '/certificates/17',
      data: undefined,
      params: undefined,
    });
  });

  it('hetzner_retry_certificate: POST /certificates/{id}/actions/retry (no body)', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_retry_certificate', { id: 17 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/certificates/17/actions/retry',
      data: undefined,
      params: undefined,
    });
  });
});
