import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { hetznerRequest } from '../services/hetzner.js';
import { handleToolRequest } from '../helpers.js';
import { IdSchema, PaginationParams } from '../schemas/common.js';

// Hetzner deprecated GET /datacenters and GET /datacenters/{id} on 2026-06-02;
// they return HTTP 410 Gone after 2026-10-01. There is no drop-in replacement —
// the availability data moved to hetzner_list_server_types
// (locations[].available/recommended) and hetzner_list_locations. Remove these
// two tools in a follow-up release once the endpoints start returning 410.
const DATACENTERS_REMOVAL_DATE = '2026-10-01';

export function registerDatacenterTools(server: McpServer): void {
  // List datacenters
  server.registerTool(
    'hetzner_list_datacenters',
    {
      title: 'List Datacenters',
      description: `Deprecated by Hetzner; /datacenters is removed after ${DATACENTERS_REMOVAL_DATE} (HTTP 410). Use hetzner_list_server_types (locations[].available/recommended) and hetzner_list_locations instead.`,
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
      description: `Deprecated by Hetzner; /datacenters is removed after ${DATACENTERS_REMOVAL_DATE} (HTTP 410). Use hetzner_list_server_types (locations[].available/recommended) and hetzner_list_locations instead.`,
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
