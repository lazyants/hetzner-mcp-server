import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { setTimeout as sleep } from 'node:timers/promises';
import { z } from 'zod';
import { MAX_PER_PAGE } from '../constants.js';
import { handleToolRequest } from '../helpers.js';
import { IdSchema } from '../schemas/common.js';
import { hetznerRequest, storageBoxRequest } from '../services/hetzner.js';

const ActionDomainSchema = z.enum([
  'servers', 'load_balancers', 'volumes', 'networks', 'firewalls', 'floating_ips',
  'primary_ips', 'certificates', 'images', 'zones', 'storage_boxes',
]);

interface Action {
  id: number;
  status: string;
  [key: string]: unknown;
}

interface ActionList {
  actions: Action[];
  meta?: { pagination?: { next_page?: number | null } };
}

interface WaitParams {
  domain: z.infer<typeof ActionDomainSchema>;
  resource_id: number;
  action_id: number;
  timeout: number;
}

async function waitForAction(params: WaitParams, cancellation?: AbortSignal): Promise<Action> {
  const { domain, resource_id, action_id, timeout } = params;
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(new Error(`Timed out waiting for action ${action_id} after ${timeout} seconds`)), timeout * 1000);
  const cancel = () => controller.abort(new Error('Action wait cancelled'));
  if (cancellation?.aborted) cancel();
  else cancellation?.addEventListener('abort', cancel, { once: true });
  const signal = controller.signal;
  const request = domain === 'storage_boxes' ? storageBoxRequest : hetznerRequest;

  try {
    while (true) {
      let page = 1;
      while (true) {
        signal.throwIfAborted();
        const data = await request<ActionList>('GET', `/${domain}/${resource_id}/actions`, undefined, { page, per_page: MAX_PER_PAGE, sort: 'id:desc' }, signal);
        const action = data.actions.find((entry) => entry.id === action_id);
        if (action?.status === 'success' || action?.status === 'error') return action;
        if (action) break;
        const next = data.meta?.pagination?.next_page;
        if (typeof next !== 'number' || !Number.isInteger(next) || next <= page) break;
        page = next;
      }
      await sleep(1000, undefined, { signal });
    }
  } catch (err) {
    if (signal.aborted) throw signal.reason;
    throw err;
  } finally {
    clearTimeout(deadline);
    cancellation?.removeEventListener('abort', cancel);
  }
}

export function registerActionTools(server: McpServer): void {
  server.registerTool(
    'hetzner_wait_for_action',
    {
      title: 'Wait for Action',
      description: 'Wait for a resource action to reach success or error and return its full details. The timeout includes API requests and rate-limit delays.',
      inputSchema: z.object({
        domain: ActionDomainSchema.describe('Resource domain owning the action'),
        resource_id: IdSchema.describe('Resource ID owning the action'),
        action_id: IdSchema.describe('Action ID to wait for'),
        timeout: z.number().positive().max(3600).default(300).describe('Maximum wait in seconds, including requests and rate-limit delays (default 300, max 3600)'),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params, extra) => waitForAction(params, extra?.signal))
  );
}
