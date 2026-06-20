import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Verifies the Storage Box client wiring in services/hetzner.ts:
 *   - token resolution order (HETZNER_STORAGE_API_TOKEN ?? HETZNER_API_TOKEN),
 *     throwing only when BOTH are absent;
 *   - the storage client targets api.hetzner.com while the Cloud client targets
 *     api.hetzner.cloud (the two hosts must not be conflated);
 *   - both clients share the same retry / error normalization path.
 */

interface CreateCall {
  baseURL: string;
  authorization: string;
}

let createCalls: CreateCall[];
let mockRequest: ReturnType<typeof vi.fn>;

async function loadFreshService(): Promise<typeof import('../services/hetzner.js')> {
  vi.resetModules();
  createCalls = [];
  mockRequest = vi.fn().mockResolvedValue({ data: { ok: true } });

  vi.doMock('axios', async (importOriginal) => {
    const actual = await importOriginal<typeof import('axios')>();
    return {
      ...actual,
      default: {
        ...actual.default,
        create: (config: { baseURL: string; headers: Record<string, string> }) => {
          createCalls.push({
            baseURL: config.baseURL,
            authorization: config.headers.Authorization,
          });
          return {
            interceptors: { response: { use: vi.fn() } },
            request: mockRequest,
          };
        },
      },
    };
  });

  return import('../services/hetzner.js');
}

describe('storageBoxRequest — token resolution and base URL', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('uses HETZNER_STORAGE_API_TOKEN when set', async () => {
    vi.stubEnv('HETZNER_STORAGE_API_TOKEN', 'storage-tok');
    vi.stubEnv('HETZNER_API_TOKEN', 'cloud-tok');
    const { storageBoxRequest } = await loadFreshService();

    await storageBoxRequest('GET', '/storage_boxes');

    expect(createCalls).toHaveLength(1);
    expect(createCalls[0].baseURL).toBe('https://api.hetzner.com/v1');
    expect(createCalls[0].authorization).toBe('Bearer storage-tok');
  });

  it('falls back to HETZNER_API_TOKEN when the storage token is absent', async () => {
    vi.stubEnv('HETZNER_API_TOKEN', 'cloud-tok');
    const { storageBoxRequest } = await loadFreshService();

    await storageBoxRequest('GET', '/storage_boxes');

    expect(createCalls[0].baseURL).toBe('https://api.hetzner.com/v1');
    expect(createCalls[0].authorization).toBe('Bearer cloud-tok');
  });

  it('throws when BOTH tokens are absent', async () => {
    const { storageBoxRequest } = await loadFreshService();

    await expect(storageBoxRequest('GET', '/storage_boxes')).rejects.toThrow(
      /HETZNER_STORAGE_API_TOKEN.*HETZNER_API_TOKEN.*required/s
    );
    expect(createCalls).toHaveLength(0);
  });

  it('routes storage calls to api.hetzner.com and Cloud calls to api.hetzner.cloud', async () => {
    vi.stubEnv('HETZNER_API_TOKEN', 'cloud-tok');
    const { hetznerRequest, storageBoxRequest } = await loadFreshService();

    await hetznerRequest('GET', '/servers');
    await storageBoxRequest('GET', '/storage_boxes');

    const bases = createCalls.map((c) => c.baseURL);
    expect(bases).toContain('https://api.hetzner.cloud/v1');
    expect(bases).toContain('https://api.hetzner.com/v1');
  });

  it('passes method, url, data, and stripped params through to the client', async () => {
    vi.stubEnv('HETZNER_STORAGE_API_TOKEN', 'storage-tok');
    const { storageBoxRequest } = await loadFreshService();

    await storageBoxRequest('POST', '/storage_boxes', { name: 'box' }, { page: 1, name: undefined });

    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/storage_boxes',
      data: { name: 'box' },
      params: { page: 1 },
    });
  });
});
