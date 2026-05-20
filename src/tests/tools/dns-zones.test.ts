import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Verifies path + method + body/params shape for every tool in the DNS Zones
 * module. Mirrors the patterns established in `list-actions.test.ts` and
 * `change-protection.test.ts`. The Zones API uses an id-or-name path segment;
 * a numeric ID and a zone name are both expected to be interpolated verbatim.
 */

let mockRequest: ReturnType<typeof vi.fn>;

async function loadFreshServer(): Promise<{ McpServerCls: typeof McpServer }> {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv('HETZNER_API_TOKEN', 'test-token');

  mockRequest = vi.fn().mockResolvedValue({ data: { action: { id: 1, status: 'success' } } });

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
  const { registerDnsZoneTools } = await import('../../tools/zones.js');
  const server = new McpServerCls({ name: 't', version: '0.0.0' });
  registerDnsZoneTools(server);
  return server;
}

describe('DNS Zones tools — path, method, body, and query shape', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  // ---------------------------------------------------------------------------
  // Zone-level CRUD + actions
  // ---------------------------------------------------------------------------

  it('hetzner_list_zones: GET /zones with name + mode + label_selector + pagination', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_list_zones', {
      name: 'example.com',
      mode: 'primary',
      label_selector: 'env=prod',
      sort: 'name:asc',
      page: 1,
      per_page: 25,
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/zones',
      data: undefined,
      params: {
        name: 'example.com',
        mode: 'primary',
        label_selector: 'env=prod',
        sort: 'name:asc',
        page: 1,
        per_page: 25,
      },
    });
  });

  it('hetzner_get_zone: GET /zones/{id} with numeric ID', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_get_zone', { id_or_name: 42 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/zones/42',
      data: undefined,
      params: undefined,
    });
  });

  it('hetzner_get_zone: GET /zones/{name} with zone name', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_get_zone', { id_or_name: 'example.com' });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/zones/example.com',
      data: undefined,
      params: undefined,
    });
  });

  it('hetzner_create_zone: POST /zones with name + mode + ttl + labels', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_create_zone', {
      name: 'example.com',
      mode: 'primary',
      ttl: 300,
      labels: { env: 'prod' },
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/zones',
      data: { name: 'example.com', mode: 'primary', ttl: 300, labels: { env: 'prod' } },
      params: undefined,
    });
  });

  it('hetzner_create_zone: POST /zones with secondary mode and primary_nameservers', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_create_zone', {
      name: 'example.com',
      mode: 'secondary',
      primary_nameservers: [
        { address: '198.51.100.1', port: 53 },
      ],
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/zones',
      data: {
        name: 'example.com',
        mode: 'secondary',
        primary_nameservers: [{ address: '198.51.100.1', port: 53 }],
      },
      params: undefined,
    });
  });

  it('hetzner_update_zone: PUT /zones/{id_or_name} with labels in body (id_or_name stripped)', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_update_zone', {
      id_or_name: 'example.com',
      labels: { env: 'staging' },
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'PUT',
      url: '/zones/example.com',
      data: { labels: { env: 'staging' } },
      params: undefined,
    });
  });

  it('hetzner_delete_zone: DELETE /zones/{id_or_name}', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_delete_zone', { id_or_name: 'example.com' });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'DELETE',
      url: '/zones/example.com',
      data: undefined,
      params: undefined,
    });
  });

  it('hetzner_export_zonefile: GET /zones/{id_or_name}/zonefile', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_export_zonefile', { id_or_name: 'example.com' });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/zones/example.com/zonefile',
      data: undefined,
      params: undefined,
    });
  });

  it('hetzner_import_zonefile: POST /zones/{id_or_name}/actions/import_zonefile with zonefile body', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_import_zonefile', {
      id_or_name: 'example.com',
      zonefile: '$ORIGIN example.com.\n@ 300 IN A 1.2.3.4',
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/zones/example.com/actions/import_zonefile',
      data: { zonefile: '$ORIGIN example.com.\n@ 300 IN A 1.2.3.4' },
      params: undefined,
    });
  });

  it('hetzner_change_zone_protection: POST /zones/{id_or_name}/actions/change_protection with delete', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_change_zone_protection', { id_or_name: 'example.com', delete: true });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/zones/example.com/actions/change_protection',
      data: { delete: true },
      params: undefined,
    });
  });

  it('hetzner_change_zone_ttl: POST /zones/{id_or_name}/actions/change_ttl with ttl', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_change_zone_ttl', { id_or_name: 'example.com', ttl: 7200 });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/zones/example.com/actions/change_ttl',
      data: { ttl: 7200 },
      params: undefined,
    });
  });

  it('hetzner_change_zone_primary_nameservers: POST .../actions/change_primary_nameservers', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_change_zone_primary_nameservers', {
      id_or_name: 'example.com',
      primary_nameservers: [{ address: '198.51.100.1' }],
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/zones/example.com/actions/change_primary_nameservers',
      data: { primary_nameservers: [{ address: '198.51.100.1' }] },
      params: undefined,
    });
  });

  it('hetzner_list_zone_actions: GET /zones/{id_or_name}/actions with sort + status + pagination', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_list_zone_actions', {
      id_or_name: 'example.com',
      sort: 'id:desc',
      status: 'success,error',
      page: 1,
      per_page: 25,
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/zones/example.com/actions',
      data: undefined,
      params: { sort: 'id:desc', status: 'success,error', page: 1, per_page: 25 },
    });
  });

  // ---------------------------------------------------------------------------
  // RRSet operations
  // ---------------------------------------------------------------------------

  it('hetzner_list_zone_rrsets: GET /zones/{id_or_name}/rrsets passes type as an array (axios is configured with indexes:null to emit repeated keys)', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_list_zone_rrsets', {
      id_or_name: 'example.com',
      name: 'www',
      type: ['A', 'AAAA'],
      per_page: 50,
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/zones/example.com/rrsets',
      data: undefined,
      params: { name: 'www', type: ['A', 'AAAA'], per_page: 50 },
    });
  });

  it('hetzner_get_zone_rrset: GET /zones/{id_or_name}/rrsets/{name}/{type}', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_get_zone_rrset', {
      id_or_name: 'example.com',
      name: 'www',
      type: 'A',
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/zones/example.com/rrsets/www/A',
      data: undefined,
      params: undefined,
    });
  });

  it('hetzner_get_zone_rrset: URL-encodes RRSet names containing reserved characters', async () => {
    const server = await setupServer();
    // The wildcard "*" name is the canonical case where naive interpolation
    // would inject a reserved sub-delim. encodeURIComponent("*") is a no-op
    // per RFC 3986, but "@" and "/" must be percent-encoded.
    await callTool(server, 'hetzner_get_zone_rrset', {
      id_or_name: 'example.com',
      name: 'foo@bar/baz',
      type: 'TXT',
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/zones/example.com/rrsets/foo%40bar%2Fbaz/TXT',
      data: undefined,
      params: undefined,
    });
  });

  it('hetzner_get_zone: URL-encodes reserved characters in id_or_name path segment', async () => {
    const server = await setupServer();
    // Defense-in-depth: even though IdOrNameSchema only allows non-empty
    // path segments without "/" or whitespace, the handler still encodes
    // reserved chars like "?" and "#" so they cannot break out of the path.
    await callTool(server, 'hetzner_get_zone', { id_or_name: 'ex?ample#weird' });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/zones/ex%3Fample%23weird',
      data: undefined,
      params: undefined,
    });
  });

  it('hetzner_create_zone_rrset: POST /zones/{id_or_name}/rrsets with name + type + records', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_create_zone_rrset', {
      id_or_name: 'example.com',
      name: 'www',
      type: 'A',
      ttl: 300,
      records: [{ value: '1.2.3.4', comment: 'primary' }],
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/zones/example.com/rrsets',
      data: {
        name: 'www',
        type: 'A',
        ttl: 300,
        records: [{ value: '1.2.3.4', comment: 'primary' }],
      },
      params: undefined,
    });
  });

  it('hetzner_update_zone_rrset: PUT /zones/{id_or_name}/rrsets/{name}/{type} with labels only', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_update_zone_rrset', {
      id_or_name: 'example.com',
      name: 'www',
      type: 'A',
      labels: { env: 'prod' },
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'PUT',
      url: '/zones/example.com/rrsets/www/A',
      data: { labels: { env: 'prod' } },
      params: undefined,
    });
  });

  it('hetzner_delete_zone_rrset: DELETE /zones/{id_or_name}/rrsets/{name}/{type}', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_delete_zone_rrset', {
      id_or_name: 'example.com',
      name: 'www',
      type: 'A',
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'DELETE',
      url: '/zones/example.com/rrsets/www/A',
      data: undefined,
      params: undefined,
    });
  });

  it('hetzner_change_zone_rrset_protection: POST .../actions/change_protection with change', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_change_zone_rrset_protection', {
      id_or_name: 'example.com',
      name: 'www',
      type: 'A',
      change: true,
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/zones/example.com/rrsets/www/A/actions/change_protection',
      data: { change: true },
      params: undefined,
    });
  });

  it('hetzner_change_zone_rrset_ttl: POST .../actions/change_ttl with ttl', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_change_zone_rrset_ttl', {
      id_or_name: 'example.com',
      name: 'www',
      type: 'A',
      ttl: 600,
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/zones/example.com/rrsets/www/A/actions/change_ttl',
      data: { ttl: 600 },
      params: undefined,
    });
  });

  it('hetzner_change_zone_rrset_ttl: ttl=null falls back to zone default', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_change_zone_rrset_ttl', {
      id_or_name: 'example.com',
      name: 'www',
      type: 'A',
      ttl: null,
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/zones/example.com/rrsets/www/A/actions/change_ttl',
      data: { ttl: null },
      params: undefined,
    });
  });

  it('hetzner_set_zone_rrset_records: POST .../actions/set_records replaces full list', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_set_zone_rrset_records', {
      id_or_name: 'example.com',
      name: 'www',
      type: 'A',
      records: [{ value: '1.2.3.4' }, { value: '5.6.7.8' }],
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/zones/example.com/rrsets/www/A/actions/set_records',
      data: { records: [{ value: '1.2.3.4' }, { value: '5.6.7.8' }] },
      params: undefined,
    });
  });

  it('hetzner_add_zone_rrset_records: POST .../actions/add_records with optional ttl', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_add_zone_rrset_records', {
      id_or_name: 'example.com',
      name: 'www',
      type: 'A',
      records: [{ value: '9.9.9.9', comment: 'backup' }],
      ttl: 300,
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/zones/example.com/rrsets/www/A/actions/add_records',
      data: { records: [{ value: '9.9.9.9', comment: 'backup' }], ttl: 300 },
      params: undefined,
    });
  });

  it('hetzner_update_zone_rrset_records: POST .../actions/update_records sends comments verbatim', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_update_zone_rrset_records', {
      id_or_name: 'example.com',
      name: 'www',
      type: 'A',
      records: [{ value: '1.2.3.4', comment: 'updated' }],
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/zones/example.com/rrsets/www/A/actions/update_records',
      data: { records: [{ value: '1.2.3.4', comment: 'updated' }] },
      params: undefined,
    });
  });

  it('hetzner_remove_zone_rrset_records: POST .../actions/remove_records', async () => {
    const server = await setupServer();
    await callTool(server, 'hetzner_remove_zone_rrset_records', {
      id_or_name: 'example.com',
      name: 'www',
      type: 'A',
      records: [{ value: '1.2.3.4' }],
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/zones/example.com/rrsets/www/A/actions/remove_records',
      data: { records: [{ value: '1.2.3.4' }] },
      params: undefined,
    });
  });
});
