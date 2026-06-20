import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { storageBoxRequest } from '../services/hetzner.js';
import { handleToolRequest } from '../helpers.js';
import {
  IdSchema,
  PaginationParams,
  LabelSelectorParam,
  LabelsSchema,
  NameFilterParam,
  SortParam,
  ActionStatusFilterParam,
} from '../schemas/common.js';

// Access settings shared by Storage Boxes (the top-level protocol toggles).
const AccessSettingsSchema = z.object({
  reachable_externally: z.boolean().optional().describe('Whether the Storage Box is reachable from outside the Hetzner network'),
  samba_enabled: z.boolean().optional().describe('Whether Samba/CIFS access is enabled'),
  ssh_enabled: z.boolean().optional().describe('Whether SSH/SFTP/SCP access is enabled'),
  webdav_enabled: z.boolean().optional().describe('Whether WebDAV access is enabled'),
  zfs_enabled: z.boolean().optional().describe('Whether the ZFS snapshot directory is exposed'),
});

export function registerStorageBoxCoreTools(server: McpServer): void {
  // List Storage Boxes
  server.registerTool(
    'hetzner_list_storage_boxes',
    {
      title: 'List Storage Boxes',
      description: 'List all Storage Boxes in the project, with optional filtering by name or labels.',
      inputSchema: z.object({
        ...NameFilterParam,
        ...LabelSelectorParam,
        ...SortParam,
        ...PaginationParams,
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => storageBoxRequest('GET', '/storage_boxes', undefined, params))
  );

  // Create Storage Box
  server.registerTool(
    'hetzner_create_storage_box',
    {
      title: 'Create Storage Box',
      description: 'Create a new Storage Box in the given location and type. Billing applies for the provisioned resource.',
      inputSchema: z.object({
        name: z.string().describe('Name of the Storage Box'),
        storage_box_type: z.string().describe('ID or name of the Storage Box type, e.g. "bx20"'),
        location: z.string().describe('ID or name of the location, e.g. "fsn1"'),
        password: z.string().describe('Password for the Storage Box main account'),
        labels: LabelsSchema,
        ssh_keys: z.array(z.string()).optional().describe('SSH public keys in OpenSSH format to inject into the Storage Box'),
        access_settings: AccessSettingsSchema.optional().describe('Initial access settings for the Storage Box'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    handleToolRequest(async (params) => storageBoxRequest('POST', '/storage_boxes', params))
  );

  // Get Storage Box
  server.registerTool(
    'hetzner_get_storage_box',
    {
      title: 'Get Storage Box',
      description: 'Get details of a specific Storage Box by ID.',
      inputSchema: z.object({
        id: IdSchema.describe('Storage Box ID'),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => storageBoxRequest('GET', `/storage_boxes/${params.id}`))
  );

  // Update Storage Box
  server.registerTool(
    'hetzner_update_storage_box',
    {
      title: 'Update Storage Box',
      description: 'Update the name and/or labels of a Storage Box.',
      inputSchema: z.object({
        id: IdSchema.describe('Storage Box ID'),
        name: z.string().optional().describe('New name for the Storage Box'),
        labels: LabelsSchema,
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return storageBoxRequest('PUT', `/storage_boxes/${id}`, body);
    })
  );

  // Delete Storage Box
  server.registerTool(
    'hetzner_delete_storage_box',
    {
      title: 'Delete Storage Box',
      description: 'Delete a Storage Box and all of its data permanently. The Storage Box must not be delete-protected.',
      inputSchema: z.object({
        id: IdSchema.describe('Storage Box ID'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => storageBoxRequest('DELETE', `/storage_boxes/${params.id}`))
  );

  // List folders
  server.registerTool(
    'hetzner_list_storage_box_folders',
    {
      title: 'List Storage Box Folders',
      description: 'List the folders inside a Storage Box, optionally under a given path.',
      inputSchema: z.object({
        id: IdSchema.describe('Storage Box ID'),
        path: z.string().optional().describe('Directory path to list folders under (defaults to the root)'),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...queryParams } = params;
      return storageBoxRequest('GET', `/storage_boxes/${id}/folders`, undefined, queryParams);
    })
  );

  // List Storage Box actions
  server.registerTool(
    'hetzner_list_storage_box_actions',
    {
      title: 'List Storage Box Actions',
      description: 'List all actions performed on a specific Storage Box, such as type changes and password resets.',
      inputSchema: z.object({
        id: IdSchema.describe('Storage Box ID'),
        ...SortParam,
        ...ActionStatusFilterParam,
        ...PaginationParams,
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...queryParams } = params;
      return storageBoxRequest('GET', `/storage_boxes/${id}/actions`, undefined, queryParams);
    })
  );

  // Change protection
  server.registerTool(
    'hetzner_change_storage_box_protection',
    {
      title: 'Change Storage Box Protection',
      description: 'Enable or disable delete protection on a Storage Box to guard against accidental destruction.',
      inputSchema: z.object({
        id: IdSchema.describe('Storage Box ID'),
        delete: z.boolean().optional().describe('If true, prevents the Storage Box from being deleted'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return storageBoxRequest('POST', `/storage_boxes/${id}/actions/change_protection`, body);
    })
  );

  // Change type
  server.registerTool(
    'hetzner_change_storage_box_type',
    {
      title: 'Change Storage Box Type',
      description: 'Change the type (capacity tier) of a Storage Box. The new type must have at least the current usage capacity.',
      inputSchema: z.object({
        id: IdSchema.describe('Storage Box ID'),
        storage_box_type: z.string().describe('ID or name of the target Storage Box type, e.g. "bx30"'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return storageBoxRequest('POST', `/storage_boxes/${id}/actions/change_type`, body);
    })
  );

  // Reset password
  server.registerTool(
    'hetzner_reset_storage_box_password',
    {
      title: 'Reset Storage Box Password',
      description: 'Reset the password of a Storage Box main account to the supplied value.',
      inputSchema: z.object({
        id: IdSchema.describe('Storage Box ID'),
        password: z.string().describe('New password for the Storage Box main account'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return storageBoxRequest('POST', `/storage_boxes/${id}/actions/reset_password`, body);
    })
  );

  // Update access settings
  server.registerTool(
    'hetzner_update_storage_box_access_settings',
    {
      title: 'Update Storage Box Access Settings',
      description: 'Update which access protocols (SSH, Samba, WebDAV, ZFS, external reachability) are enabled on a Storage Box.',
      inputSchema: AccessSettingsSchema.extend({
        id: IdSchema.describe('Storage Box ID'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return storageBoxRequest('POST', `/storage_boxes/${id}/actions/update_access_settings`, body);
    })
  );

  // Rollback snapshot
  server.registerTool(
    'hetzner_rollback_storage_box_snapshot',
    {
      title: 'Rollback Storage Box Snapshot',
      description: 'Roll a Storage Box back to a snapshot. This overwrites current data with the snapshot contents.',
      inputSchema: z.object({
        id: IdSchema.describe('Storage Box ID'),
        snapshot: z.string().describe('Name of the snapshot to roll back to'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return storageBoxRequest('POST', `/storage_boxes/${id}/actions/rollback_snapshot`, body);
    })
  );

  // Enable snapshot plan
  server.registerTool(
    'hetzner_enable_storage_box_snapshot_plan',
    {
      title: 'Enable Storage Box Snapshot Plan',
      description: 'Enable or update the automatic snapshot plan for a Storage Box (schedule and retention).',
      inputSchema: z.object({
        id: IdSchema.describe('Storage Box ID'),
        max_snapshots: z.number().int().min(1).describe('Maximum number of automatic snapshots to retain'),
        minute: z.number().int().min(0).max(59).describe('Minute of the hour to run the snapshot (0-59)'),
        hour: z.number().int().min(0).max(23).describe('Hour of the day to run the snapshot (0-23, UTC)'),
        day_of_week: z.number().int().min(1).max(7).nullable().optional().describe('Day of week to run weekly (1=Monday .. 7=Sunday), or null'),
        day_of_month: z.number().int().min(1).max(31).nullable().optional().describe('Day of month to run monthly (1-31), or null'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return storageBoxRequest('POST', `/storage_boxes/${id}/actions/enable_snapshot_plan`, body);
    })
  );

  // Disable snapshot plan
  server.registerTool(
    'hetzner_disable_storage_box_snapshot_plan',
    {
      title: 'Disable Storage Box Snapshot Plan',
      description: 'Disable the automatic snapshot plan for a Storage Box. Existing snapshots are kept.',
      inputSchema: z.object({
        id: IdSchema.describe('Storage Box ID'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => storageBoxRequest('POST', `/storage_boxes/${params.id}/actions/disable_snapshot_plan`))
  );

  // List Storage Box types
  server.registerTool(
    'hetzner_list_storage_box_types',
    {
      title: 'List Storage Box Types',
      description: 'List all available Storage Box types with their capacity, limits, and pricing.',
      inputSchema: z.object({
        ...NameFilterParam,
        ...PaginationParams,
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => storageBoxRequest('GET', '/storage_box_types', undefined, params))
  );

  // Get Storage Box type
  server.registerTool(
    'hetzner_get_storage_box_type',
    {
      title: 'Get Storage Box Type',
      description: 'Get details of a specific Storage Box type by ID, including capacity and pricing.',
      inputSchema: z.object({
        id: IdSchema.describe('Storage Box type ID'),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => storageBoxRequest('GET', `/storage_box_types/${params.id}`))
  );
}
