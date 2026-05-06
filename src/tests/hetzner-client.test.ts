import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AxiosError } from 'axios';

describe('Hetzner HTTP client', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('throws clear error when HETZNER_API_TOKEN is missing', async () => {
    vi.stubEnv('HETZNER_API_TOKEN', '');

    const { hetznerRequest } = await import('../services/hetzner.js');
    await expect(hetznerRequest('GET', '/servers')).rejects.toThrow(
      'HETZNER_API_TOKEN environment variable is required'
    );
  });

  it('parses Hetzner error response into structured message', async () => {
    vi.stubEnv('HETZNER_API_TOKEN', 'test-token');

    const axiosError = new AxiosError(
      'Request failed',
      '422',
      undefined,
      undefined,
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        data: {
          error: {
            code: 'uniqueness_error',
            message: 'server with the same name already exists',
          },
        },
        headers: {},
        config: {} as any,
      }
    );

    vi.doMock('axios', async (importOriginal) => {
      const actual = await importOriginal<typeof import('axios')>();
      return {
        ...actual,
        default: {
          ...actual.default,
          create: () => ({
            interceptors: { response: { use: vi.fn() } },
            request: vi.fn().mockRejectedValue(axiosError),
          }),
        },
      };
    });

    const { hetznerRequest } = await import('../services/hetzner.js');

    await expect(hetznerRequest('POST', '/servers', { name: 'test' })).rejects.toThrow(
      'Hetzner API [uniqueness_error]: server with the same name already exists'
    );
  });

  it('wraps network errors with clear prefix', async () => {
    vi.stubEnv('HETZNER_API_TOKEN', 'test-token');

    const axiosError = new AxiosError(
      'connect ECONNREFUSED 127.0.0.1:443',
      'ECONNREFUSED'
    );

    vi.doMock('axios', async (importOriginal) => {
      const actual = await importOriginal<typeof import('axios')>();
      return {
        ...actual,
        default: {
          ...actual.default,
          create: () => ({
            interceptors: { response: { use: vi.fn() } },
            request: vi.fn().mockRejectedValue(axiosError),
          }),
        },
      };
    });

    const { hetznerRequest } = await import('../services/hetzner.js');

    await expect(hetznerRequest('GET', '/servers')).rejects.toThrow(
      'Network error: connect ECONNREFUSED 127.0.0.1:443'
    );
  });

  it('returns data on successful GET', async () => {
    vi.stubEnv('HETZNER_API_TOKEN', 'test-token');

    vi.doMock('axios', async (importOriginal) => {
      const actual = await importOriginal<typeof import('axios')>();
      return {
        ...actual,
        default: {
          ...actual.default,
          create: () => ({
            interceptors: { response: { use: vi.fn() } },
            request: vi.fn().mockResolvedValue({ data: { servers: [] } }),
          }),
        },
      };
    });

    const { hetznerRequest } = await import('../services/hetzner.js');
    const result = await hetznerRequest('GET', '/servers');
    expect(result).toEqual({ servers: [] });
  });

  it('passes body for POST requests', async () => {
    vi.stubEnv('HETZNER_API_TOKEN', 'test-token');

    const mockRequest = vi.fn().mockResolvedValue({ data: { server: { id: 1 } } });

    vi.doMock('axios', async (importOriginal) => {
      const actual = await importOriginal<typeof import('axios')>();
      return {
        ...actual,
        default: {
          ...actual.default,
          create: () => ({
            interceptors: { response: { use: vi.fn() } },
            request: mockRequest,
          }),
        },
      };
    });

    const { hetznerRequest } = await import('../services/hetzner.js');
    const result = await hetznerRequest('POST', '/servers', { name: 'x' });

    expect(result).toEqual({ server: { id: 1 } });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/servers',
      data: { name: 'x' },
      params: undefined,
    });
  });

  it('throws generic status error when response has no error body', async () => {
    vi.stubEnv('HETZNER_API_TOKEN', 'test-token');

    const axiosError = new AxiosError(
      'Request failed',
      '500',
      undefined,
      undefined,
      {
        status: 500,
        statusText: 'Internal Server Error',
        data: {},
        headers: {},
        config: {} as any,
      }
    );

    vi.doMock('axios', async (importOriginal) => {
      const actual = await importOriginal<typeof import('axios')>();
      return {
        ...actual,
        default: {
          ...actual.default,
          create: () => ({
            interceptors: { response: { use: vi.fn() } },
            request: vi.fn().mockRejectedValue(axiosError),
          }),
        },
      };
    });

    const { hetznerRequest } = await import('../services/hetzner.js');
    await expect(hetznerRequest('GET', '/fail')).rejects.toThrow(
      'Hetzner API error: 500 Internal Server Error'
    );
  });

  it('re-throws non-Axios errors as-is', async () => {
    vi.stubEnv('HETZNER_API_TOKEN', 'test-token');

    const typeError = new TypeError('bad');

    vi.doMock('axios', async (importOriginal) => {
      const actual = await importOriginal<typeof import('axios')>();
      return {
        ...actual,
        default: {
          ...actual.default,
          create: () => ({
            interceptors: { response: { use: vi.fn() } },
            request: vi.fn().mockRejectedValue(typeError),
          }),
        },
      };
    });

    const { hetznerRequest } = await import('../services/hetzner.js');
    await expect(hetznerRequest('GET', '/x')).rejects.toThrow(typeError);
  });

  it('strips undefined params', async () => {
    vi.stubEnv('HETZNER_API_TOKEN', 'test-token');

    const mockRequest = vi.fn().mockResolvedValue({ data: {} });

    vi.doMock('axios', async (importOriginal) => {
      const actual = await importOriginal<typeof import('axios')>();
      return {
        ...actual,
        default: {
          ...actual.default,
          create: () => ({
            interceptors: { response: { use: vi.fn() } },
            request: mockRequest,
          }),
        },
      };
    });

    const { hetznerRequest } = await import('../services/hetzner.js');
    await hetznerRequest('GET', '/x', undefined, { a: 1, b: undefined } as any);

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({ params: { a: 1 } })
    );
  });
});

