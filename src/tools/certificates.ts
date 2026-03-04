import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { hetznerRequest } from '../services/hetzner.js';
import { handleToolRequest } from '../helpers.js';
import { IdSchema, PaginationParams, LabelSelectorParam, LabelsSchema, NameFilterParam } from '../schemas/common.js';

export function registerCertificateTools(server: McpServer): void {
  server.registerTool(
    'hetzner_list_certificates',
    {
      title: 'List Certificates',
      description: 'List all SSL/TLS certificates in the project, with optional filtering.',
      inputSchema: z.object({
        ...NameFilterParam,
        ...LabelSelectorParam,
        type: z.enum(['uploaded', 'managed']).optional().describe('Filter by certificate type'),
        ...PaginationParams,
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('GET', '/certificates', undefined, params))
  );

  server.registerTool(
    'hetzner_get_certificate',
    {
      title: 'Get Certificate',
      description: 'Get details of a specific certificate by its ID.',
      inputSchema: z.object({
        id: IdSchema,
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('GET', `/certificates/${params.id}`))
  );

  server.registerTool(
    'hetzner_create_certificate',
    {
      title: 'Create Certificate',
      description: 'Create an uploaded certificate (provide PEM data) or a managed certificate (provide domain names).',
      inputSchema: z.object({
        name: z.string().describe('Name of the certificate'),
        type: z.enum(['uploaded', 'managed']).optional().describe('Certificate type (default: uploaded)'),
        certificate: z.string().optional().describe('PEM-encoded certificate (required for uploaded type)'),
        private_key: z.string().optional().describe('PEM-encoded private key (required for uploaded type)'),
        domain_names: z.array(z.string()).optional().describe('Domain names (required for managed type)'),
        labels: LabelsSchema,
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('POST', '/certificates', params))
  );

  server.registerTool(
    'hetzner_update_certificate',
    {
      title: 'Update Certificate',
      description: 'Update a certificate name or labels.',
      inputSchema: z.object({
        id: IdSchema,
        name: z.string().optional().describe('New name for the certificate'),
        labels: LabelsSchema,
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return hetznerRequest('PUT', `/certificates/${id}`, body);
    })
  );

  server.registerTool(
    'hetzner_delete_certificate',
    {
      title: 'Delete Certificate',
      description: 'Delete a certificate. It must not be in use by any load balancer.',
      inputSchema: z.object({
        id: IdSchema,
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('DELETE', `/certificates/${params.id}`))
  );

  server.registerTool(
    'hetzner_retry_certificate',
    {
      title: 'Retry Certificate Issuance',
      description: 'Retry issuance or renewal of a managed certificate that has failed.',
      inputSchema: z.object({
        id: IdSchema,
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('POST', `/certificates/${params.id}/actions/retry`))
  );
}
