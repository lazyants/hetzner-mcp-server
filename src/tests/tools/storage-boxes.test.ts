import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Path + method + body/params shape for every Storage Box tool (core,
 * snapshots, subaccounts). Mirrors datacenters.test.ts / change-protection.test.ts:
 * mock axios.create, register the tools, invoke the handler, assert the captured
 * request args. Storage Box calls go to the storageBoxRequest client; the captured
 * url is relative to its api.hetzner.com base (base-URL routing is covered in
 * storage-box-client.test.ts).
 */

let mockRequest: ReturnType<typeof vi.fn>;

async function loadFreshServer(): Promise<{ McpServerCls: typeof McpServer }> {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv('HETZNER_STORAGE_API_TOKEN', 'test-token');

  mockRequest = vi.fn().mockResolvedValue({ data: { storage_box: { id: 1 } } });

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
  const { registerStorageBoxTools } = await import('../../tools/storage-boxes.js');
  const server = new McpServerCls({ name: 't', version: '0.0.0' });
  registerStorageBoxTools(server);
  return server;
}

describe('Storage Box core tools — path, method, body/params shape', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('hetzner_list_storage_boxes: GET /storage_boxes with filters', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_list_storage_boxes', { name: 'backup', label_selector: 'env=prod', sort: 'id:asc', page: 1, per_page: 25 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/storage_boxes',
      data: undefined,
      params: { name: 'backup', label_selector: 'env=prod', sort: 'id:asc', page: 1, per_page: 25 },
    });
  });

  it('hetzner_create_storage_box: POST /storage_boxes with full body', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_create_storage_box', {
      name: 'box', storage_box_type: 'bx20', location: 'fsn1', password: 'pw',
      ssh_keys: ['ssh-rsa AAA'], access_settings: { ssh_enabled: true },
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/storage_boxes',
      data: { name: 'box', storage_box_type: 'bx20', location: 'fsn1', password: 'pw', ssh_keys: ['ssh-rsa AAA'], access_settings: { ssh_enabled: true } },
      params: undefined,
    });
  });

  it('hetzner_get_storage_box: GET /storage_boxes/{id}', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_get_storage_box', { id: 7 });
    expect(mockRequest).toHaveBeenCalledWith({ method: 'GET', url: '/storage_boxes/7', data: undefined, params: undefined });
  });

  it('hetzner_update_storage_box: PUT /storage_boxes/{id} with body (id stripped)', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_update_storage_box', { id: 7, name: 'renamed', labels: { a: 'b' } });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'PUT',
      url: '/storage_boxes/7',
      data: { name: 'renamed', labels: { a: 'b' } },
      params: undefined,
    });
  });

  it('hetzner_delete_storage_box: DELETE /storage_boxes/{id}', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_delete_storage_box', { id: 7 });
    expect(mockRequest).toHaveBeenCalledWith({ method: 'DELETE', url: '/storage_boxes/7', data: undefined, params: undefined });
  });

  it('hetzner_list_storage_box_folders: GET /storage_boxes/{id}/folders with path query', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_list_storage_box_folders', { id: 7, path: '/backups' });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/storage_boxes/7/folders',
      data: undefined,
      params: { path: '/backups' },
    });
  });

  it('hetzner_list_storage_box_actions: GET /storage_boxes/{id}/actions with query', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_list_storage_box_actions', { id: 7, sort: 'id:desc', status: 'running', page: 2 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/storage_boxes/7/actions',
      data: undefined,
      params: { sort: 'id:desc', status: 'running', page: 2 },
    });
  });

  it('hetzner_change_storage_box_protection: POST .../change_protection', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_change_storage_box_protection', { id: 7, delete: true });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST', url: '/storage_boxes/7/actions/change_protection', data: { delete: true }, params: undefined,
    });
  });

  it('hetzner_change_storage_box_type: POST .../change_type', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_change_storage_box_type', { id: 7, storage_box_type: 'bx30' });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST', url: '/storage_boxes/7/actions/change_type', data: { storage_box_type: 'bx30' }, params: undefined,
    });
  });

  it('hetzner_reset_storage_box_password: POST .../reset_password', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_reset_storage_box_password', { id: 7, password: 'new-pw' });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST', url: '/storage_boxes/7/actions/reset_password', data: { password: 'new-pw' }, params: undefined,
    });
  });

  it('hetzner_update_storage_box_access_settings: POST .../update_access_settings (id stripped from body)', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_update_storage_box_access_settings', { id: 7, ssh_enabled: true, samba_enabled: false });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST', url: '/storage_boxes/7/actions/update_access_settings', data: { ssh_enabled: true, samba_enabled: false }, params: undefined,
    });
  });

  it('hetzner_rollback_storage_box_snapshot: POST .../rollback_snapshot', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_rollback_storage_box_snapshot', { id: 7, snapshot: 'snap-1' });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST', url: '/storage_boxes/7/actions/rollback_snapshot', data: { snapshot: 'snap-1' }, params: undefined,
    });
  });

  it('hetzner_enable_storage_box_snapshot_plan: POST .../enable_snapshot_plan', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_enable_storage_box_snapshot_plan', { id: 7, max_snapshots: 10, minute: 0, hour: 3, day_of_week: 1 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST', url: '/storage_boxes/7/actions/enable_snapshot_plan',
      data: { max_snapshots: 10, minute: 0, hour: 3, day_of_week: 1 }, params: undefined,
    });
  });

  it('hetzner_disable_storage_box_snapshot_plan: POST .../disable_snapshot_plan', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_disable_storage_box_snapshot_plan', { id: 7 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST', url: '/storage_boxes/7/actions/disable_snapshot_plan', data: undefined, params: undefined,
    });
  });

  it('hetzner_list_storage_box_types: GET /storage_box_types', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_list_storage_box_types', { name: 'bx20', page: 1 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET', url: '/storage_box_types', data: undefined, params: { name: 'bx20', page: 1 },
    });
  });

  it('hetzner_get_storage_box_type: GET /storage_box_types/{id}', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_get_storage_box_type', { id: 3 });
    expect(mockRequest).toHaveBeenCalledWith({ method: 'GET', url: '/storage_box_types/3', data: undefined, params: undefined });
  });
});

