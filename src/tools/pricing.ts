import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { hetznerRequest } from '../services/hetzner.js';
import { handleToolRequest } from '../helpers.js';

export function registerPricingTools(server: McpServer): void {
  // Get pricing
  server.registerTool(
    'hetzner_get_pricing',
    {
      title: 'Get Pricing',
      description: 'Get current prices for all Hetzner Cloud resources (servers, volumes, traffic, floating IPs, load balancers, and more).',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async () => hetznerRequest('GET', '/pricing'))
  );
}
