import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { hetznerRequest } from '../services/hetzner.js';
import { handleToolRequest } from '../helpers.js';
import { IdSchema, PaginationParams, LabelSelectorParam, LabelsSchema, NameFilterParam } from '../schemas/common.js';

const FirewallRuleSchema = z.object({
  direction: z.enum(['in', 'out']).describe('Direction of traffic: in or out'),
  protocol: z.enum(['tcp', 'udp', 'icmp', 'esp', 'gre']).describe('Network protocol'),
  port: z.string().optional().describe('Port or port range (e.g. "80" or "1-1024"), required for tcp/udp'),
  source_ips: z.array(z.string()).optional().describe('CIDR source IPs (required for direction "in")'),
  destination_ips: z.array(z.string()).optional().describe('CIDR destination IPs (required for direction "out")'),
  description: z.string().optional().describe('Description of the rule'),
});

const ApplyToSchema = z.object({
  type: z.enum(['server', 'label_selector']).describe('Resource type to apply to'),
  server: z.object({ id: z.number().int().describe('Server ID') }).optional().describe('Server to apply to (for type "server")'),
  label_selector: z.object({ selector: z.string().describe('Label selector') }).optional().describe('Label selector (for type "label_selector")'),
});

export function registerFirewallTools(server: McpServer): void {
  server.registerTool(
    'hetzner_list_firewalls',
    {
      title: 'List Firewalls',
      description: 'List all firewalls in the project, with optional filtering by name or labels.',
      inputSchema: z.object({
        ...NameFilterParam,
        ...LabelSelectorParam,
        ...PaginationParams,
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('GET', '/firewalls', undefined, params))
  );

  server.registerTool(
    'hetzner_get_firewall',
    {
      title: 'Get Firewall',
      description: 'Get details of a specific firewall by its ID.',
      inputSchema: z.object({
        id: IdSchema,
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('GET', `/firewalls/${params.id}`))
  );

  server.registerTool(
    'hetzner_create_firewall',
    {
      title: 'Create Firewall',
      description: 'Create a new firewall with optional rules and resource assignments.',
      inputSchema: z.object({
        name: z.string().describe('Name of the firewall'),
        rules: z.array(FirewallRuleSchema).optional().describe('Array of firewall rules'),
        apply_to: z.array(ApplyToSchema).optional().describe('Resources to apply the firewall to'),
        labels: LabelsSchema,
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('POST', '/firewalls', params))
  );

  server.registerTool(
    'hetzner_update_firewall',
    {
      title: 'Update Firewall',
      description: 'Update a firewall name or labels.',
      inputSchema: z.object({
        id: IdSchema,
        name: z.string().optional().describe('New name for the firewall'),
        labels: LabelsSchema,
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return hetznerRequest('PUT', `/firewalls/${id}`, body);
    })
  );

  server.registerTool(
    'hetzner_delete_firewall',
    {
      title: 'Delete Firewall',
      description: 'Delete a firewall. It must be removed from all resources first.',
      inputSchema: z.object({
        id: IdSchema,
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('DELETE', `/firewalls/${params.id}`))
  );

  server.registerTool(
    'hetzner_set_firewall_rules',
    {
      title: 'Set Firewall Rules',
      description: 'Replace all rules of a firewall with a new set of rules.',
      inputSchema: z.object({
        id: IdSchema,
        rules: z.array(FirewallRuleSchema).describe('New set of firewall rules (replaces all existing)'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return hetznerRequest('POST', `/firewalls/${id}/actions/set_rules`, body);
    })
  );

  server.registerTool(
    'hetzner_apply_firewall',
    {
      title: 'Apply Firewall to Resources',
      description: 'Apply a firewall to one or more servers or label selectors.',
      inputSchema: z.object({
        id: IdSchema,
        apply_to: z.array(ApplyToSchema).describe('Resources to apply the firewall to'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return hetznerRequest('POST', `/firewalls/${id}/actions/apply_to_resources`, body);
    })
  );

  server.registerTool(
    'hetzner_remove_firewall',
    {
      title: 'Remove Firewall from Resources',
      description: 'Remove a firewall from one or more servers or label selectors.',
      inputSchema: z.object({
        id: IdSchema,
        remove_from: z.array(ApplyToSchema).describe('Resources to remove the firewall from'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return hetznerRequest('POST', `/firewalls/${id}/actions/remove_from_resources`, body);
    })
  );
}
