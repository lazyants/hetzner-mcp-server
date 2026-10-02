import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { hetznerRequest } from '../services/hetzner.js';
import { handleToolRequest } from '../helpers.js';

interface LocationPrice {
  location: string;
  included_traffic: number;
  price_per_tb_traffic: { net: string; gross: string };
}

interface ResourcePrices {
  id: number;
  name: string;
  prices: LocationPrice[];
}

interface PricingResponse {
  pricing: {
    currency: string;
    vat_rate: string;
    server_types: ResourcePrices[];
    load_balancer_types: ResourcePrices[];
    [key: string]: unknown;
  };
}

function trafficPrices(resources: ResourcePrices[]) {
  return resources.map(({ id, name, prices }) => ({
    id, name,
    prices: prices.map(({ location, included_traffic, price_per_tb_traffic }) => ({ location, included_traffic, price_per_tb_traffic })),
  }));
}

export function registerPricingTools(server: McpServer): void {
  // Get pricing
  server.registerTool(
    'hetzner_get_pricing',
    {
      title: 'Get Pricing',
      description: 'Get current Hetzner Cloud prices, optionally selecting one resource category or traffic prices. Currency and VAT rate are included with filtered results.',
      inputSchema: z.object({
        resource: z.enum(['server_types', 'load_balancer_types', 'volume', 'floating_ips', 'primary_ips', 'traffic', 'image', 'server_backup']).optional().describe('Resource category to return; omit for all prices'),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async ({ resource }) => {
      const data = await hetznerRequest<PricingResponse>('GET', '/pricing');
      if (!resource) return data;
      const { currency, vat_rate } = data.pricing;
      if (resource === 'traffic') {
        return { pricing: {
          currency, vat_rate,
          server_types: trafficPrices(data.pricing.server_types),
          load_balancer_types: trafficPrices(data.pricing.load_balancer_types),
        } };
      }
      return { pricing: { currency, vat_rate, [resource]: data.pricing[resource] } };
    })
  );
}