describe('Rate-limit retry interceptor', () => {
  let errorHandler: Function;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.useFakeTimers();
    vi.stubEnv('HETZNER_API_TOKEN', 'test-token');

    mockRequest = vi.fn().mockResolvedValue({ data: {} });

    vi.doMock('axios', async (importOriginal) => {
      const actual = await importOriginal<typeof import('axios')>();
      return {
        ...actual,
        default: {
          ...actual.default,
          create: () => ({
            interceptors: {
              response: {
                use: (_onSuccess: any, onError: any) => {
                  errorHandler = onError;
                },
              },
            },
            request: mockRequest,
          }),
        },
      };
    });

    // Force client initialization to capture interceptor handlers
    const { hetznerRequest } = await import('../services/hetzner.js');
    await hetznerRequest('GET', '/__init');
    mockRequest.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries 429 with retry-after header', async () => {

    const config = {} as any;
    const error = {
      response: {
        status: 429,
        headers: { 'retry-after': '2' },
      },
      config,
    };

    mockRequest.mockResolvedValue({ data: 'ok' });

    const retryPromise = errorHandler(error);
    await vi.advanceTimersByTimeAsync(2000);
    await retryPromise;

    expect(config.__retryCount).toBe(1);
    expect(mockRequest).toHaveBeenCalledWith(config);
  });

  it('retries 429 with ratelimit-reset header', async () => {
    const now = Date.now();
    const resetUnix = Math.floor(now / 1000) + 3; // 3 seconds from now
    const config = {} as any;
    const error = {
      response: {
        status: 429,
        headers: { 'ratelimit-reset': String(resetUnix) },
      },
      config,
    };

    mockRequest.mockResolvedValue({ data: 'ok' });

    const retryPromise = errorHandler(error);
    await vi.advanceTimersByTimeAsync(3000);
    await retryPromise;

    expect(config.__retryCount).toBe(1);
    expect(mockRequest).toHaveBeenCalledWith(config);
  });

  it('uses exponential backoff when no retry headers present', async () => {
    const config = { __retryCount: 0 } as any;
    const error = {
      response: {
        status: 429,
        headers: {},
      },
      config,
    };

    mockRequest.mockResolvedValue({ data: 'ok' });

    const retryPromise = errorHandler(error);
    // 2^0 * 1000 = 1000ms
    await vi.advanceTimersByTimeAsync(1000);
    await retryPromise;

    expect(config.__retryCount).toBe(1);
  });

  it('rejects after MAX_RETRIES exceeded', async () => {
    const config = { __retryCount: 3 } as any;
    const error = {
      response: {
        status: 429,
        headers: {},
      },
      config,
    };

    await expect(errorHandler(error)).rejects.toThrow(
      'Rate limit exceeded after maximum retries'
    );
  });

  it('passes through non-429 errors without retry', async () => {
    const originalError = {
      response: {
        status: 500,
        headers: {},
      },
      config: {},
    };

    await expect(errorHandler(originalError)).rejects.toBe(originalError);
    expect(mockRequest).not.toHaveBeenCalled();
  });
});

