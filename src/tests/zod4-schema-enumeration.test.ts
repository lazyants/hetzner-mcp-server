import { describe, it, expect } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { registerServerTools } from '../tools/servers.js';
import { registerImageTools } from '../tools/images.js';
import { registerIsoTools } from '../tools/isos.js';
import { registerPlacementGroupTools } from '../tools/placement-groups.js';
import { registerDatacenterTools } from '../tools/datacenters.js';
import { registerNetworkTools } from '../tools/networks.js';
import { registerFirewallTools } from '../tools/firewalls.js';
import { registerLoadBalancerTools } from '../tools/load-balancers.js';
import { registerCertificateTools } from '../tools/certificates.js';
import { registerVolumeTools } from '../tools/volumes.js';
import { registerFloatingIpTools } from '../tools/floating-ips.js';
import { registerPrimaryIpTools } from '../tools/primary-ips.js';
import { registerSshKeyTools } from '../tools/ssh-keys.js';
import { registerDnsZoneTools } from '../tools/zones.js';
import { registerPricingTools } from '../tools/pricing.js';

/**
 * Regression guard against the Zod 4 `optin: "optional"` silent-drop bug
 * (gotcha_zod4_preprocess_optin_required_drop.md):
 *
 *  - MCP SDK emits `tools/list` `inputSchema` in JSON Schema INPUT mode.
 *  - Zod 4 tags `z.preprocess` (and future pipe-shaped wrappers) outputs
 *    with `optin: "optional"`, which input-mode emit treats as
 *    "not required" — silently stripping required fields from `required[]`
 *    even though Zod still validates them as required at runtime.
 *
 * This test enumerates EVERY tool registered against a freshly-built
 * MCP server (dynamic count — do not hardcode), and asserts for each:
 *
 *  (a) Every shape field with a `.describe()` annotation propagates to a
 *      non-empty `description` field in the emitted JSON Schema property.
 *  (b) The emitted `required[]` matches the set computed from the source
 *      Zod shape — i.e. every shape field NOT wrapped in `ZodOptional`
 *      MUST appear in `required[]`, and every `ZodOptional` field MUST
 *      NOT.
 *
 * If a future Zod / SDK version regresses, (b) will fail with a precise
 * `tool.field`-level diff before the bug ever reaches an MCP client.
 *
 * Verification: deliberately introduce a `z.preprocess(...)` around a
 * required field (without `clearOptinMarker`) on a scratch commit; this
 * test should fail. See gotcha_zod4_preprocess_optin_required_drop.md.
 */

interface RegisteredToolEntry {
  inputSchema?: z.ZodTypeAny;
  description?: string;
}

function buildFullServer(): McpServer {
  const server = new McpServer({ name: 'enum-test', version: '0.0.0' });
  registerServerTools(server);
  registerImageTools(server);
  registerIsoTools(server);
  registerPlacementGroupTools(server);
  registerDatacenterTools(server);
  registerNetworkTools(server);
  registerFirewallTools(server);
  registerLoadBalancerTools(server);
  registerCertificateTools(server);
  registerVolumeTools(server);
  registerFloatingIpTools(server);
  registerPrimaryIpTools(server);
  registerSshKeyTools(server);
  registerDnsZoneTools(server);
  registerPricingTools(server);
  return server;
}

function getRegistry(server: McpServer): Record<string, RegisteredToolEntry> {
  return (server as unknown as { _registeredTools: Record<string, RegisteredToolEntry> })._registeredTools;
}

/**
 * Walk the top-level shape of a ZodObject and compute the set of field
 * names that should be required (= fields NOT wrapped in ZodOptional).
 * Mirrors what an MCP client should see in JSON Schema `required[]`.
 */
