import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { storageBoxRequest } from '../services/hetzner.js';
import { handleToolRequest } from '../helpers.js';
import {
  IdSchema,
  LabelSelectorParam,
  LabelsSchema,
  NameFilterParam,
  SortParam,
} from '../schemas/common.js';

// Access settings for a subaccount: a subset of the box protocol toggles plus
// a per-subaccount read-only flag. (The box-level toggle for ZFS does not apply.)
const SubaccountAccessSettingsSchema = z.object({
  readonly: z.boolean().optional().describe('Whether the subaccount has read-only access'),
  reachable_externally: z.boolean().optional().describe('Whether the subaccount is reachable from outside the Hetzner network'),
  samba_enabled: z.boolean().optional().describe('Whether Samba/CIFS access is enabled for the subaccount'),
  ssh_enabled: z.boolean().optional().describe('Whether SSH/SFTP/SCP access is enabled for the subaccount'),
  webdav_enabled: z.boolean().optional().describe('Whether WebDAV access is enabled for the subaccount'),
});

export function registerStorageBoxSubaccountTools(server: McpServer): void {
  // List subaccounts
  server.registerTool(
    'hetzner_list_storage_box_subaccounts',
    {
      title: 'List Storage Box Subaccounts',
      description: 'List the subaccounts of a Storage Box, with optional filtering by name, username, or labels.',
      inputSchema: z.object({
        id: IdSchema.describe('Storage Box ID'),
        ...NameFilterParam,
        username: z.string().optional().describe('Filter by subaccount username'),
        ...LabelSelectorParam,
        ...SortParam,
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...queryParams } = params;
      return storageBoxRequest('GET', `/storage_boxes/${id}/subaccounts`, undefined, queryParams);
    })
  );

  // Create subaccount
  server.registerTool(
    'hetzner_create_storage_box_subaccount',
    {
      title: 'Create Storage Box Subaccount',
      description: 'Create a subaccount on a Storage Box, scoped to a home directory with its own password and access settings.',
      inputSchema: z.object({
        id: IdSchema.describe('Storage Box ID'),
        home_directory: z.string().describe('Home directory the subaccount is scoped to, e.g. "/backups/web"'),
        password: z.string().describe('Password for the subaccount'),
        name: z.string().optional().describe('Optional display name for the subaccount'),
        description: z.string().optional().describe('Human-readable description for the subaccount'),
        labels: LabelsSchema,
        access_settings: SubaccountAccessSettingsSchema.optional().describe('Initial access settings for the subaccount'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return storageBoxRequest('POST', `/storage_boxes/${id}/subaccounts`, body);
    })
  );

  // Get subaccount
  server.registerTool(
    'hetzner_get_storage_box_subaccount',
    {
      title: 'Get Storage Box Subaccount',
      description: 'Get details of a specific Storage Box subaccount by ID.',
      inputSchema: z.object({
        id: IdSchema.describe('Storage Box ID'),
        subaccount_id: IdSchema.describe('Subaccount ID'),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => storageBoxRequest('GET', `/storage_boxes/${params.id}/subaccounts/${params.subaccount_id}`))
  );

  // Update subaccount
  server.registerTool(
    'hetzner_update_storage_box_subaccount',
    {
      title: 'Update Storage Box Subaccount',
      description: 'Update the name, description, and/or labels of a Storage Box subaccount.',
      inputSchema: z.object({
        id: IdSchema.describe('Storage Box ID'),
        subaccount_id: IdSchema.describe('Subaccount ID'),
        name: z.string().optional().describe('New display name for the subaccount'),
        description: z.string().optional().describe('New description for the subaccount'),
        labels: LabelsSchema,
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, subaccount_id, ...body } = params;
      return storageBoxRequest('PUT', `/storage_boxes/${id}/subaccounts/${subaccount_id}`, body);
    })
  );

  // Delete subaccount
  server.registerTool(
    'hetzner_delete_storage_box_subaccount',
    {
      title: 'Delete Storage Box Subaccount',
      description: 'Delete a Storage Box subaccount permanently. Its home directory contents are not removed.',
      inputSchema: z.object({
        id: IdSchema.describe('Storage Box ID'),
        subaccount_id: IdSchema.describe('Subaccount ID'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => storageBoxRequest('DELETE', `/storage_boxes/${params.id}/subaccounts/${params.subaccount_id}`))
  );

  // Change home directory
  server.registerTool(
    'hetzner_change_storage_box_subaccount_home_directory',
    {
      title: 'Change Storage Box Subaccount Home Directory',
      description: 'Change the home directory a Storage Box subaccount is scoped to.',
      inputSchema: z.object({
        id: IdSchema.describe('Storage Box ID'),
        subaccount_id: IdSchema.describe('Subaccount ID'),
        home_directory: z.string().describe('New home directory for the subaccount, e.g. "/backups/db"'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, subaccount_id, ...body } = params;
      return storageBoxRequest('POST', `/storage_boxes/${id}/subaccounts/${subaccount_id}/actions/change_home_directory`, body);
    })
  );

  // Reset subaccount password
  server.registerTool(
    'hetzner_reset_storage_box_subaccount_password',
    {
      title: 'Reset Storage Box Subaccount Password',
      description: 'Reset the password of a Storage Box subaccount to the supplied value.',
      inputSchema: z.object({
        id: IdSchema.describe('Storage Box ID'),
        subaccount_id: IdSchema.describe('Subaccount ID'),
        password: z.string().describe('New password for the subaccount'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, subaccount_id, ...body } = params;
      return storageBoxRequest('POST', `/storage_boxes/${id}/subaccounts/${subaccount_id}/actions/reset_subaccount_password`, body);
    })
  );

  // Update subaccount access settings
  server.registerTool(
    'hetzner_update_storage_box_subaccount_access_settings',
    {
      title: 'Update Storage Box Subaccount Access Settings',
      description: 'Update the access settings (read-only, SSH, Samba, WebDAV, external reachability) of a Storage Box subaccount.',
      inputSchema: SubaccountAccessSettingsSchema.extend({
        id: IdSchema.describe('Storage Box ID'),
        subaccount_id: IdSchema.describe('Subaccount ID'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, subaccount_id, ...body } = params;
      return storageBoxRequest('POST', `/storage_boxes/${id}/subaccounts/${subaccount_id}/actions/update_access_settings`, body);
    })
  );
}