describe('Rate-limit warning on success', () => {
  let successHandler: Function;

  beforeEach(async () => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv('HETZNER_API_TOKEN', 'test-token');

    const mockRequest = vi.fn().mockResolvedValue({ data: {} });

    vi.doMock('axios', async (importOriginal) => {
      const actual = await importOriginal<typeof import('axios')>();
      return {
        ...actual,
        default: {
          ...actual.default,
          create: () => ({
            interceptors: {
              response: {
                use: (onSuccess: any, _onError: any) => {
                  successHandler = onSuccess;
                },
              },
            },
            request: mockRequest,
          }),
        },
      };
    });

    // Force client initialization to capture successHandler
    const { hetznerRequest } = await import('../services/hetzner.js');
    await hetznerRequest('GET', '/__init');
  });

  it('warns when ratelimit-remaining < 100', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = { headers: { 'ratelimit-remaining': '50' }, data: {} };
    successHandler(response);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Rate limit warning: 50 requests remaining')
    );
    consoleSpy.mockRestore();
  });

  it('does not warn when ratelimit-remaining >= 100', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = { headers: { 'ratelimit-remaining': '100' }, data: {} };
    successHandler(response);

    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('Client singleton', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv('HETZNER_API_TOKEN', 'test-token');
  });

  it('reuses the same client across multiple requests', async () => {
    const mockRequest = vi.fn().mockResolvedValue({ data: {} });
    const mockCreate = vi.fn(() => ({
      interceptors: { response: { use: vi.fn() } },
      request: mockRequest,
    }));

    vi.doMock('axios', async (importOriginal) => {
      const actual = await importOriginal<typeof import('axios')>();
      return {
        ...actual,
        default: { ...actual.default, create: mockCreate },
      };
    });

    const { hetznerRequest } = await import('../services/hetzner.js');
    await hetznerRequest('GET', '/first');
    await hetznerRequest('GET', '/second');

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockRequest).toHaveBeenCalledTimes(2);
  });
});

describe('Client configuration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv('HETZNER_API_TOKEN', 'test-token');
  });

  it('configures request timeout', async () => {
    const mockCreate = vi.fn(() => ({
      interceptors: { response: { use: vi.fn() } },
      request: vi.fn().mockResolvedValue({ data: {} }),
    }));

    vi.doMock('axios', async (importOriginal) => {
      const actual = await importOriginal<typeof import('axios')>();
      return {
        ...actual,
        default: { ...actual.default, create: mockCreate },
      };
    });

    const { hetznerRequest } = await import('../services/hetzner.js');
    await hetznerRequest('GET', '/test');

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ timeout: 30_000 })
    );
  });
});
