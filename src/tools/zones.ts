import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { hetznerRequest } from '../services/hetzner.js';
import { handleToolRequest } from '../helpers.js';
import {
  IdOrNameSchema,
  PaginationParams,
  LabelSelectorParam,
  LabelsSchema,
  NameFilterParam,
  SortParam,
  ActionStatusFilterParam,
  pathSeg,
} from '../schemas/common.js';
import { ZONE_RRSET_TYPES } from '../types/zones.js';

const RRSetTypeSchema = z.enum(ZONE_RRSET_TYPES).describe('DNS record type (A, AAAA, CNAME, MX, NS, TXT, etc.)');

const PrimaryNameserverSchema = z.object({
  address: z.string().describe('IPv4 or IPv6 address of the primary nameserver, optionally with :port'),
  port: z.number().int().min(1).max(65535).optional().describe('DNS port (default 53)'),
  tsig_algorithm: z.string().optional().describe('TSIG algorithm name, e.g. "hmac-sha256"'),
  tsig_key: z.string().optional().describe('TSIG key as base64'),
});

const RRSetRecordSchema = z.object({
  value: z.string().describe('Record value, e.g. "1.2.3.4" or "10 mail.example.com."'),
  comment: z.string().optional().describe('Optional human-readable comment for this record'),
});

