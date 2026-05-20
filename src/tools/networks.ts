import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { hetznerRequest } from '../services/hetzner.js';
import { handleToolRequest } from '../helpers.js';
import { IdSchema, PaginationParams, LabelSelectorParam, LabelsSchema, NameFilterParam, SortParam, ActionStatusFilterParam } from '../schemas/common.js';

export function registerNetworkTools(server: McpServer): void {
  server.registerTool(
    'hetzner_list_networks',
    {
      title: 'List Networks',
      description: 'List all networks in the project, with optional filtering by name or labels.',
      inputSchema: z.object({
        ...NameFilterParam,
        ...LabelSelectorParam,
        ...PaginationParams,
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('GET', '/networks', undefined, params))
  );

  server.registerTool(
    'hetzner_get_network',
    {
      title: 'Get Network',
      description: 'Get details of a specific network by its ID.',
      inputSchema: z.object({
        id: IdSchema,
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('GET', `/networks/${params.id}`))
  );

  server.registerTool(
    'hetzner_create_network',
    {
      title: 'Create Network',
      description: 'Create a new network with the specified IP range, and optionally subnets and routes.',
      inputSchema: z.object({
        name: z.string().describe('Name of the network'),
        ip_range: z.string().describe('IP range of the whole network, e.g. "10.0.0.0/8"'),
        subnets: z.array(z.object({
          type: z.string().describe('Type of subnet: cloud, server, or vswitch'),
          ip_range: z.string().describe('IP range of the subnet'),
          network_zone: z.string().describe('Name of the network zone, e.g. "eu-central"'),
          vswitch_id: z.number().int().optional().describe('ID of the vSwitch (for vswitch type)'),
        })).optional().describe('Array of subnets to create'),
        routes: z.array(z.object({
          destination: z.string().describe('Destination network of the route'),
          gateway: z.string().describe('Gateway for the route'),
        })).optional().describe('Array of routes to create'),
        labels: LabelsSchema,
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('POST', '/networks', params))
  );

  server.registerTool(
    'hetzner_update_network',
    {
      title: 'Update Network',
      description: 'Update properties of a network such as name, labels, or vSwitch route exposure.',
      inputSchema: z.object({
        id: IdSchema,
        name: z.string().optional().describe('New name for the network'),
        labels: LabelsSchema,
        expose_routes_to_vswitch: z.boolean().optional().describe('Whether to expose routes to the vSwitch'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return hetznerRequest('PUT', `/networks/${id}`, body);
    })
  );

  server.registerTool(
    'hetzner_delete_network',
    {
      title: 'Delete Network',
      description: 'Delete a network. All subnets and routes within it will also be deleted.',
      inputSchema: z.object({
        id: IdSchema,
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('DELETE', `/networks/${params.id}`))
  );

  server.registerTool(
    'hetzner_add_subnet',
    {
      title: 'Add Subnet to Network',
      description: 'Add a subnet to an existing network.',
      inputSchema: z.object({
        id: IdSchema,
        type: z.enum(['cloud', 'server', 'vswitch']).describe('Type of subnet'),
        network_zone: z.string().describe('Name of the network zone, e.g. "eu-central"'),
        ip_range: z.string().optional().describe('IP range of the subnet'),
        vswitch_id: z.number().int().optional().describe('ID of the vSwitch (required for vswitch type)'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return hetznerRequest('POST', `/networks/${id}/actions/add_subnet`, body);
    })
  );

  server.registerTool(
    'hetzner_delete_subnet',
    {
      title: 'Delete Subnet from Network',
      description: 'Remove a subnet from an existing network by its IP range.',
      inputSchema: z.object({
        id: IdSchema,
        ip_range: z.string().describe('IP range of the subnet to delete'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return hetznerRequest('POST', `/networks/${id}/actions/delete_subnet`, body);
    })
  );

  server.registerTool(
    'hetzner_add_route',
    {
      title: 'Add Route to Network',
      description: 'Add a route to an existing network.',
      inputSchema: z.object({
        id: IdSchema,
        destination: z.string().describe('Destination network of the route'),
        gateway: z.string().describe('Gateway for the route'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return hetznerRequest('POST', `/networks/${id}/actions/add_route`, body);
    })
  );

  server.registerTool(
    'hetzner_delete_route',
    {
      title: 'Delete Route from Network',
      description: 'Remove a route from an existing network.',
      inputSchema: z.object({
        id: IdSchema,
        destination: z.string().describe('Destination network of the route to delete'),
        gateway: z.string().describe('Gateway of the route to delete'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return hetznerRequest('POST', `/networks/${id}/actions/delete_route`, body);
    })
  );

  // Change network IP range
  server.registerTool(
    'hetzner_change_ip_range',
    {
      title: 'Change Network IP Range',
      description: 'Expand the IP range of an existing network. The new CIDR range must contain the current range; shrinking is not supported.',
      inputSchema: z.object({
        id: IdSchema.describe('Network ID'),
        ip_range: z.string().describe('New IP range in CIDR notation (e.g. "10.0.0.0/8"). Must be a superset of the current range.'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return hetznerRequest('POST', `/networks/${id}/actions/change_ip_range`, body);
    })
  );

  // Change network protection
  server.registerTool(
    'hetzner_change_network_protection',
    {
      title: 'Change Network Protection',
      description: 'Enable or disable delete protection on a network to guard against accidental destruction.',
      inputSchema: z.object({
        id: IdSchema.describe('Network ID'),
        delete: z.boolean().optional().describe('If true, prevents the network from being deleted'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return hetznerRequest('POST', `/networks/${id}/actions/change_protection`, body);
    })
  );

  // List network actions
  server.registerTool(
    'hetzner_list_network_actions',
    {
      title: 'List Network Actions',
      description: 'List all actions performed on a specific network, such as subnet and route changes.',
      inputSchema: z.object({
        id: IdSchema.describe('Network ID'),
        ...SortParam,
        ...ActionStatusFilterParam,
        ...PaginationParams,
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...queryParams } = params;
      return hetznerRequest('GET', `/networks/${id}/actions`, undefined, queryParams);
    })
  );
}
