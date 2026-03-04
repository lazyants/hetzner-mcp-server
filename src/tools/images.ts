import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { hetznerRequest } from '../services/hetzner.js';
import { handleToolRequest } from '../helpers.js';
import { IdSchema, PaginationParams, LabelSelectorParam, LabelsSchema, SortParam } from '../schemas/common.js';

export function registerImageTools(server: McpServer): void {
  // List images
  server.registerTool(
    'hetzner_list_images',
    {
      title: 'List Images',
      description: 'List all available images, including system, snapshot, and backup images.',
      inputSchema: z.object({
        type: z.enum(['system', 'snapshot', 'backup', 'app']).optional().describe('Filter by image type'),
        status: z.enum(['available', 'creating', 'unavailable']).optional().describe('Filter by image status'),
        architecture: z.enum(['x86', 'arm']).optional().describe('Filter by CPU architecture'),
        name: z.string().optional().describe('Filter by image name'),
        ...LabelSelectorParam,
        ...SortParam,
        ...PaginationParams,
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('GET', '/images', undefined, params))
  );

  // Get image
  server.registerTool(
    'hetzner_get_image',
    {
      title: 'Get Image',
      description: 'Get details of a specific image by ID.',
      inputSchema: z.object({
        id: IdSchema.describe('Image ID'),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('GET', `/images/${params.id}`))
  );

  // Update image
  server.registerTool(
    'hetzner_update_image',
    {
      title: 'Update Image',
      description: 'Update an image\'s description, type, or labels.',
      inputSchema: z.object({
        id: IdSchema.describe('Image ID'),
        description: z.string().optional().describe('New image description'),
        type: z.enum(['snapshot']).optional().describe('Image type (only snapshot allowed for conversion)'),
        labels: LabelsSchema,
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return hetznerRequest('PUT', `/images/${id}`, body);
    })
  );

  // Delete image
  server.registerTool(
    'hetzner_delete_image',
    {
      title: 'Delete Image',
      description: 'Permanently delete a snapshot or backup image.',
      inputSchema: z.object({
        id: IdSchema.describe('Image ID'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('DELETE', `/images/${params.id}`))
  );

  // Create image (snapshot from server)
  server.registerTool(
    'hetzner_create_image',
    {
      title: 'Create Image',
      description: 'Create a snapshot image from an existing server.',
      inputSchema: z.object({
        server_id: IdSchema.describe('Server ID to create the image from'),
        type: z.enum(['snapshot', 'backup']).optional().describe('Image type (default: snapshot)'),
        description: z.string().optional().describe('Image description'),
        labels: LabelsSchema,
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { server_id, ...body } = params;
      return hetznerRequest('POST', `/servers/${server_id}/actions/create_image`, body);
    })
  );
}
