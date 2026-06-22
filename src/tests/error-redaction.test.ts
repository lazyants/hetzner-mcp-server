import { describe, it, expect, vi, beforeEach } from 'vitest';
import util from 'node:util';
import { AxiosError, AxiosHeaders } from 'axios';
import { wrapHetznerError } from '../services/hetzner.js';

// Distinctive sentinel: if this string survives anywhere in a chained/serialized
// error, the bearer token would have leaked into a logger walking the cause.
const TOKEN = 'sk-leaky-bearer-DO-NOT-LEAK-9f3a';

// Build a config object seeded with the token in every credential-bearing field:
// headers (Authorization) + basic-auth `auth` + `proxy.auth`. `upper` swaps the
// header to a plain-object `AUTHORIZATION` key (non-AxiosHeaders) to exercise the
// case-insensitive scrub.
function makeConfig(upper: boolean): AxiosError['config'] {
  const headers = upper
    ? ({ AUTHORIZATION: `Bearer ${TOKEN}` } as unknown as AxiosHeaders)
    : new AxiosHeaders({ Authorization: `Bearer ${TOKEN}` });
  return {
    headers,
    auth: { username: 'u', password: TOKEN },
    proxy: { host: 'proxy', port: 8080, auth: { username: 'p', password: TOKEN } },
  } as unknown as AxiosError['config'];
}

const RAW_HEADER = `POST /v1/servers HTTP/1.1\r\nAuthorization: Bearer ${TOKEN}\r\n\r\n`;

// Build an AxiosError seeded with the token in every place axios stashes it:
// request config headers + basic-auth + Node ClientRequest `_header` raw block,
// AND — critically — a DISTINCT `response.config` object (its own token fields),
// so the test fails a sanitizer that only scrubs `err.config`.
function makeAxiosError(opts: {
  withResponse?: { status: number; statusText: string; data: unknown };
  withCode?: string;
  plainUpperHeader?: boolean;
}): AxiosError {
  const upper = opts.plainUpperHeader ?? false;
  const err = new AxiosError('Request failed');
  err.config = makeConfig(upper);
  (err as { request?: unknown }).request = { _header: RAW_HEADER };
  if (opts.withCode) err.code = opts.withCode;
  if (opts.withResponse) {
    err.response = {
      status: opts.withResponse.status,
      statusText: opts.withResponse.statusText,
      data: opts.withResponse.data,
      headers: {},
      // Separate config ref (not the request config) — proves scrubbing covers
      // response.config independently.
      config: makeConfig(upper),
      request: { _header: RAW_HEADER },
    } as unknown as AxiosError['response'];
  }
  return err;
}

// Assert the token (and the Authorization header name) leak through neither a deep
// inspect nor the AxiosError.toJSON() serializer. Default-depth inspect is NOT
// sufficient — it collapses nested objects to `[Object]` and hides the leak.
function expectNoLeak(wrapped: unknown): void {
  const inspected = util.inspect(wrapped, { depth: null });
  expect(inspected).not.toContain(TOKEN);
  expect(inspected).not.toMatch(/authorization/i);
  const cause = (wrapped as Error).cause;
  if (cause instanceof AxiosError) {
    expect(JSON.stringify(cause)).not.toContain(TOKEN);
    expect(JSON.stringify(cause.toJSON())).not.toContain(TOKEN);
  }
}

