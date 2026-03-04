import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { hetznerRequest } from '../services/hetzner.js';
import { handleToolRequest } from '../helpers.js';
import { IdSchema, PaginationParams } from '../schemas/common.js';

export function registerIsoTools(server: McpServer): void {
  // List ISOs
  server.registerTool(
    'hetzner_list_isos',
    {
      title: 'List ISOs',
      description: 'List all available ISO images for mounting on servers.',
      inputSchema: z.object({
        name: z.string().optional().describe('Filter by ISO name'),
        architecture: z.enum(['x86', 'arm']).optional().describe('Filter by CPU architecture'),
        ...PaginationParams,
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('GET', '/isos', undefined, params))
  );

  // Get ISO
  server.registerTool(
    'hetzner_get_iso',
    {
      title: 'Get ISO',
      description: 'Get details of a specific ISO image by ID.',
      inputSchema: z.object({
        id: IdSchema.describe('ISO ID'),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('GET', `/isos/${params.id}`))
  );

  // Attach ISO to server
  server.registerTool(
    'hetzner_attach_iso',
    {
      title: 'Attach ISO to Server',
      description: 'Attach an ISO image to a server. The server must be rebooted to boot from the ISO.',
      inputSchema: z.object({
        server_id: IdSchema.describe('Server ID to attach the ISO to'),
        iso: z.string().describe('ISO name or ID to attach'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { server_id, ...body } = params;
      return hetznerRequest('POST', `/servers/${server_id}/actions/attach_iso`, body);
    })
  );

  // Detach ISO from server
  server.registerTool(
    'hetzner_detach_iso',
    {
      title: 'Detach ISO from Server',
      description: 'Detach an ISO image from a server. The server must be rebooted for the change to take effect.',
      inputSchema: z.object({
        server_id: IdSchema.describe('Server ID to detach the ISO from'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('POST', `/servers/${params.server_id}/actions/detach_iso`))
  );
}
