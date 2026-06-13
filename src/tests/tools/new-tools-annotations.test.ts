import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { registerServerTools } from '../../tools/servers.js';
import { registerLoadBalancerTools } from '../../tools/load-balancers.js';
import { registerPricingTools } from '../../tools/pricing.js';

/**
 * Table-driven annotation coverage for the 9 Wave-2 tools, asserted via a real
 * `tools/list` round-trip (in-process InMemoryTransport client/server pair —
 * the same path an MCP client exercises). Every one of the FOUR hints is
 * asserted per tool (including the `false` ones) — this is the only thing that
 * catches a forgotten or mismatched annotation on any of the new tools.
 *
 * Expected values were derived by reading the cited existing analog tool's
 * annotations (see PLAN W2-A); `openWorldHint` is true for all 9.
 */
interface Hints {
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
  openWorldHint: boolean;
}

const EXPECTED: Array<[string, Hints]> = [
  // tool                                          readOnly destructive idempotent openWorld   derived from
  ['hetzner_attach_server_to_network', { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }],
  ['hetzner_detach_server_from_network', { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true }],
  ['hetzner_add_server_to_placement_group', { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }],
  ['hetzner_remove_server_from_placement_group', { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true }],
  ['hetzner_reset_server_password', { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true }],
  ['hetzner_enable_lb_public_interface', { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }],
  ['hetzner_disable_lb_public_interface', { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true }],
  ['hetzner_change_lb_dns_ptr', { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }],
  ['hetzner_get_pricing', { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }],
];

describe('Wave-2 new tools — annotation coverage via tools/list', () => {
  let client: Client;
  let annotationsByName: Map<string, Record<string, unknown>>;

  beforeAll(async () => {
    const server = new McpServer({ name: 'annotations-test', version: '0.0.0' });
    registerServerTools(server);
    registerLoadBalancerTools(server);
    registerPricingTools(server);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'annotations-test-client', version: '0.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const { tools } = await client.listTools();
    annotationsByName = new Map(
      tools.map((t) => [t.name, (t.annotations ?? {}) as Record<string, unknown>]),
    );
  });

  afterAll(async () => {
    await client?.close();
  });

  it.each(EXPECTED)('tool %s exposes all four annotation hints exactly', (name, hints) => {
    const actual = annotationsByName.get(name);
    expect(actual, `Tool ${name} missing from tools/list`).toBeDefined();
    expect(actual!.readOnlyHint, `${name}.readOnlyHint`).toBe(hints.readOnlyHint);
    expect(actual!.destructiveHint, `${name}.destructiveHint`).toBe(hints.destructiveHint);
    expect(actual!.idempotentHint, `${name}.idempotentHint`).toBe(hints.idempotentHint);
    expect(actual!.openWorldHint, `${name}.openWorldHint`).toBe(hints.openWorldHint);
  });
});
