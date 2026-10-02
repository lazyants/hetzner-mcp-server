import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ALL_REGISTRARS } from '../../splits.js';

const request = vi.hoisted(() => vi.fn());
vi.mock('../../services/hetzner.js', () => ({ hetznerRequest: request, storageBoxRequest: vi.fn() }));

interface Tool {
  inputSchema: { parse: (args: Record<string, unknown>) => Record<string, unknown>; safeParse: (args: Record<string, unknown>) => { success: boolean } };
  handler: (args: Record<string, unknown>) => Promise<CallToolResult>;
}

function registry() {
  const server = new McpServer({ name: 'query-parity', version: '0.0.0' });
  for (const register of ALL_REGISTRARS) register(server);
  return (server as unknown as { _registeredTools: Record<string, Tool> })._registeredTools;
}

describe('Cloud query parity', () => {
  beforeEach(() => request.mockReset().mockResolvedValue({}));

  it.each(['servers', 'volumes', 'networks', 'firewalls', 'load_balancers', 'floating_ips', 'primary_ips', 'certificates', 'ssh_keys', 'placement_groups'])('preserves sort through the %s list schema and handler', async (domain) => {
    const tool = registry()[`hetzner_list_${domain}`];
    await tool.handler(tool.inputSchema.parse({ sort: 'id:desc', page: 2, per_page: 25 }));
    expect(request).toHaveBeenCalledWith('GET', `/${domain}`, undefined, { sort: 'id:desc', page: 2, per_page: 25 });
  });

  it('preserves multiple backup server filters and false include_deprecated', async () => {
    const tool = registry().hetzner_list_images;
    await tool.handler(tool.inputSchema.parse({ type: 'backup', bound_to: [42, 43], include_deprecated: false }));
    expect(request).toHaveBeenLastCalledWith('GET', '/images', undefined, { type: 'backup', bound_to: [42, 43], include_deprecated: false });
    await tool.handler(tool.inputSchema.parse({ bound_to: 42, include_deprecated: true }));
    expect(request).toHaveBeenLastCalledWith('GET', '/images', undefined, { bound_to: 42, include_deprecated: true });
    expect(tool.inputSchema.safeParse({ bound_to: -1 }).success).toBe(false);
  });

  it.each([['hetzner_get_server_metrics', 'servers'], ['hetzner_get_lb_metrics', 'load_balancers']])('forwards positive resolution from %s and excludes the path ID', async (name, domain) => {
    const tool = registry()[name];
    const query = { type: 'cpu', start: '2026-10-01T00:00:00Z', end: '2026-10-02T00:00:00Z', step: 60 };
    await tool.handler(tool.inputSchema.parse({ id: 42, ...query }));
    expect(request).toHaveBeenCalledWith('GET', `/${domain}/42/metrics`, undefined, query);
    expect(tool.inputSchema.safeParse({ id: 42, ...query, step: 0 }).success).toBe(false);
    expect(tool.inputSchema.safeParse({ id: 42, ...query, step: -60 }).success).toBe(false);
  });

  it.each([true, false])('forwards explicit vSwitch route exposure %s in the create request', async (expose) => {
    const tool = registry().hetzner_create_network;
    const body = { name: 'private', ip_range: '10.0.0.0/8', expose_routes_to_vswitch: expose };
    await tool.handler(tool.inputSchema.parse(body));
    expect(request).toHaveBeenCalledWith('POST', '/networks', body);
  });
});

describe('Pricing selection', () => {
  const locationPrice = { location: 'fsn1', price_monthly: { net: '5', gross: '5.95' }, included_traffic: 1000, price_per_tb_traffic: { net: '1', gross: '1.19' } };
  const pricing = {
    currency: 'EUR', vat_rate: '19.00',
    server_types: [{ id: 1, name: 'cx32', prices: [locationPrice] }],
    load_balancer_types: [{ id: 2, name: 'lb11', prices: [locationPrice] }],
    volume: { price_per_gb_month: { net: '0.04', gross: '0.0476' } },
    floating_ips: [], primary_ips: [], image: {}, server_backup: { percentage: '20' },
  };

  beforeEach(() => request.mockReset().mockResolvedValue({ pricing }));

  it('returns the unfiltered response unchanged', async () => {
    const tool = registry().hetzner_get_pricing;
    const result = await tool.handler(tool.inputSchema.parse({}));
    expect(result.structuredContent).toEqual({ pricing });
    expect(request).toHaveBeenCalledWith('GET', '/pricing');
  });

  it.each(['server_types', 'load_balancer_types', 'volume', 'floating_ips', 'primary_ips', 'image', 'server_backup'] as const)('selects %s with currency and VAT without sending a server-side query', async (resource) => {
    const tool = registry().hetzner_get_pricing;
    const result = await tool.handler(tool.inputSchema.parse({ resource }));
    expect(result.structuredContent).toEqual({ pricing: { currency: 'EUR', vat_rate: '19.00', [resource]: pricing[resource] } });
    expect(request).toHaveBeenCalledWith('GET', '/pricing');
  });

  it('selects traffic fields from location pricing without mutating the raw response', async () => {
    const tool = registry().hetzner_get_pricing;
    const original = JSON.stringify(pricing);
    const result = await tool.handler(tool.inputSchema.parse({ resource: 'traffic' }));
    const traffic = { location: 'fsn1', included_traffic: 1000, price_per_tb_traffic: { net: '1', gross: '1.19' } };
    expect(result.structuredContent).toEqual({ pricing: {
      currency: 'EUR', vat_rate: '19.00',
      server_types: [{ id: 1, name: 'cx32', prices: [traffic] }],
      load_balancer_types: [{ id: 2, name: 'lb11', prices: [traffic] }],
    } });
    expect(JSON.stringify(pricing)).toBe(original);
    expect(tool.inputSchema.safeParse({ resource: 'invalid' }).success).toBe(false);
  });
});
