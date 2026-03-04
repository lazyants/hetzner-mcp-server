import axios, { AxiosInstance, AxiosError, Method } from 'axios';
import { HETZNER_API_BASE, MAX_RETRIES, REQUEST_TIMEOUT } from '../constants.js';

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

function createClient(): AxiosInstance {
  const client = axios.create({
    baseURL: HETZNER_API_BASE,
    timeout: REQUEST_TIMEOUT,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
    },
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
    clientInstance = createClient();
  }
  return clientInstance;
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

export async function hetznerRequest<T = unknown>(
  method: Method,
  path: string,
  data?: unknown,
  params?: Record<string, unknown>
): Promise<T> {
  try {
    const client = getClient();
    const response = await client.request<T>({
      method,
      url: path,
      data,
      params: params ? stripUndefined(params) : undefined,
    });
    return response.data;
  } catch (err) {
    if (err instanceof AxiosError && err.response) {
      const body = err.response.data as HetznerErrorBody | undefined;
      if (body?.error) {
        throw new Error(`Hetzner API [${body.error.code}]: ${body.error.message}`);
      }
      throw new Error(`Hetzner API error: ${err.response.status} ${err.response.statusText}`);
    }
    if (err instanceof AxiosError && err.code) {
      throw new Error(`Network error: ${err.message}`);
    }
    throw err;
  }
}
