import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Verifies path + method + body/params shape for the Firewalls module.
 * Sibling files cover related action surfaces:
 *   - `list-actions.test.ts` — hetzner_list_firewall_actions
 */

let mockRequest: ReturnType<typeof vi.fn>;

async function loadFreshServer(): Promise<{ McpServerCls: typeof McpServer }> {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv('HETZNER_API_TOKEN', 'test-token');

  mockRequest = vi.fn().mockResolvedValue({ data: { firewall: { id: 1 } } });

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
  const { registerFirewallTools } = await import('../../tools/firewalls.js');
  const server = new McpServerCls({ name: 't', version: '0.0.0' });
  registerFirewallTools(server);
  return server;
}

describe('Firewalls tools — path, method, and body/params shape', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('hetzner_list_firewalls: GET /firewalls with filters + pagination', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_list_firewalls', {
      name: 'web',
      label_selector: 'env=prod',
      page: 1,
      per_page: 25,
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/firewalls',
      data: undefined,
      params: { name: 'web', label_selector: 'env=prod', page: 1, per_page: 25 },
    });
  });

  it('hetzner_get_firewall: GET /firewalls/{id}', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_get_firewall', { id: 99 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/firewalls/99',
      data: undefined,
      params: undefined,
    });
  });

  it('hetzner_create_firewall: POST /firewalls with rules + apply_to', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_create_firewall', {
      name: 'web-fw',
      rules: [
        {
          direction: 'in',
          protocol: 'tcp',
          port: '80',
          source_ips: ['0.0.0.0/0', '::/0'],
          description: 'HTTP',
        },
      ],
      apply_to: [
        { type: 'server', server: { id: 42 } },
        { type: 'label_selector', label_selector: { selector: 'env=prod' } },
      ],
      labels: { env: 'prod' },
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/firewalls',
      data: {
        name: 'web-fw',
        rules: [
          {
            direction: 'in',
            protocol: 'tcp',
            port: '80',
            source_ips: ['0.0.0.0/0', '::/0'],
            description: 'HTTP',
          },
        ],
        apply_to: [
          { type: 'server', server: { id: 42 } },
          { type: 'label_selector', label_selector: { selector: 'env=prod' } },
        ],
        labels: { env: 'prod' },
      },
      params: undefined,
    });
  });

  it('hetzner_update_firewall: PUT /firewalls/{id} strips id from body', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_update_firewall', { id: 99, name: 'renamed', labels: { env: 'staging' } });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'PUT',
      url: '/firewalls/99',
      data: { name: 'renamed', labels: { env: 'staging' } },
      params: undefined,
    });
  });

  it('hetzner_delete_firewall: DELETE /firewalls/{id}', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_delete_firewall', { id: 99 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'DELETE',
      url: '/firewalls/99',
      data: undefined,
      params: undefined,
    });
  });

  it('hetzner_set_firewall_rules: POST /firewalls/{id}/actions/set_rules replaces full rule set', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_set_firewall_rules', {
      id: 99,
      rules: [
        { direction: 'in', protocol: 'tcp', port: '443', source_ips: ['0.0.0.0/0'] },
      ],
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/firewalls/99/actions/set_rules',
      data: {
        rules: [{ direction: 'in', protocol: 'tcp', port: '443', source_ips: ['0.0.0.0/0'] }],
      },
      params: undefined,
    });
  });

  it('hetzner_set_firewall_rules: POST /firewalls/{id}/actions/set_rules with empty rules clears all', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_set_firewall_rules', { id: 99, rules: [] });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/firewalls/99/actions/set_rules',
      data: { rules: [] },
      params: undefined,
    });
  });

  it('hetzner_apply_firewall: POST /firewalls/{id}/actions/apply_to_resources with mixed apply_to', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_apply_firewall', {
      id: 99,
      apply_to: [
        { type: 'server', server: { id: 42 } },
        { type: 'label_selector', label_selector: { selector: 'tier=web' } },
      ],
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/firewalls/99/actions/apply_to_resources',
      data: {
        apply_to: [
          { type: 'server', server: { id: 42 } },
          { type: 'label_selector', label_selector: { selector: 'tier=web' } },
        ],
      },
      params: undefined,
    });
  });

  it('hetzner_remove_firewall: POST /firewalls/{id}/actions/remove_from_resources with remove_from body', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_remove_firewall', {
      id: 99,
      remove_from: [{ type: 'server', server: { id: 42 } }],
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/firewalls/99/actions/remove_from_resources',
      data: { remove_from: [{ type: 'server', server: { id: 42 } }] },
      params: undefined,
    });
  });
});
