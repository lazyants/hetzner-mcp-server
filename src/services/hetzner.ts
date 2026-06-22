import axios, { AxiosInstance, AxiosError, Method } from 'axios';
import { HETZNER_API_BASE, HETZNER_STORAGE_API_BASE, MAX_RETRIES, REQUEST_TIMEOUT } from '../constants.js';

interface HetznerErrorBody {
  error: { code: string; message: string };
}

function getToken(): string {
  const token = process.env.HETZNER_API_TOKEN;
  if (!token) {
    throw new Error(
      'HETZNER_API_TOKEN environment variable is required. ' +
      'Get your token from https://console.hetzner.cloud/projects/*/security/tokens'
    );
  }
  return token;
}

// Storage Boxes accept a dedicated token but fall back to the Cloud token, since
// Hetzner presents both hosts as one API-token family. Throw only if BOTH absent.
// Use `||` (not `??`) so an empty-string HETZNER_STORAGE_API_TOKEN (e.g. an unset
// `${VAR}` placeholder in a compose/.env file) still falls back to the Cloud token.
function getStorageToken(): string {
  const token = process.env.HETZNER_STORAGE_API_TOKEN || process.env.HETZNER_API_TOKEN;
  if (!token) {
    throw new Error(
      'HETZNER_STORAGE_API_TOKEN (or HETZNER_API_TOKEN) environment variable is required ' +
      'for Storage Box tools. Get your token from ' +
      'https://console.hetzner.cloud/projects/*/security/tokens'
    );
  }
  return token;
}

