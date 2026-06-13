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

  // Change server protection
  server.registerTool(
    'hetzner_change_server_protection',
    {
      title: 'Change Server Protection',
      description: 'Enable or disable delete and rebuild protection on a server to guard against accidental destruction.',
      inputSchema: z.object({
        id: IdSchema.describe('Server ID'),
        delete: z.boolean().optional().describe('If true, prevents the server from being deleted'),
        rebuild: z.boolean().optional().describe('If true, prevents the server from being rebuilt'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return hetznerRequest('POST', `/servers/${id}/actions/change_protection`, body);
    })
  );

  // Request console
  server.registerTool(
    'hetzner_request_console',
    {
      title: 'Request Server Console',
      description: 'Request a noVNC WebSocket URL and credentials to access the server console. The URL is valid for a limited time.',
      inputSchema: z.object({
        id: IdSchema.describe('Server ID'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('POST', `/servers/${params.id}/actions/request_console`))
  );

  // Enable backup
  server.registerTool(
    'hetzner_enable_backup',
    {
      title: 'Enable Server Backup',
      description: 'Enable automatic daily backups for a server. Backups increase the server price by 20 percent. The backup window is chosen automatically.',
      inputSchema: z.object({
        id: IdSchema.describe('Server ID'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('POST', `/servers/${params.id}/actions/enable_backup`))
  );

  // Disable backup
  server.registerTool(
    'hetzner_disable_backup',
    {
      title: 'Disable Server Backup',
      description: 'Disable automatic backups for a server and remove all existing backup snapshots.',
      inputSchema: z.object({
        id: IdSchema.describe('Server ID'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('POST', `/servers/${params.id}/actions/disable_backup`))
  );

  // Change alias IPs
  server.registerTool(
    'hetzner_change_alias_ips',
    {
      title: 'Change Server Alias IPs',
      description: 'Replace the alias IPs that a server has on a private network. The list overrides any existing alias IPs for that network.',
      inputSchema: z.object({
        id: IdSchema.describe('Server ID'),
        network: z.number().int().positive().describe('ID of the network the server is attached to'),
        alias_ips: z.array(z.string()).describe('Full list of alias IPs to set on the network (replaces existing). Pass [] to clear.'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return hetznerRequest('POST', `/servers/${id}/actions/change_alias_ips`, body);
    })
  );

  // Change server reverse DNS
  server.registerTool(
    'hetzner_change_dns_ptr',
    {
      title: 'Change Server Reverse DNS',
      description: 'Change the reverse DNS entry for one of a server\'s public IPv4 or IPv6 addresses. Set dns_ptr to null to reset to the default.',
      inputSchema: z.object({
        id: IdSchema.describe('Server ID'),
        ip: z.string().describe('Public IPv4 or IPv6 address of the server to set the reverse DNS entry for'),
        dns_ptr: z.string().nullable().describe('Reverse DNS PTR record value, or null to reset to the default'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return hetznerRequest('POST', `/servers/${id}/actions/change_dns_ptr`, body);
    })
  );

  // Attach server to network
  server.registerTool(
    'hetzner_attach_server_to_network',
    {
      title: 'Attach Server to Network',
      description: 'Attach a server to a private network, optionally assigning a specific IP, alias IPs, or IP range.',
      inputSchema: z.object({
        id: IdSchema.describe('Server ID'),
        network: z.number().int().positive().describe('ID of the network to attach the server to'),
        ip: z.string().optional().describe('Private IP to assign the server in the network (within the network IP range)'),
        alias_ips: z.array(z.string()).optional().describe('Additional alias IPs to assign the server on the network'),
        ip_range: z.string().optional().describe('Subnet IP range (CIDR) to attach to, e.g. "10.0.1.0/24"'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return hetznerRequest('POST', `/servers/${id}/actions/attach_to_network`, body);
    })
  );

  // Detach server from network
  server.registerTool(
    'hetzner_detach_server_from_network',
    {
      title: 'Detach Server from Network',
      description: 'Detach a server from a private network, removing its private connectivity on that network.',
      inputSchema: z.object({
        id: IdSchema.describe('Server ID'),
        network: z.number().int().positive().describe('ID of the network to detach the server from'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return hetznerRequest('POST', `/servers/${id}/actions/detach_from_network`, body);
    })
  );

  // Add server to placement group
  server.registerTool(
    'hetzner_add_server_to_placement_group',
    {
      title: 'Add Server to Placement Group',
      description: 'Add a server to a placement group. The server must be powered off before it can be added.',
      inputSchema: z.object({
        id: IdSchema.describe('Server ID'),
        placement_group: z.number().int().positive().describe('ID of the placement group to add the server to'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return hetznerRequest('POST', `/servers/${id}/actions/add_to_placement_group`, body);
    })
  );

  // Remove server from placement group
  server.registerTool(
    'hetzner_remove_server_from_placement_group',
    {
      title: 'Remove Server from Placement Group',
      description: 'Remove a server from its placement group.',
      inputSchema: z.object({
        id: IdSchema.describe('Server ID'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('POST', `/servers/${params.id}/actions/remove_from_placement_group`))
  );

  // Reset server root password
  server.registerTool(
    'hetzner_reset_server_password',
    {
      title: 'Reset Server Root Password',
      description: 'Reset the root password of a server. The server is rebooted and a new root password is returned in the result.',
      inputSchema: z.object({
        id: IdSchema.describe('Server ID'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('POST', `/servers/${params.id}/actions/reset_password`))
  );
}