export function registerDnsZoneTools(server: McpServer): void {
  // List zones
  server.registerTool(
    'hetzner_list_zones',
    {
      title: 'List DNS Zones',
      description: 'List all DNS zones in the project, with optional filtering by name, mode (primary/secondary), or labels.',
      inputSchema: z.object({
        ...NameFilterParam,
        mode: z.enum(['primary', 'secondary']).optional().describe('Filter by zone mode'),
        ...LabelSelectorParam,
        ...SortParam,
        ...PaginationParams,
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('GET', '/zones', undefined, params))
  );

  // Get zone
  server.registerTool(
    'hetzner_get_zone',
    {
      title: 'Get DNS Zone',
      description: 'Get details of a specific DNS zone by its numeric ID or zone name (e.g. "example.com").',
      inputSchema: z.object({
        id_or_name: IdOrNameSchema.describe('Zone ID or name'),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('GET', `/zones/${pathSeg(params.id_or_name)}`))
  );

  // Create zone
  server.registerTool(
    'hetzner_create_zone',
    {
      title: 'Create DNS Zone',
      description: 'Create a new DNS zone in primary or secondary mode. Optionally provide TTL, primary nameservers (for secondary), initial RRSets, or a zonefile.',
      inputSchema: z.object({
        name: z.string().describe('Fully qualified domain name of the zone, e.g. "example.com"'),
        mode: z.enum(['primary', 'secondary']).describe('Zone mode: "primary" (managed here) or "secondary" (transferred from external primary)'),
        ttl: z.number().int().min(0).optional().describe('Default TTL in seconds for records in this zone'),
        labels: LabelsSchema,
        primary_nameservers: z.array(PrimaryNameserverSchema).optional().describe('Primary nameservers (required for secondary zones)'),
        rrsets: z.array(z.object({
          type: RRSetTypeSchema,
          name: z.string().describe('RRSet name (e.g. "@", "www", "_acme-challenge")'),
          ttl: z.number().int().min(0).optional().describe('TTL in seconds for this RRSet'),
          labels: LabelsSchema,
          records: z.array(RRSetRecordSchema).optional().describe('Records belonging to this RRSet'),
        })).optional().describe('Initial RRSets to create with the zone'),
        zonefile: z.string().optional().describe('Initial zone content in RFC 1035 zonefile format (alternative to rrsets)'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('POST', '/zones', params))
  );

  // Update zone
  server.registerTool(
    'hetzner_update_zone',
    {
      title: 'Update DNS Zone',
      description: 'Update a DNS zone\'s labels. Other zone properties are managed via dedicated change_* action tools.',
      inputSchema: z.object({
        id_or_name: IdOrNameSchema.describe('Zone ID or name'),
        labels: LabelsSchema,
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id_or_name, ...body } = params;
      return hetznerRequest('PUT', `/zones/${pathSeg(id_or_name)}`, body);
    })
  );

  // Delete zone
  server.registerTool(
    'hetzner_delete_zone',
    {
      title: 'Delete DNS Zone',
      description: 'Delete a DNS zone and all of its RRSets permanently. The zone must not be delete-protected.',
      inputSchema: z.object({
        id_or_name: IdOrNameSchema.describe('Zone ID or name'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('DELETE', `/zones/${pathSeg(params.id_or_name)}`))
  );

  // Export zonefile
  server.registerTool(
    'hetzner_export_zonefile',
    {
      title: 'Export DNS Zonefile',
      description: 'Export the current contents of a DNS zone as an RFC 1035 zonefile string.',
      inputSchema: z.object({
        id_or_name: IdOrNameSchema.describe('Zone ID or name'),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('GET', `/zones/${pathSeg(params.id_or_name)}/zonefile`))
  );

  // Import zonefile
  server.registerTool(
    'hetzner_import_zonefile',
    {
      title: 'Import DNS Zonefile',
      description: 'Replace the contents of a DNS zone with the given RFC 1035 zonefile. This overwrites all existing RRSets.',
      inputSchema: z.object({
        id_or_name: IdOrNameSchema.describe('Zone ID or name'),
        zonefile: z.string().describe('Full zone content in RFC 1035 zonefile format'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id_or_name, ...body } = params;
      return hetznerRequest('POST', `/zones/${pathSeg(id_or_name)}/actions/import_zonefile`, body);
    })
  );

  // Change zone protection
  server.registerTool(
    'hetzner_change_zone_protection',
    {
      title: 'Change DNS Zone Protection',
      description: 'Enable or disable delete protection on a DNS zone to guard against accidental destruction.',
      inputSchema: z.object({
        id_or_name: IdOrNameSchema.describe('Zone ID or name'),
        delete: z.boolean().optional().describe('If true, prevents the zone from being deleted'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id_or_name, ...body } = params;
      return hetznerRequest('POST', `/zones/${pathSeg(id_or_name)}/actions/change_protection`, body);
    })
  );

  // Change zone TTL
  server.registerTool(
    'hetzner_change_zone_ttl',
    {
      title: 'Change DNS Zone Default TTL',
      description: 'Change the default TTL applied to records in a DNS zone that do not have an explicit TTL.',
      inputSchema: z.object({
        id_or_name: IdOrNameSchema.describe('Zone ID or name'),
        ttl: z.number().int().min(0).describe('New default TTL in seconds'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id_or_name, ...body } = params;
      return hetznerRequest('POST', `/zones/${pathSeg(id_or_name)}/actions/change_ttl`, body);
    })
  );

  // Change zone primary nameservers (secondary zones)
  server.registerTool(
    'hetzner_change_zone_primary_nameservers',
    {
      title: 'Change DNS Zone Primary Nameservers',
      description: 'Replace the list of primary nameservers used by a secondary DNS zone for AXFR/IXFR transfers.',
      inputSchema: z.object({
        id_or_name: IdOrNameSchema.describe('Zone ID or name'),
        primary_nameservers: z.array(PrimaryNameserverSchema).min(1).describe('New full list of primary nameservers'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id_or_name, ...body } = params;
      return hetznerRequest('POST', `/zones/${pathSeg(id_or_name)}/actions/change_primary_nameservers`, body);
    })
  );

  // List zone actions
  server.registerTool(
    'hetzner_list_zone_actions',
    {
      title: 'List DNS Zone Actions',
      description: 'List all actions performed on a specific DNS zone, such as imports, TTL changes, and protection toggles.',
      inputSchema: z.object({
        id_or_name: IdOrNameSchema.describe('Zone ID or name'),
        ...SortParam,
        ...ActionStatusFilterParam,
        ...PaginationParams,
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id_or_name, ...queryParams } = params;
      return hetznerRequest('GET', `/zones/${pathSeg(id_or_name)}/actions`, undefined, queryParams);
    })
  );

  // ---------------------------------------------------------------------------
  // RRSet operations
  // ---------------------------------------------------------------------------

  // List RRSets in a zone
  server.registerTool(
    'hetzner_list_zone_rrsets',
    {
      title: 'List DNS Zone RRSets',
      description: 'List all RRSets in a DNS zone, with optional filtering by name, type, or labels.',
      inputSchema: z.object({
        id_or_name: IdOrNameSchema.describe('Zone ID or name'),
        ...NameFilterParam,
        type: z.array(RRSetTypeSchema).optional().describe('Filter by one or more record types'),
        ...LabelSelectorParam,
        ...SortParam,
        ...PaginationParams,
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id_or_name, ...queryParams } = params;
      return hetznerRequest('GET', `/zones/${pathSeg(id_or_name)}/rrsets`, undefined, queryParams);
    })
  );

  // Get RRSet
  server.registerTool(
    'hetzner_get_zone_rrset',
    {
      title: 'Get DNS Zone RRSet',
      description: 'Get a specific RRSet by zone, name, and record type.',
      inputSchema: z.object({
        id_or_name: IdOrNameSchema.describe('Zone ID or name'),
        name: z.string().describe('RRSet name (e.g. "@", "www", "_acme-challenge")'),
        type: RRSetTypeSchema,
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const rrsetName = pathSeg(params.name);
      return hetznerRequest('GET', `/zones/${pathSeg(params.id_or_name)}/rrsets/${rrsetName}/${params.type}`);
    })
  );

  // Create RRSet
  server.registerTool(
    'hetzner_create_zone_rrset',
    {
      title: 'Create DNS Zone RRSet',
      description: 'Create a new RRSet (record set) inside a DNS zone.',
      inputSchema: z.object({
        id_or_name: IdOrNameSchema.describe('Zone ID or name'),
        name: z.string().describe('RRSet name (e.g. "@", "www", "_acme-challenge")'),
        type: RRSetTypeSchema,
        ttl: z.number().int().min(0).optional().describe('TTL in seconds for records in this RRSet'),
        labels: LabelsSchema,
        records: z.array(RRSetRecordSchema).optional().describe('Records belonging to this RRSet'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id_or_name, ...body } = params;
      return hetznerRequest('POST', `/zones/${pathSeg(id_or_name)}/rrsets`, body);
    })
  );

  // Update RRSet
  server.registerTool(
    'hetzner_update_zone_rrset',
    {
      title: 'Update DNS Zone RRSet',
      description: 'Update an RRSet\'s labels. Records and TTL are managed via dedicated action tools.',
      inputSchema: z.object({
        id_or_name: IdOrNameSchema.describe('Zone ID or name'),
        name: z.string().describe('RRSet name'),
        type: RRSetTypeSchema,
        labels: LabelsSchema,
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id_or_name, name, type, ...body } = params;
      const rrsetName = pathSeg(name);
      return hetznerRequest('PUT', `/zones/${pathSeg(id_or_name)}/rrsets/${rrsetName}/${type}`, body);
    })
  );

  // Delete RRSet
  server.registerTool(
    'hetzner_delete_zone_rrset',
    {
      title: 'Delete DNS Zone RRSet',
      description: 'Delete an RRSet from a DNS zone permanently. The RRSet must not be change-protected.',
      inputSchema: z.object({
        id_or_name: IdOrNameSchema.describe('Zone ID or name'),
        name: z.string().describe('RRSet name'),
        type: RRSetTypeSchema,
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const rrsetName = pathSeg(params.name);
      return hetznerRequest('DELETE', `/zones/${pathSeg(params.id_or_name)}/rrsets/${rrsetName}/${params.type}`);
    })
  );

  // Change RRSet protection
  server.registerTool(
    'hetzner_change_zone_rrset_protection',
    {
      title: 'Change DNS Zone RRSet Protection',
      description: 'Enable or disable change protection on an RRSet to guard against accidental modification or deletion.',
      inputSchema: z.object({
        id_or_name: IdOrNameSchema.describe('Zone ID or name'),
        name: z.string().describe('RRSet name'),
        type: RRSetTypeSchema,
        change: z.boolean().optional().describe('If true, prevents the RRSet from being modified or deleted'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id_or_name, name, type, ...body } = params;
      const rrsetName = pathSeg(name);
      return hetznerRequest('POST', `/zones/${pathSeg(id_or_name)}/rrsets/${rrsetName}/${type}/actions/change_protection`, body);
    })
  );

  // Change RRSet TTL
  server.registerTool(
    'hetzner_change_zone_rrset_ttl',
    {
      title: 'Change DNS Zone RRSet TTL',
      description: 'Change the TTL of an RRSet. Pass ttl=null to fall back to the zone default TTL.',
      inputSchema: z.object({
        id_or_name: IdOrNameSchema.describe('Zone ID or name'),
        name: z.string().describe('RRSet name'),
        type: RRSetTypeSchema,
        ttl: z.number().int().min(0).nullable().describe('New TTL in seconds, or null to fall back to the zone default'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id_or_name, name, type, ...body } = params;
      const rrsetName = pathSeg(name);
      return hetznerRequest('POST', `/zones/${pathSeg(id_or_name)}/rrsets/${rrsetName}/${type}/actions/change_ttl`, body);
    })
  );

  // Set RRSet records (replace full record list)
  server.registerTool(
    'hetzner_set_zone_rrset_records',
    {
      title: 'Set DNS Zone RRSet Records',
      description: 'Replace the full list of records in an RRSet. Existing records not in the payload are removed.',
      inputSchema: z.object({
        id_or_name: IdOrNameSchema.describe('Zone ID or name'),
        name: z.string().describe('RRSet name'),
        type: RRSetTypeSchema,
        records: z.array(RRSetRecordSchema).min(1).describe('Full replacement list of records for this RRSet'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id_or_name, name, type, ...body } = params;
      const rrsetName = pathSeg(name);
      return hetznerRequest('POST', `/zones/${pathSeg(id_or_name)}/rrsets/${rrsetName}/${type}/actions/set_records`, body);
    })
  );

  // Add RRSet records
  server.registerTool(
    'hetzner_add_zone_rrset_records',
    {
      title: 'Add Records to DNS Zone RRSet',
      description: 'Add new records to an existing RRSet without removing existing ones. Optionally update the RRSet TTL.',
      inputSchema: z.object({
        id_or_name: IdOrNameSchema.describe('Zone ID or name'),
        name: z.string().describe('RRSet name'),
        type: RRSetTypeSchema,
        records: z.array(RRSetRecordSchema).min(1).describe('Records to add to the RRSet'),
        ttl: z.number().int().min(0).optional().describe('Optional new TTL applied alongside the addition'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id_or_name, name, type, ...body } = params;
      const rrsetName = pathSeg(name);
      return hetznerRequest('POST', `/zones/${pathSeg(id_or_name)}/rrsets/${rrsetName}/${type}/actions/add_records`, body);
    })
  );

  // Update existing record values/comments
  server.registerTool(
    'hetzner_update_zone_rrset_records',
    {
      title: 'Update DNS Zone RRSet Record Comments',
      description: 'Update the comment on existing records in an RRSet (matched by value). The comment field is always sent — use an empty string to clear.',
      inputSchema: z.object({
        id_or_name: IdOrNameSchema.describe('Zone ID or name'),
        name: z.string().describe('RRSet name'),
        type: RRSetTypeSchema,
        records: z.array(z.object({
          value: z.string().describe('Existing record value to match'),
          comment: z.string().describe('New comment to set on the record; empty string clears it'),
        })).min(1).describe('Records to update'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id_or_name, name, type, ...body } = params;
      const rrsetName = pathSeg(name);
      return hetznerRequest('POST', `/zones/${pathSeg(id_or_name)}/rrsets/${rrsetName}/${type}/actions/update_records`, body);
    })
  );

  // Remove RRSet records
  server.registerTool(
    'hetzner_remove_zone_rrset_records',
    {
      title: 'Remove Records from DNS Zone RRSet',
      description: 'Remove specific records from an RRSet (matched by value) without deleting the RRSet itself.',
      inputSchema: z.object({
        id_or_name: IdOrNameSchema.describe('Zone ID or name'),
        name: z.string().describe('RRSet name'),
        type: RRSetTypeSchema,
        records: z.array(RRSetRecordSchema).min(1).describe('Records to remove (matched by value)'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id_or_name, name, type, ...body } = params;
      const rrsetName = pathSeg(name);
      return hetznerRequest('POST', `/zones/${pathSeg(id_or_name)}/rrsets/${rrsetName}/${type}/actions/remove_records`, body);
    })
  );
}
