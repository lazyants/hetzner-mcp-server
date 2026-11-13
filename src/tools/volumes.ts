import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { hetznerRequest } from '../services/hetzner.js';
import { handleToolRequest } from '../helpers.js';
import { IdSchema, PaginationParams, LabelSelectorParam, LabelsSchema, SortParam, ActionStatusFilterParam } from '../schemas/common.js';

const VolumeAssigneeSchema = z.object({
  id: IdSchema.describe('ID of the resource'),
  type: z.literal('server').describe('Type of the resource (currently only "server")'),
});

type VolumeAssignee = z.infer<typeof VolumeAssigneeSchema>;

// Hetzner deprecated the volume `server` request property on 2026-10-27 and removes it on
// 2027-10-27. The MCP `server` input stays as an alias, but only `assignee` is sent.
function resolveVolumeAssignee(server: number | undefined, assignee: VolumeAssignee | undefined): VolumeAssignee | undefined {
  if (server !== undefined && assignee !== undefined) {
    throw new Error('Provide either assignee or server, not both');
  }
  return assignee ?? (server === undefined ? undefined : { id: server, type: 'server' });
}

export function registerVolumeTools(server: McpServer): void {
  // List volumes
  server.registerTool(
    'hetzner_list_volumes',
    {
      title: 'List Volumes',
      description: 'List all volumes in the project, with optional filtering by name, label, or status.',
      inputSchema: z.object({
        name: z.string().optional().describe('Filter by volume name'),
        ...SortParam,
        ...LabelSelectorParam,
        status: z.enum(['creating', 'available']).optional().describe('Filter by volume status'),
        ...PaginationParams,
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('GET', '/volumes', undefined, params))
  );

  // Get volume
  server.registerTool(
    'hetzner_get_volume',
    {
      title: 'Get Volume',
      description: 'Get details of a specific volume by ID.',
      inputSchema: z.object({
        id: IdSchema.describe('Volume ID'),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('GET', `/volumes/${params.id}`))
  );

  // Create volume
  server.registerTool(
    'hetzner_create_volume',
    {
      title: 'Create Volume',
      description: 'Create a new volume. Either location or assignee must be provided to determine placement.',
      inputSchema: z.object({
        name: z.string().describe('Name of the volume'),
        size: z.number().int().positive().describe('Size of the volume in GB'),
        location: z.string().optional().describe('Location name (e.g. "fsn1"). Required if no assignee is set'),
        assignee: VolumeAssigneeSchema.optional().describe('Resource to attach the volume to once created; the volume is created in its location'),
        server: z.number().int().positive().optional().describe('Deprecated alias for assignee {id: server, type: "server"}; do not combine with assignee'),
        format: z.enum(['ext4', 'xfs']).optional().describe('Filesystem format for the volume'),
        automount: z.boolean().optional().describe('Auto-mount the volume after attaching it to the assignee'),
        labels: LabelsSchema,
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { server: legacyServer, assignee, ...body } = params;
      const target = resolveVolumeAssignee(legacyServer, assignee);
      return hetznerRequest('POST', '/volumes', target ? { ...body, assignee: target } : body);
    })
  );

  // Update volume
  server.registerTool(
    'hetzner_update_volume',
    {
      title: 'Update Volume',
      description: 'Update a volume\'s name or labels.',
      inputSchema: z.object({
        id: IdSchema.describe('Volume ID'),
        name: z.string().optional().describe('New volume name'),
        labels: LabelsSchema,
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return hetznerRequest('PUT', `/volumes/${id}`, body);
    })
  );

  // Delete volume
  server.registerTool(
    'hetzner_delete_volume',
    {
      title: 'Delete Volume',
      description: 'Delete a volume permanently. The volume must be detached from any server.',
      inputSchema: z.object({
        id: IdSchema.describe('Volume ID'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('DELETE', `/volumes/${params.id}`))
  );

  // Attach volume
  server.registerTool(
    'hetzner_attach_volume',
    {
      title: 'Attach Volume',
      description: 'Attach a volume to a resource such as a server. The resource and volume must be in the same location.',
      inputSchema: z.object({
        id: IdSchema.describe('Volume ID'),
        assignee: VolumeAssigneeSchema.optional().describe('Resource to attach the volume to; required unless the deprecated server is set'),
        server: z.number().int().positive().optional().describe('Deprecated alias for assignee {id: server, type: "server"}; do not combine with assignee'),
        automount: z.boolean().optional().describe('Auto-mount the volume after attaching'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, server: legacyServer, assignee, ...body } = params;
      const target = resolveVolumeAssignee(legacyServer, assignee);
      if (!target) throw new Error('Provide assignee (or the deprecated server) to attach the volume to');
      return hetznerRequest('POST', `/volumes/${id}/actions/attach`, { ...body, assignee: target });
    })
  );

  // Detach volume
  server.registerTool(
    'hetzner_detach_volume',
    {
      title: 'Detach Volume',
      description: 'Detach a volume from the server it is attached to.',
      inputSchema: z.object({
        id: IdSchema.describe('Volume ID'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('POST', `/volumes/${params.id}/actions/detach`))
  );

  // Resize volume
  server.registerTool(
    'hetzner_resize_volume',
    {
      title: 'Resize Volume',
      description: 'Increase the size of a volume. Volumes can only be made larger, not smaller.',
      inputSchema: z.object({
        id: IdSchema.describe('Volume ID'),
        size: z.number().int().positive().describe('New size of the volume in GB (must be larger than current size)'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return hetznerRequest('POST', `/volumes/${id}/actions/resize`, body);
    })
  );

  // Change volume protection
  server.registerTool(
    'hetzner_change_volume_protection',
    {
      title: 'Change Volume Protection',
      description: 'Enable or disable delete protection on a volume to guard against accidental destruction.',
      inputSchema: z.object({
        id: IdSchema.describe('Volume ID'),
        delete: z.boolean().optional().describe('If true, prevents the volume from being deleted'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return hetznerRequest('POST', `/volumes/${id}/actions/change_protection`, body);
    })
  );

  // List volume actions
  server.registerTool(
    'hetzner_list_volume_actions',
    {
      title: 'List Volume Actions',
      description: 'List all actions performed on a specific volume, such as attach, detach, and resize operations.',
      inputSchema: z.object({
        id: IdSchema.describe('Volume ID'),
        ...SortParam,
        ...ActionStatusFilterParam,
        ...PaginationParams,
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...queryParams } = params;
      return hetznerRequest('GET', `/volumes/${id}/actions`, undefined, queryParams);
    })
  );
}
