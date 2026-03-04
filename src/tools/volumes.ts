import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { hetznerRequest } from '../services/hetzner.js';
import { handleToolRequest } from '../helpers.js';
import { IdSchema, PaginationParams, LabelSelectorParam, LabelsSchema } from '../schemas/common.js';

export function registerVolumeTools(server: McpServer): void {
  // List volumes
  server.registerTool(
    'hetzner_list_volumes',
    {
      title: 'List Volumes',
      description: 'List all volumes in the project, with optional filtering by name, label, or status.',
      inputSchema: z.object({
        name: z.string().optional().describe('Filter by volume name'),
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
      description: 'Create a new volume. Either location or server must be provided to determine placement.',
      inputSchema: z.object({
        name: z.string().describe('Name of the volume'),
        size: z.number().int().positive().describe('Size of the volume in GB'),
        location: z.string().optional().describe('Location name (e.g. "fsn1"). Required if server is not set'),
        server: z.number().int().positive().optional().describe('Server ID to attach the volume to. Required if location is not set'),
        format: z.enum(['ext4', 'xfs']).optional().describe('Filesystem format for the volume'),
        automount: z.boolean().optional().describe('Auto-mount the volume after attaching to a server'),
        labels: LabelsSchema,
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('POST', '/volumes', params))
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
      description: 'Attach a volume to a server. The server and volume must be in the same location.',
      inputSchema: z.object({
        id: IdSchema.describe('Volume ID'),
        server: z.number().int().positive().describe('Server ID to attach the volume to'),
        automount: z.boolean().optional().describe('Auto-mount the volume after attaching'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return hetznerRequest('POST', `/volumes/${id}/actions/attach`, body);
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
}
