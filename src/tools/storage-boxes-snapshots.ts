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

export function registerStorageBoxSnapshotTools(server: McpServer): void {
  // List snapshots
  server.registerTool(
    'hetzner_list_storage_box_snapshots',
    {
      title: 'List Storage Box Snapshots',
      description: 'List the snapshots of a Storage Box, with optional filtering by name, labels, or automatic-vs-manual.',
      inputSchema: z.object({
        id: IdSchema.describe('Storage Box ID'),
        ...NameFilterParam,
        ...LabelSelectorParam,
        ...SortParam,
        is_automatic: z.boolean().optional().describe('Filter by whether the snapshot was created by the snapshot plan'),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...queryParams } = params;
      return storageBoxRequest('GET', `/storage_boxes/${id}/snapshots`, undefined, queryParams);
    })
  );

  // Create snapshot
  server.registerTool(
    'hetzner_create_storage_box_snapshot',
    {
      title: 'Create Storage Box Snapshot',
      description: 'Create a manual snapshot of a Storage Box, optionally with a description and labels.',
      inputSchema: z.object({
        id: IdSchema.describe('Storage Box ID'),
        description: z.string().optional().describe('Human-readable description for the snapshot'),
        labels: LabelsSchema,
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return storageBoxRequest('POST', `/storage_boxes/${id}/snapshots`, body);
    })
  );

  // Get snapshot
  server.registerTool(
    'hetzner_get_storage_box_snapshot',
    {
      title: 'Get Storage Box Snapshot',
      description: 'Get details of a specific Storage Box snapshot by ID.',
      inputSchema: z.object({
        id: IdSchema.describe('Storage Box ID'),
        snapshot_id: IdSchema.describe('Snapshot ID'),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => storageBoxRequest('GET', `/storage_boxes/${params.id}/snapshots/${params.snapshot_id}`))
  );

  // Update snapshot
  server.registerTool(
    'hetzner_update_storage_box_snapshot',
    {
      title: 'Update Storage Box Snapshot',
      description: 'Update the description and/or labels of a Storage Box snapshot.',
      inputSchema: z.object({
        id: IdSchema.describe('Storage Box ID'),
        snapshot_id: IdSchema.describe('Snapshot ID'),
        description: z.string().optional().describe('New description for the snapshot'),
        labels: LabelsSchema,
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, snapshot_id, ...body } = params;
      return storageBoxRequest('PUT', `/storage_boxes/${id}/snapshots/${snapshot_id}`, body);
    })
  );

  // Delete snapshot
  server.registerTool(
    'hetzner_delete_storage_box_snapshot',
    {
      title: 'Delete Storage Box Snapshot',
      description: 'Delete a Storage Box snapshot permanently.',
      inputSchema: z.object({
        id: IdSchema.describe('Storage Box ID'),
        snapshot_id: IdSchema.describe('Snapshot ID'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => storageBoxRequest('DELETE', `/storage_boxes/${params.id}/snapshots/${params.snapshot_id}`))
  );
}
