import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { hetznerRequest } from '../services/hetzner.js';
import { handleToolRequest } from '../helpers.js';
import { IdSchema, PaginationParams, LabelSelectorParam, LabelsSchema } from '../schemas/common.js';

export function registerServerTools(server: McpServer): void {
  // List servers
  server.registerTool(
    'hetzner_list_servers',
    {
      title: 'List Servers',
      description: 'List all servers in the project, with optional filtering by name, label, or status.',
      inputSchema: z.object({
        name: z.string().optional().describe('Filter by server name'),
        ...LabelSelectorParam,
        status: z.enum(['running', 'initializing', 'starting', 'stopping', 'off', 'deleting', 'migrating', 'rebuilding', 'unknown']).optional().describe('Filter by server status'),
        ...PaginationParams,
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('GET', '/servers', undefined, params))
  );

  // Get server
  server.registerTool(
    'hetzner_get_server',
    {
      title: 'Get Server',
      description: 'Get details of a specific server by ID.',
      inputSchema: z.object({
        id: IdSchema.describe('Server ID'),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('GET', `/servers/${params.id}`))
  );

  // Create server
  server.registerTool(
    'hetzner_create_server',
    {
      title: 'Create Server',
      description: 'Create a new server with the specified type, image, and configuration options.',
      inputSchema: z.object({
        name: z.string().describe('Name of the server'),
        server_type: z.string().describe('Server type name or ID (e.g. "cx22", "cpx11")'),
        image: z.string().describe('Image name or ID to use (e.g. "ubuntu-22.04", "debian-12")'),
        location: z.string().optional().describe('Location name (e.g. "fsn1", "nbg1", "hel1")'),
        ssh_keys: z.array(z.union([z.string(), z.number()])).optional().describe('SSH key names or IDs to inject'),
        networks: z.array(z.number()).optional().describe('Network IDs to attach the server to'),
        firewalls: z.array(z.object({
          firewall: z.number().describe('Firewall ID'),
        })).optional().describe('Firewalls to apply to the server'),
        user_data: z.string().optional().describe('Cloud-init user data (base64 or plain text)'),
        labels: LabelsSchema,
        placement_group: z.number().optional().describe('Placement group ID'),
        public_net: z.object({
          enable_ipv4: z.boolean().optional().describe('Enable public IPv4 address'),
          enable_ipv6: z.boolean().optional().describe('Enable public IPv6 address'),
          ipv4: z.number().optional().describe('Primary IP ID for IPv4'),
          ipv6: z.number().optional().describe('Primary IP ID for IPv6'),
        }).optional().describe('Public network configuration'),
        automount: z.boolean().optional().describe('Auto-mount volumes after attach'),
        start_after_create: z.boolean().optional().describe('Start server after creation (default: true)'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('POST', '/servers', params))
  );

  // Update server
  server.registerTool(
    'hetzner_update_server',
    {
      title: 'Update Server',
      description: 'Update a server\'s name or labels.',
      inputSchema: z.object({
        id: IdSchema.describe('Server ID'),
        name: z.string().optional().describe('New server name'),
        labels: LabelsSchema,
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return hetznerRequest('PUT', `/servers/${id}`, body);
    })
  );

  // Delete server
  server.registerTool(
    'hetzner_delete_server',
    {
      title: 'Delete Server',
      description: 'Permanently delete a server. This destroys the server and all associated data.',
      inputSchema: z.object({
        id: IdSchema.describe('Server ID'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('DELETE', `/servers/${params.id}`))
  );

  // Power on
  server.registerTool(
    'hetzner_power_on',
    {
      title: 'Power On Server',
      description: 'Start a stopped server by powering it on.',
      inputSchema: z.object({
        id: IdSchema.describe('Server ID'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('POST', `/servers/${params.id}/actions/poweron`))
  );

  // Power off
  server.registerTool(
    'hetzner_power_off',
    {
      title: 'Power Off Server',
      description: 'Force power off a server immediately. This is like pulling the power cord.',
      inputSchema: z.object({
        id: IdSchema.describe('Server ID'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('POST', `/servers/${params.id}/actions/poweroff`))
  );

  // Reboot
  server.registerTool(
    'hetzner_reboot',
    {
      title: 'Reboot Server',
      description: 'Send an ACPI reboot signal to the server for a soft reboot.',
      inputSchema: z.object({
        id: IdSchema.describe('Server ID'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('POST', `/servers/${params.id}/actions/reboot`))
  );

  // Reset
  server.registerTool(
    'hetzner_reset',
    {
      title: 'Reset Server',
      description: 'Perform a hard reset on the server, equivalent to pressing the reset button.',
      inputSchema: z.object({
        id: IdSchema.describe('Server ID'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('POST', `/servers/${params.id}/actions/reset`))
  );

  // Shutdown
  server.registerTool(
    'hetzner_shutdown',
    {
      title: 'Shutdown Server',
      description: 'Send an ACPI shutdown signal for a graceful OS shutdown.',
      inputSchema: z.object({
        id: IdSchema.describe('Server ID'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('POST', `/servers/${params.id}/actions/shutdown`))
  );

  // Rebuild server
  server.registerTool(
    'hetzner_rebuild_server',
    {
      title: 'Rebuild Server',
      description: 'Rebuild a server from an image, wiping all data on the server.',
      inputSchema: z.object({
        id: IdSchema.describe('Server ID'),
        image: z.string().describe('Image name or ID to rebuild from'),
        user_data: z.string().optional().describe('Cloud-init user data to apply to the rebuilt server. Overrides the value set at creation.'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return hetznerRequest('POST', `/servers/${id}/actions/rebuild`, body);
    })
  );

  // Resize server
  server.registerTool(
    'hetzner_resize_server',
    {
      title: 'Resize Server',
      description: 'Change the server type. The server will be stopped and migrated if needed.',
      inputSchema: z.object({
        id: IdSchema.describe('Server ID'),
        server_type: z.string().describe('Target server type name (e.g. "cx22")'),
        upgrade_disk: z.boolean().describe('Whether to upgrade the disk size (cannot be downgraded later)'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return hetznerRequest('POST', `/servers/${id}/actions/change_type`, body);
    })
  );

  // Enable rescue mode
  server.registerTool(
    'hetzner_enable_rescue',
    {
      title: 'Enable Rescue Mode',
      description: 'Enable rescue mode on a server. The server must be rebooted to enter rescue mode.',
      inputSchema: z.object({
        id: IdSchema.describe('Server ID'),
        type: z.enum(['linux64']).optional().describe('Rescue system type'),
        ssh_keys: z.array(z.number()).optional().describe('SSH key IDs to inject into rescue system'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return hetznerRequest('POST', `/servers/${id}/actions/enable_rescue`, body);
    })
  );

  // Disable rescue mode
  server.registerTool(
    'hetzner_disable_rescue',
    {
      title: 'Disable Rescue Mode',
      description: 'Disable rescue mode on a server. The next reboot will boot normally.',
      inputSchema: z.object({
        id: IdSchema.describe('Server ID'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('POST', `/servers/${params.id}/actions/disable_rescue`))
  );

  // Get server metrics
  server.registerTool(
    'hetzner_get_server_metrics',
    {
      title: 'Get Server Metrics',
      description: 'Retrieve time series metrics (CPU, disk, network) for a server over a time range.',
      inputSchema: z.object({
        id: IdSchema.describe('Server ID'),
        type: z.string().describe('Comma-separated metric types: "cpu", "disk", "network"'),
        start: z.string().describe('Start of period, ISO 8601 timestamp (e.g. "2025-01-01T00:00:00Z")'),
        end: z.string().describe('End of period, ISO 8601 timestamp (e.g. "2025-01-02T00:00:00Z")'),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...queryParams } = params;
      return hetznerRequest('GET', `/servers/${id}/metrics`, undefined, queryParams);
    })
  );

  // List server actions
  server.registerTool(
    'hetzner_list_server_actions',
    {
      title: 'List Server Actions',
      description: 'List all actions for a specific server, such as power changes and rebuilds.',
      inputSchema: z.object({
        id: IdSchema.describe('Server ID'),
        ...PaginationParams,
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...queryParams } = params;
      return hetznerRequest('GET', `/servers/${id}/actions`, undefined, queryParams);
    })
  );
}