function expectedRequiredFromShape(schema: z.ZodTypeAny): { required: Set<string>; optional: Set<string>; describedFields: Set<string> } {
  const required = new Set<string>();
  const optional = new Set<string>();
  const describedFields = new Set<string>();

  const shape = (schema as unknown as { shape?: Record<string, z.ZodTypeAny> }).shape;
  if (!shape) {
    // Not a ZodObject — leave both sets empty
    return { required, optional, describedFields };
  }

  for (const [key, field] of Object.entries(shape)) {
    // Prefer Zod's runtime `.isOptional()` over constructor-name sniffing —
    // robust to internal class renames in Zod minor versions.
    const isOptional = typeof field.isOptional === 'function'
      ? field.isOptional()
      : field.constructor.name === 'ZodOptional';
    if (isOptional) {
      optional.add(key);
    } else {
      required.add(key);
    }
    if (typeof field.description === 'string' && field.description.length > 0) {
      describedFields.add(key);
    }
  }
  return { required, optional, describedFields };
}

describe('Zod 4 schema enumeration — every registered tool', () => {
  const server = buildFullServer();
  const registry = getRegistry(server);
  const toolNames = Object.keys(registry).sort();

  it('discovers at least the post-PR-21 count of tools (dynamic, currently 111)', () => {
    // Anchor — proves the registry walk actually sees tools. Do not
    // hardcode here; this just sanity-checks the test isn't silently iterating empty.
    expect(toolNames.length).toBeGreaterThanOrEqual(111);
  });

  it.each(toolNames)('tool %s: emitted JSON Schema input mode matches source shape', (name) => {
    const entry = registry[name];
    expect(entry, `Tool ${name} missing from registry`).toBeDefined();
    const inputSchema = entry.inputSchema;
    if (!inputSchema) {
      // Tools without inputs are valid — nothing to check
      return;
    }

    const { required: expectedRequired, optional: expectedOptional, describedFields } =
      expectedRequiredFromShape(inputSchema);

    // INPUT mode — this is what MCP SDK's tools/list uses
    const json = z.toJSONSchema(inputSchema, { io: 'input' }) as {
      properties?: Record<string, { description?: string }>;
      required?: string[];
    };

    const actualRequired = new Set(json.required ?? []);
    const actualProperties = Object.keys(json.properties ?? {});

    // (a) describe propagation
    for (const fieldName of describedFields) {
      const prop = json.properties?.[fieldName];
      expect(
        prop?.description,
        `Tool ${name} field ${fieldName} has .describe() in source but no description in emitted JSON Schema`,
      ).toBeTruthy();
    }

    // (b) required-set match: every non-optional shape field must be in required[]
    for (const fieldName of expectedRequired) {
      expect(
        actualRequired.has(fieldName),
        `Tool ${name} field ${fieldName} is required in Zod source but MISSING from JSON Schema required[] ` +
          `(this is the Zod 4 optin: "optional" silent-drop bug — see gotcha_zod4_preprocess_optin_required_drop.md)`,
      ).toBe(true);
    }

    // (b) inverse: nothing in JSON Schema required[] should be missing from the source-side required set
    for (const fieldName of actualRequired) {
      expect(
        expectedRequired.has(fieldName),
        `Tool ${name} field ${fieldName} is required in emitted JSON Schema but is ZodOptional in source ` +
          '(unexpected inversion — JSON Schema must not promote optional fields)',
      ).toBe(true);
    }

    // (b) optional fields must NOT appear in required[]
    for (const fieldName of expectedOptional) {
      expect(
        actualRequired.has(fieldName),
        `Tool ${name} field ${fieldName} is .optional() in source but appears in JSON Schema required[]`,
      ).toBe(false);
    }

    // Sanity: every source shape key must surface in JSON Schema properties
    const sourceShapeKeys = [...expectedRequired, ...expectedOptional];
    for (const key of sourceShapeKeys) {
      expect(
        actualProperties.includes(key),
        `Tool ${name} field ${key} present in Zod source but missing from emitted JSON Schema properties`,
      ).toBe(true);
    }
  });
});
