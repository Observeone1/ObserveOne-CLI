import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IConfigService } from '../../interfaces/config.interface.js';

type ReqConfig = { headers: Record<string, string>; baseURL?: string };

const hoisted = vi.hoisted(() => ({
  requestInterceptor: undefined as ((c: ReqConfig) => ReqConfig) | undefined,
}));

// Capture the request interceptor so we can drive it directly with a fake config.
vi.mock('axios', () => ({
  default: {
    create: vi.fn().mockReturnValue({
      interceptors: {
        request: {
          use: vi.fn((fn: (c: ReqConfig) => ReqConfig) => {
            hoisted.requestInterceptor = fn;
          }),
        },
        response: { use: vi.fn() },
      },
      defaults: { headers: {} },
      get: vi.fn(),
    }),
  },
}));

import { ApiClient } from '../../services/api-client.service.js';

function makeConfig(apiUrl: string, isDev = false): IConfigService {
  return {
    getApiKey: vi.fn().mockReturnValue('secret-token'),
    getApiUrl: vi.fn().mockReturnValue(apiUrl),
    isDevelopment: vi.fn().mockReturnValue(isDev),
    getDefaultOptions: vi.fn().mockReturnValue({ timeout: 1000 }),
  } as unknown as IConfigService;
}

describe('ApiClient auth-header host allowlist', () => {
  beforeEach(() => {
    hoisted.requestInterceptor = undefined;
    vi.restoreAllMocks();
  });

  it('attaches x-obs1-cli for an allowlisted host', () => {
    const client = new ApiClient(makeConfig('https://api.observeone.com/api'));
    expect(client).toBeInstanceOf(ApiClient);
    const config: ReqConfig = { headers: {} };
    hoisted.requestInterceptor!(config);
    expect(config.headers['x-obs1-cli']).toBe('secret-token');
  });

  it('strips x-obs1-cli and warns for a non-allowlisted host', () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const client = new ApiClient(makeConfig('https://evil.example.com/api'));
    expect(client).toBeInstanceOf(ApiClient);
    // Simulate the token already present via client.defaults.headers merge.
    const config: ReqConfig = { headers: { 'x-obs1-cli': 'leaked' } };
    hoisted.requestInterceptor!(config);
    expect(config.headers['x-obs1-cli']).toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });

  it('attaches the token for a loopback host (local dev / e2e)', () => {
    const client = new ApiClient(makeConfig('http://localhost:8080/api'));
    expect(client).toBeInstanceOf(ApiClient);
    const config: ReqConfig = { headers: {} };
    hoisted.requestInterceptor!(config);
    expect(config.headers['x-obs1-cli']).toBe('secret-token');
  });

  it('only warns once across repeated off-host requests', () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const client = new ApiClient(makeConfig('https://evil.example.com/api'));
    expect(client).toBeInstanceOf(ApiClient);

    hoisted.requestInterceptor!({ headers: {} });
    hoisted.requestInterceptor!({ headers: {} });
    hoisted.requestInterceptor!({ headers: {} });

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('falls back to the raw base URL in the warning when it is not a parseable URL', () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // isAllowedHost rejects this too (not a real host), and `new URL(...)` on
    // it throws, so warnOffHost must fall back to the raw string instead of
    // crashing.
    const client = new ApiClient(makeConfig('not-a-valid-url'));
    expect(client).toBeInstanceOf(ApiClient);

    hoisted.requestInterceptor!({ headers: {} });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('not-a-valid-url'));
  });
});
