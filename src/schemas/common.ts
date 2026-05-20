import { z } from 'zod';

export const IdSchema = z.number().int().positive().describe('Resource ID');

// Some Hetzner Cloud resources (e.g. DNS Zones) accept either the numeric ID
// or the resource name in path parameters. Numeric IDs and non-empty strings
// are both valid; URL-segment characters like "/" are rejected here.
export const IdOrNameSchema = z
  .union([z.number().int().positive(), z.string().regex(/^[^/\s]+$/u, 'must be a non-empty path segment')])
  .describe('Resource ID (number) or name (string)');

export const PaginationParams = {
  page: z.number().int().min(1).optional().describe('Page number'),
  per_page: z.number().int().min(1).max(50).optional().describe('Results per page (max 50)'),
};

export const LabelSelectorParam = {
  label_selector: z.string().optional().describe('Label filter, e.g. "env=prod,tier=web"'),
};

export const LabelsSchema = z.record(z.string(), z.string()).optional().describe('Labels as key-value pairs');

export const SortParam = {
  sort: z.string().optional().describe('Sort field, e.g. "id:asc" or "name:desc"'),
};

export const NameFilterParam = {
  name: z.string().optional().describe('Filter by name'),
};

export const ActionStatusFilterParam = {
  status: z.string().optional().describe('Filter by action status: comma-separated list of "running", "success", "error"'),
};
