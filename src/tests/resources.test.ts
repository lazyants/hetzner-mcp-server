import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, join } from 'node:path';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import { registerReferenceResource, REFERENCE_URI } from '../resources/hetzner-reference.js';
import { registerServerTools } from '../tools/servers.js';

/**
 * Resource coverage for the read-only API-reference Resource:
 *   (1) Content/shape — in-process client round-trip (listResources + readResource).
 *   (2) Additive capability — registering the Resource does not break tools/list.
 *   (3) Packaging — from a CLEAN build, the compiled resource ships and the
 *       dist/entry-*.js ↔ package.json#bin set is in parity (catches stale-dist
 *       orphans + the runtime-file-read packaging hole).
 *   (4) Every split binary advertises the Resource — subprocess round-trip per
 *       package.json#bin entry (the real shipped binaries auto-start stdio).
 */

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
  bin: Record<string, string>;
};
const binEntries = Object.entries(pkg.bin);

// A CLEAN build is mandatory: hetzner's dist/ can carry ORPHANED compiled entry
// files from a prior naming (entry-compute.js, entry-network.js, ...) with no
// matching source or bin; a non-clean npm pack --dry-run would ship them. Wiping
// dist and rebuilding makes the packaging + subprocess assertions deterministic
// regardless of prior local dist state (CI checks out fresh, so it is clean too).
beforeAll(() => {
  rmSync(join(repoRoot, 'dist'), { recursive: true, force: true });
  execSync('npm run build', { cwd: repoRoot, stdio: 'pipe' });
}, 180000);

async function connectInProcess(): Promise<{ client: Client; close: () => Promise<void> }> {
  const server = new McpServer({ name: 'resource-test', version: '0.0.0' });
  registerServerTools(server); // tools alongside the Resource — proves additivity
  registerReferenceResource(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'resource-test-client', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, close: async () => { await client.close(); } };
}

describe('API-reference Resource — content and shape (in-process round-trip)', () => {
  let client: Client;
  let teardown: () => Promise<void>;

  beforeAll(async () => {
    const conn = await connectInProcess();
    client = conn.client;
    teardown = conn.close;
  });

  afterAll(async () => {
    await teardown?.();
  });

  it('lists reference://hetzner/api with the right name and mimeType', async () => {
    const { resources } = await client.listResources();
    const ref = resources.find((r) => r.uri === REFERENCE_URI);
    expect(ref, 'reference resource not listed').toBeDefined();
    expect(ref!.name).toBe('hetzner-api-reference');
    expect(ref!.mimeType).toBe('text/markdown');
  });

  it('reads non-empty markdown whose contents[].uri is the exact registered URI string', async () => {
    const result = await client.readResource({ uri: REFERENCE_URI });
    expect(result.contents).toHaveLength(1);
    const entry = result.contents[0] as { uri: string; mimeType?: string; text?: string };
    // Must be the URI *string*, not a serialized URL object.
    expect(entry.uri).toBe(REFERENCE_URI);
    expect(entry.mimeType).toBe('text/markdown');
    const text = entry.text ?? '';
    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain('# Hetzner Cloud API Reference');
  });

  it('still advertises tools (resources capability is additive)', async () => {
    const { tools } = await client.listTools();
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.some((t) => t.name === 'hetzner_list_servers')).toBe(true);
  });
});

describe('API-reference Resource — packaging from a clean build', () => {
  it('compiles into dist and exports non-empty REFERENCE_MD', async () => {
    const distResource = join(repoRoot, 'dist/resources/hetzner-reference.js');
    const mod = (await import(pathToFileURL(distResource).href)) as {
      REFERENCE_MD: string;
      REFERENCE_URI: string;
    };
    expect(mod.REFERENCE_URI).toBe(REFERENCE_URI);
    expect(mod.REFERENCE_MD).toContain('# Hetzner Cloud API Reference');
  });

  it('npm pack ships the compiled resource and keeps dist/entry-*.js ↔ bin in parity', () => {
    const out = execSync('npm pack --dry-run --json', {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString();
    const packed = JSON.parse(out) as Array<{ files: Array<{ path: string }> }>;
    const files = packed[0].files.map((f) => f.path.replace(/\\/g, '/'));

    // (i) the compiled Resource ships
    expect(files).toContain('dist/resources/hetzner-reference.js');

    // (ii) dist entry/index <-> bin parity (no orphans, no missing targets)
    const binTargets = Object.values(pkg.bin).map((p) => p.replace(/\\/g, '/'));
    const shippedEntries = files.filter((p) => /^dist\/(index|entry-[a-z-]+)\.js$/.test(p));

    for (const entry of shippedEntries) {
      expect(binTargets, `shipped ${entry} has no package.json#bin target (orphan)`).toContain(entry);
    }
    for (const target of binTargets) {
      expect(files, `bin target ${target} is not in the packed files (missing build)`).toContain(target);
    }
  });
});

// Reject if `p` does not settle within `ms`, so the caller's finally-block tear
// down runs even when a binary hangs (prevents leaked child processes) instead
// of waiting on Vitest's outer timeout, which would skip cleanup.
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolvePromise, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then(
      (v) => { clearTimeout(timer); resolvePromise(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

describe('API-reference Resource — every split binary (subprocess round-trip)', () => {
  it.each(binEntries)('binary %s lists reference://hetzner/api', async (binName, rel) => {
    const absBin = join(repoRoot, rel);
    // StdioServerParameters.env is Record<string,string>; process.env values are
    // string|undefined, so filter undefined out before forwarding.
    const childEnv: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (typeof v === 'string') childEnv[k] = v;
    }
    childEnv.HETZNER_API_TOKEN = 'test-token';
    // Spawn via process.execPath: dist/*.js are mode 0644 (no exec shebang).
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [absBin],
      env: childEnv,
    });
    const client = new Client({ name: 'bin-resource-client', version: '0.0.0' });
    let connected = false;
    try {
      await withTimeout(client.connect(transport), 8000, `${binName} connect`); // initialize + initialized
      connected = true;
      const { resources } = await withTimeout(client.listResources(), 8000, `${binName} listResources`);
      const uris = resources.map((r) => r.uri);
      expect(uris, `${binName} resources: [${uris.join(', ')}]`).toContain(REFERENCE_URI);
    } finally {
      // After connect(), the client owns the transport — tear down via the client.
      if (connected) await client.close();
      else await transport.close();
    }
  }, 20000);
});
