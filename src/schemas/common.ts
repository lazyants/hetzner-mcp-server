import { z } from 'zod';
import { MAX_PER_PAGE } from '../constants.js';

// Encodes a single path segment for interpolation into a REST URL template
// (e.g. `/zones/${pathSeg(id_or_name)}`). encodeURIComponent alone does NOT
// stop path traversal: it never escapes '.', so pathSeg('..') === '..' — and
// every call site here supplies its own literal '/' around the segment, so
// a raw '..' still normalizes up a directory. This function only guards
// against '? # % <space>'-class characters; PathSegmentSchema below is the
// layer that rejects '', '.', and '..' before a URL is ever built. Both
// layers are required — see gotcha_path_segment_user_input_url_interpolation.md.
export function pathSeg(v: number | string): string {
  return encodeURIComponent(String(v));
}

export const IdSchema = z.number().int().positive().describe('Resource ID');

// Schema-layer guard for any value interpolated as a bare URL path segment.
// encodeURIComponent (pathSeg) never escapes '.', so pathSeg('..') === '..' and a
// raw '.'/'..' would normalize up a directory once the path template supplies its
// own slashes. The regex rejects '/'+whitespace+empty; the refine rejects '.'/'..'.
// Both layers are required — see gotcha_path_segment_user_input_url_interpolation.md.
export const PathSegmentSchema = z
  .string()
  .regex(/^[^/\s]+$/u, 'Must not contain "/" or whitespace')
  .refine((v) => v !== '.' && v !== '..', { message: 'Must not be "." or ".."' });

// Some Hetzner Cloud resources (e.g. DNS Zones) accept either the numeric ID
// or the resource name in path parameters. Reuses PathSegmentSchema so a bare
// '.'/'..' name is rejected the same way as any other path-segment field.
export const IdOrNameSchema = z
  .union([z.number().int().positive(), PathSegmentSchema])
  .describe('Resource ID (number) or name (string)');

export const PaginationParams = {
  page: z.number().int().min(1).optional().describe('Page number'),
  per_page: z.number().int().min(1).max(MAX_PER_PAGE).optional().describe(`Results per page (max ${MAX_PER_PAGE})`),
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
