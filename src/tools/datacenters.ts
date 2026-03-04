import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { hetznerRequest } from '../services/hetzner.js';
import { handleToolRequest } from '../helpers.js';
import { IdSchema, PaginationParams } from '../schemas/common.js';

export function registerDatacenterTools(server: McpServer): void {
  // List datacenters
  server.registerTool(
    'hetzner_list_datacenters',
    {
      title: 'List Datacenters',
      description: 'List all available datacenters and their supported server types.',
      inputSchema: z.object({
        name: z.string().optional().describe('Filter by datacenter name'),
        ...PaginationParams,
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('GET', '/datacenters', undefined, params))
  );

  // Get datacenter
  server.registerTool(
    'hetzner_get_datacenter',
    {
      title: 'Get Datacenter',
      description: 'Get details of a specific datacenter by ID.',
      inputSchema: z.object({
        id: IdSchema.describe('Datacenter ID'),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('GET', `/datacenters/${params.id}`))
  );

  // List locations
  server.registerTool(
    'hetzner_list_locations',
    {
      title: 'List Locations',
      description: 'List all available Hetzner Cloud locations (regions).',
      inputSchema: z.object({
        name: z.string().optional().describe('Filter by location name'),
        ...PaginationParams,
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('GET', '/locations', undefined, params))
  );

  // Get location
  server.registerTool(
    'hetzner_get_location',
    {
      title: 'Get Location',
      description: 'Get details of a specific location by ID.',
      inputSchema: z.object({
        id: IdSchema.describe('Location ID'),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('GET', `/locations/${params.id}`))
  );

  // List server types
  server.registerTool(
    'hetzner_list_server_types',
    {
      title: 'List Server Types',
      description: 'List all available server types with their specs and pricing.',
      inputSchema: z.object({
        name: z.string().optional().describe('Filter by server type name'),
        ...PaginationParams,
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('GET', '/server_types', undefined, params))
  );

  // Get server type
  server.registerTool(
    'hetzner_get_server_type',
    {
      title: 'Get Server Type',
      description: 'Get details of a specific server type, including specs and pricing.',
      inputSchema: z.object({
        id: IdSchema.describe('Server type ID'),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('GET', `/server_types/${params.id}`))
  );
}
