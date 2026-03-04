import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { hetznerRequest } from '../services/hetzner.js';
import { handleToolRequest } from '../helpers.js';
import { IdSchema, PaginationParams, LabelSelectorParam, LabelsSchema } from '../schemas/common.js';

export function registerPrimaryIpTools(server: McpServer): void {
  // List primary IPs
  server.registerTool(
    'hetzner_list_primary_ips',
    {
      title: 'List Primary IPs',
      description: 'List all primary IPs in the project, with optional filtering by name, label, or IP address.',
      inputSchema: z.object({
        name: z.string().optional().describe('Filter by primary IP name'),
        ...LabelSelectorParam,
        ip: z.string().optional().describe('Filter by IP address'),
        ...PaginationParams,
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('GET', '/primary_ips', undefined, params))
  );

  // Get primary IP
  server.registerTool(
    'hetzner_get_primary_ip',
    {
      title: 'Get Primary IP',
      description: 'Get details of a specific primary IP by ID.',
      inputSchema: z.object({
        id: IdSchema.describe('Primary IP ID'),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('GET', `/primary_ips/${params.id}`))
  );

  // Create primary IP
  server.registerTool(
    'hetzner_create_primary_ip',
    {
      title: 'Create Primary IP',
      description: 'Create a new primary IP with the specified type and assignee type.',
      inputSchema: z.object({
        type: z.enum(['ipv4', 'ipv6']).describe('IP type'),
        assignee_type: z.literal('server').describe('Assignee type (must be "server")'),
        name: z.string().describe('Name of the primary IP'),
        datacenter: z.string().optional().describe('Datacenter name (e.g. "fsn1-dc14")'),
        auto_delete: z.boolean().optional().describe('Delete the primary IP when the assignee is deleted'),
        labels: LabelsSchema,
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('POST', '/primary_ips', params))
  );

  // Update primary IP
  server.registerTool(
    'hetzner_update_primary_ip',
    {
      title: 'Update Primary IP',
      description: 'Update a primary IP\'s name, auto_delete setting, or labels.',
      inputSchema: z.object({
        id: IdSchema.describe('Primary IP ID'),
        name: z.string().optional().describe('New name'),
        auto_delete: z.boolean().optional().describe('Delete the primary IP when the assignee is deleted'),
        labels: LabelsSchema,
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return hetznerRequest('PUT', `/primary_ips/${id}`, body);
    })
  );

  // Delete primary IP
  server.registerTool(
    'hetzner_delete_primary_ip',
    {
      title: 'Delete Primary IP',
      description: 'Delete a primary IP permanently. It must be unassigned first.',
      inputSchema: z.object({
        id: IdSchema.describe('Primary IP ID'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('DELETE', `/primary_ips/${params.id}`))
  );

  // Assign primary IP
  server.registerTool(
    'hetzner_assign_primary_ip',
    {
      title: 'Assign Primary IP',
      description: 'Assign a primary IP to a server.',
      inputSchema: z.object({
        id: IdSchema.describe('Primary IP ID'),
        assignee_id: z.number().int().positive().describe('Server ID to assign the primary IP to'),
        assignee_type: z.literal('server').describe('Assignee type (must be "server")'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return hetznerRequest('POST', `/primary_ips/${id}/actions/assign`, body);
    })
  );

  // Unassign primary IP
  server.registerTool(
    'hetzner_unassign_primary_ip',
    {
      title: 'Unassign Primary IP',
      description: 'Unassign a primary IP from the server it is currently assigned to.',
      inputSchema: z.object({
        id: IdSchema.describe('Primary IP ID'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('POST', `/primary_ips/${params.id}/actions/unassign`))
  );

  // Change primary IP reverse DNS
  server.registerTool(
    'hetzner_change_primary_ip_rdns',
    {
      title: 'Change Primary IP Reverse DNS',
      description: 'Change the reverse DNS entry for a primary IP. Set dns_ptr to null to reset.',
      inputSchema: z.object({
        id: IdSchema.describe('Primary IP ID'),
        ip: z.string().describe('IP address to set the reverse DNS entry for'),
        dns_ptr: z.string().nullable().describe('Reverse DNS PTR record value, or null to reset'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return hetznerRequest('POST', `/primary_ips/${id}/actions/change_dns_ptr`, body);
    })
  );
}