function createClient(baseURL: string, token: string): AxiosInstance {
  const client = axios.create({
    baseURL,
    timeout: REQUEST_TIMEOUT,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    // Hetzner expects repeated keys for array query params (e.g.
    // `?type=A&type=AAAA`). Axios's default emits `type[]=A&type[]=AAAA`,
    // which Hetzner ignores. `indexes: null` switches to repeated keys.
    paramsSerializer: { indexes: null },
  });

  client.interceptors.response.use(
    (response) => {
      const remaining = response.headers['ratelimit-remaining'];
      if (remaining !== undefined && parseInt(remaining, 10) < 100) {
        console.error(`[hetzner-mcp] Rate limit warning: ${remaining} requests remaining`);
      }
      return response;
    },
    async (error: AxiosError) => {
      if (error.response?.status === 429) {
        const config = error.config;
        if (!config) return Promise.reject(error);

        const retryCount = ((config as unknown as Record<string, unknown>).__retryCount as number) || 0;
        if (retryCount >= MAX_RETRIES) {
          return Promise.reject(new Error('Rate limit exceeded after maximum retries'));
        }

        const retryAfter = error.response.headers['retry-after'];
        const resetTime = error.response.headers['ratelimit-reset'];
        let delay: number;

        if (retryAfter) {
          delay = parseInt(retryAfter, 10) * 1000;
        } else if (resetTime) {
          delay = Math.max(0, parseInt(resetTime, 10) * 1000 - Date.now());
        } else {
          delay = Math.pow(2, retryCount) * 1000;
        }

        (config as unknown as Record<string, unknown>).__retryCount = retryCount + 1;
        console.error(`[hetzner-mcp] Rate limited. Retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);

        await new Promise((resolve) => setTimeout(resolve, delay));
        return client.request(config);
      }

      return Promise.reject(error);
    }
  );

  return client;
}

let clientInstance: AxiosInstance | null = null;

function getClient(): AxiosInstance {
  if (!clientInstance) {
    clientInstance = createClient(HETZNER_API_BASE, getToken());
  }
  return clientInstance;
}

let storageClientInstance: AxiosInstance | null = null;

function getStorageClient(): AxiosInstance {
  if (!storageClientInstance) {
    storageClientInstance = createClient(HETZNER_STORAGE_API_BASE, getStorageToken());
  }
  return storageClientInstance;
}

function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

// Headers that must never survive on an AxiosError we chain as `{ cause: err }`.
const SENSITIVE_HEADERS = new Set(['authorization', 'proxy-authorization', 'cookie']);

// Remove auth-bearing headers case-insensitively from an AxiosHeaders instance
// (which exposes .delete) OR a plain object. A fixed-case `delete h.Authorization`
// would miss a plain key like `AUTHORIZATION`, so iterate the actual keys.
function scrubAuth(headers: unknown): void {
  if (!headers || typeof headers !== 'object') return;
  const h = headers as Record<string, unknown> & { delete?: unknown };
  // Optional chaining only guards null/undefined; a plain object whose own key is
  // literally "delete" would make `h.delete(key)` throw — so type-guard it.
  const del = typeof h.delete === 'function' ? (h.delete as (k: string) => void) : null;
  for (const key of Object.keys(h)) {
    if (SENSITIVE_HEADERS.has(key.toLowerCase())) {
      del?.call(h, key); // AxiosHeaders removes its normalized entry
      delete h[key]; // plain-object / belt-and-suspenders
    }
  }
}

// Scrub every credential-bearing field on a request/response config: headers plus
// basic-auth `auth` and `proxy.auth`. Hetzner sets none of the latter today, but a
// central sanitizer should not depend on that.
function scrubConfig(config: unknown): void {
  if (!config || typeof config !== 'object') return;
  const c = config as { headers?: unknown; auth?: unknown; proxy?: { auth?: unknown } | null };
  scrubAuth(c.headers);
  delete c.auth;
  if (c.proxy && typeof c.proxy === 'object') delete c.proxy.auth;
}

// Void mutator: strip the bearer token (HETZNER_API_TOKEN / HETZNER_STORAGE_API_TOKEN)
// from an AxiosError before it is chained via `{ cause: err }`, so a logger walking the
// cause with `util.inspect(err, { depth: null })` or `AxiosError.toJSON()` cannot surface
// it. `config.headers` AND Node's `request._header` raw block both carry the token.
// Mutating up front (rather than building a fresh cause) keeps the literal caught binding
// available for `{ cause: err }`, satisfying eslint preserve-caught-error.
function sanitizeAxiosError(err: AxiosError): void {
  scrubConfig(err.config);
  scrubConfig(err.response?.config); // may be a distinct ref depending on the adapter
  delete (err as { request?: unknown }).request;
  if (err.response) delete (err.response as { request?: unknown }).request;
  // Defensive: an AxiosError that already chained an object cause could carry its
  // own config/request — drop it before we re-chain err.
  const e = err as { cause?: unknown };
  if (e.cause && typeof e.cause === 'object') delete e.cause;
}

// Single sanitized throw path for the axios chokepoint. Mirrors the historical
// request() branches exactly so thrown messages don't drift: a response → formatted
// API error; a network code → "Network error"; anything else → the (now sanitized)
// raw error returned as before. Exported for the regression test.
export function wrapHetznerError(err: unknown): unknown {
  if (!(err instanceof AxiosError)) return err;
  sanitizeAxiosError(err);
  if (err.response) {
    const body = err.response.data as HetznerErrorBody | undefined;
    if (body?.error) {
      return new Error(`Hetzner API [${body.error.code}]: ${body.error.message}`, { cause: err });
    }
    return new Error(`Hetzner API error: ${err.response.status} ${err.response.statusText}`, { cause: err });
  }
  if (err.code) {
    return new Error(`Network error: ${err.message}`, { cause: err });
  }
  return err;
}

async function request<T>(
  client: AxiosInstance,
  method: Method,
  path: string,
  data?: unknown,
  params?: Record<string, unknown>
): Promise<T> {
  try {
    const response = await client.request<T>({
      method,
      url: path,
      data,
      params: params ? stripUndefined(params) : undefined,
    });
    return response.data;
  } catch (err) {
    throw wrapHetznerError(err);
  }
}

export async function hetznerRequest<T = unknown>(
  method: Method,
  path: string,
  data?: unknown,
  params?: Record<string, unknown>
): Promise<T> {
  return request<T>(getClient(), method, path, data, params);
}

// Same retry / 429 backoff / error normalization as hetznerRequest, but routed
// to the Storage Box host (api.hetzner.com) with its own token resolution.
export async function storageBoxRequest<T = unknown>(
  method: Method,
  path: string,
  data?: unknown,
  params?: Record<string, unknown>
): Promise<T> {
  return request<T>(getStorageClient(), method, path, data, params);
}
