import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { ALL_REGISTRARS } from '../../splits.js';

/**
 * Annotation coverage, asserted via a real `tools/list` round-trip (in-process
 * InMemoryTransport client/server pair — the same path an MCP client
 * exercises), built once over every registered tool (`ALL_REGISTRARS`).
 *
 * Two describes share the round-trip result:
 *  - a generalized sweep asserting all four hints are present and boolean on
 *    EVERY tool, plus the sanity invariant that a tool can't be both
 *    read-only and destructive;
 *  - the original table-driven exact-value check for the 9 Wave-2 tools
 *    (expected values derived by reading the cited existing analog tool's
 *    annotations — see PLAN W2-A; `openWorldHint` is true for all 9).
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

let client: Client;
let annotationsByName: Map<string, Record<string, unknown>>;

beforeAll(async () => {
  const server = new McpServer({ name: 'annotations-test', version: '0.0.0' });
  for (const register of ALL_REGISTRARS) {
    register(server);
  }

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

describe('Every registered tool — annotation coverage via tools/list', () => {
  // A single test with an internal loop, not `it.each` — the tool list only
  // exists after `beforeAll`'s round-trip, which runs after test collection.
  it('every tool exposes all four boolean annotation hints, and none is both read-only and destructive', () => {
    const hintNames = ['readOnlyHint', 'destructiveHint', 'idempotentHint', 'openWorldHint'] as const;
    const violations: string[] = [];

    for (const [name, actual] of annotationsByName) {
      for (const hint of hintNames) {
        if (typeof actual[hint] !== 'boolean') {
          violations.push(`${name}.${hint}: expected boolean, got ${typeof actual[hint]}`);
        }
      }
      if (Boolean(actual.readOnlyHint) && Boolean(actual.destructiveHint)) {
        violations.push(`${name}: readOnlyHint and destructiveHint must not both be true`);
      }
    }

    expect(violations, violations.join('\n')).toEqual([]);
  });
});

describe('Wave-2 new tools — annotation coverage via tools/list', () => {
  it.each(EXPECTED)('tool %s exposes all four annotation hints exactly', (name, hints) => {
    const actual = annotationsByName.get(name);
    expect(actual, `Tool ${name} missing from tools/list`).toBeDefined();
    expect(actual!.readOnlyHint, `${name}.readOnlyHint`).toBe(hints.readOnlyHint);
    expect(actual!.destructiveHint, `${name}.destructiveHint`).toBe(hints.destructiveHint);
    expect(actual!.idempotentHint, `${name}.idempotentHint`).toBe(hints.idempotentHint);
    expect(actual!.openWorldHint, `${name}.openWorldHint`).toBe(hints.openWorldHint);
  });
});