describe('wrapHetznerError token redaction', () => {
  it('does not leak the bearer token in inspect, JSON.stringify, or toJSON (regression #44)', () => {
    const err = makeAxiosError({
      withResponse: {
        status: 500,
        statusText: 'Internal Server Error',
        data: { error: { code: 'service_error', message: 'boom' } },
      },
    });
    expectNoLeak(wrapHetznerError(err));
  });

  it('preserves the structured API error message identity', () => {
    const err = makeAxiosError({
      withResponse: {
        status: 422,
        statusText: 'Unprocessable Entity',
        data: { error: { code: 'uniqueness_error', message: 'server with the same name already exists' } },
      },
    });
    const wrapped = wrapHetznerError(err) as Error;
    expect(wrapped.message).toBe('Hetzner API [uniqueness_error]: server with the same name already exists');
  });

  it('preserves the generic status error message identity (no error body)', () => {
    const err = makeAxiosError({
      withResponse: { status: 500, statusText: 'Internal Server Error', data: {} },
    });
    const wrapped = wrapHetznerError(err) as Error;
    expect(wrapped.message).toBe('Hetzner API error: 500 Internal Server Error');
  });

  it('preserves the network-error message identity and leaks no token', () => {
    const err = makeAxiosError({ withCode: 'ECONNREFUSED' });
    err.message = 'connect ECONNREFUSED 127.0.0.1:443';
    const wrapped = wrapHetznerError(err);
    expect(wrapped).toBeInstanceOf(Error);
    expect((wrapped as Error).message).toBe('Network error: connect ECONNREFUSED 127.0.0.1:443');
    expectNoLeak(wrapped);
  });

  it('returns the same (sanitized) instance for an AxiosError with no response and no code', () => {
    const err = makeAxiosError({});
    const wrapped = wrapHetznerError(err);
    expect(wrapped).toBe(err);
    expect(util.inspect(wrapped, { depth: null })).not.toContain(TOKEN);
  });

  it('scrubs an uppercase AUTHORIZATION header key case-insensitively', () => {
    const err = makeAxiosError({
      withResponse: {
        status: 500,
        statusText: 'Internal Server Error',
        data: { error: { code: 'x', message: 'y' } },
      },
      plainUpperHeader: true,
    });
    expect(util.inspect(wrapHetznerError(err), { depth: null })).not.toContain(TOKEN);
  });

  it('returns a non-Axios error unchanged', () => {
    const plain = new Error('plain');
    expect(wrapHetznerError(plain)).toBe(plain);
  });
});

// Public-path wiring: prove the real request() catch routes through wrapHetznerError,
// not just that the exported wrapper is correct. Mirrors the vi.doMock('axios')
// pattern in hetzner-client.test.ts; the mocked client.request rejects directly so
// the no-op response interceptor is fine.
function mockAxiosRejecting(error: AxiosError): void {
  vi.doMock('axios', async (importOriginal) => {
    const actual = await importOriginal<typeof import('axios')>();
    return {
      ...actual,
      default: {
        ...actual.default,
        create: () => ({
          interceptors: { response: { use: vi.fn() } },
          request: vi.fn().mockRejectedValue(error),
        }),
      },
    };
  });
}

describe('request() wiring — token redaction through the public entry points', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('hetznerRequest does not leak the token in the thrown error', async () => {
    vi.stubEnv('HETZNER_API_TOKEN', 'test-token');
    mockAxiosRejecting(
      makeAxiosError({
        withResponse: {
          status: 500,
          statusText: 'Internal Server Error',
          data: { error: { code: 'service_error', message: 'boom' } },
        },
      })
    );

    const { hetznerRequest } = await import('../services/hetzner.js');
    const caught = await hetznerRequest('GET', '/servers').then(
      () => { throw new Error('expected rejection'); },
      (e: unknown) => e
    );
    expectNoLeak(caught);
  });

  it('storageBoxRequest does not leak the token in the thrown error', async () => {
    vi.stubEnv('HETZNER_STORAGE_API_TOKEN', 'storage-token');
    mockAxiosRejecting(
      makeAxiosError({
        withResponse: {
          status: 500,
          statusText: 'Internal Server Error',
          data: { error: { code: 'service_error', message: 'boom' } },
        },
      })
    );

    const { storageBoxRequest } = await import('../services/hetzner.js');
    const caught = await storageBoxRequest('GET', '/storage_boxes').then(
      () => { throw new Error('expected rejection'); },
      (e: unknown) => e
    );
    expectNoLeak(caught);
  });
});