describe('Storage Box snapshot tools — path, method, body/params shape', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('hetzner_list_storage_box_snapshots: GET .../snapshots', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_list_storage_box_snapshots', { id: 7, name: 'snap', is_automatic: true });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET', url: '/storage_boxes/7/snapshots', data: undefined, params: { name: 'snap', is_automatic: true },
    });
  });

  it('hetzner_create_storage_box_snapshot: POST .../snapshots', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_create_storage_box_snapshot', { id: 7, description: 'nightly' });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST', url: '/storage_boxes/7/snapshots', data: { description: 'nightly' }, params: undefined,
    });
  });

  it('hetzner_get_storage_box_snapshot: GET .../snapshots/{snapshot_id}', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_get_storage_box_snapshot', { id: 7, snapshot_id: 99 });
    expect(mockRequest).toHaveBeenCalledWith({ method: 'GET', url: '/storage_boxes/7/snapshots/99', data: undefined, params: undefined });
  });

  it('hetzner_update_storage_box_snapshot: PUT .../snapshots/{snapshot_id} (ids stripped)', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_update_storage_box_snapshot', { id: 7, snapshot_id: 99, description: 'kept' });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'PUT', url: '/storage_boxes/7/snapshots/99', data: { description: 'kept' }, params: undefined,
    });
  });

  it('hetzner_delete_storage_box_snapshot: DELETE .../snapshots/{snapshot_id}', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_delete_storage_box_snapshot', { id: 7, snapshot_id: 99 });
    expect(mockRequest).toHaveBeenCalledWith({ method: 'DELETE', url: '/storage_boxes/7/snapshots/99', data: undefined, params: undefined });
  });
});

describe('Storage Box subaccount tools — path, method, body/params shape', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('hetzner_list_storage_box_subaccounts: GET .../subaccounts', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_list_storage_box_subaccounts', { id: 7, username: 'u1', sort: 'id:asc' });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET', url: '/storage_boxes/7/subaccounts', data: undefined, params: { username: 'u1', sort: 'id:asc' },
    });
  });

  it('hetzner_create_storage_box_subaccount: POST .../subaccounts', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_create_storage_box_subaccount', { id: 7, home_directory: '/web', password: 'pw' });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST', url: '/storage_boxes/7/subaccounts', data: { home_directory: '/web', password: 'pw' }, params: undefined,
    });
  });

  it('hetzner_get_storage_box_subaccount: GET .../subaccounts/{subaccount_id}', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_get_storage_box_subaccount', { id: 7, subaccount_id: 5 });
    expect(mockRequest).toHaveBeenCalledWith({ method: 'GET', url: '/storage_boxes/7/subaccounts/5', data: undefined, params: undefined });
  });

  it('hetzner_update_storage_box_subaccount: PUT .../subaccounts/{subaccount_id} (ids stripped)', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_update_storage_box_subaccount', { id: 7, subaccount_id: 5, description: 'd' });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'PUT', url: '/storage_boxes/7/subaccounts/5', data: { description: 'd' }, params: undefined,
    });
  });

  it('hetzner_delete_storage_box_subaccount: DELETE .../subaccounts/{subaccount_id}', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_delete_storage_box_subaccount', { id: 7, subaccount_id: 5 });
    expect(mockRequest).toHaveBeenCalledWith({ method: 'DELETE', url: '/storage_boxes/7/subaccounts/5', data: undefined, params: undefined });
  });

  it('hetzner_change_storage_box_subaccount_home_directory: POST .../change_home_directory', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_change_storage_box_subaccount_home_directory', { id: 7, subaccount_id: 5, home_directory: '/db' });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST', url: '/storage_boxes/7/subaccounts/5/actions/change_home_directory', data: { home_directory: '/db' }, params: undefined,
    });
  });

  it('hetzner_reset_storage_box_subaccount_password: POST .../reset_subaccount_password', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_reset_storage_box_subaccount_password', { id: 7, subaccount_id: 5, password: 'pw2' });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST', url: '/storage_boxes/7/subaccounts/5/actions/reset_subaccount_password', data: { password: 'pw2' }, params: undefined,
    });
  });

  it('hetzner_update_storage_box_subaccount_access_settings: POST .../update_access_settings (ids stripped)', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_update_storage_box_subaccount_access_settings', { id: 7, subaccount_id: 5, readonly: true, ssh_enabled: false });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST', url: '/storage_boxes/7/subaccounts/5/actions/update_access_settings', data: { readonly: true, ssh_enabled: false }, params: undefined,
    });
  });
});
