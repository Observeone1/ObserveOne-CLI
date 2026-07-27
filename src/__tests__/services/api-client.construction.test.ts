import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IConfigService } from '../../interfaces/config.interface.js';

type ReqConfig = { headers: Record<string, string>; baseURL?: string };

const hoisted = vi.hoisted(() => ({
  requestInterceptor: undefined as ((c: ReqConfig) => ReqConfig) | undefined,
  createArgs: undefined as Record<string, unknown> | undefined,
}));

// Capture both the axios.create options and the request interceptor so the
// constructor's defaulting can be asserted without a live axios instance.
vi.mock('axios', () => ({
  default: {
    create: vi.fn((options: Record<string, unknown>) => {
      hoisted.createArgs = options;
      return {
        interceptors: {
          request: {
            use: vi.fn((fn: (c: ReqConfig) => ReqConfig) => {
              hoisted.requestInterceptor = fn;
            }),
          },
          response: { use: vi.fn() },
        },
        defaults: { headers: {}, baseURL: 'https://fallback.observeone.com/api' },
        get: vi.fn(),
        post: vi.fn(),
      };
    }),
  },
}));

import { ApiClient } from '../../services/api-client.service.js';

function constructClient(
  overrides: Partial<Record<string, unknown>> = {},
  version?: string
): ApiClient {
  const client = new ApiClient(makeConfig(overrides), version);
  return client;
}

function makeConfig(overrides: Partial<Record<string, unknown>> = {}): IConfigService {
  return {
    getApiKey: vi.fn().mockReturnValue('secret-token'),
    getApiUrl: vi.fn().mockReturnValue('https://api.observeone.com/api'),
    isDevelopment: vi.fn().mockReturnValue(false),
    getDefaultOptions: vi.fn().mockReturnValue({ timeout: 1000 }),
    ...overrides,
  } as unknown as IConfigService;
}

describe('ApiClient construction defaults', () => {
  beforeEach(() => {
    hoisted.requestInterceptor = undefined;
    hoisted.createArgs = undefined;
    vi.restoreAllMocks();
  });

  it('falls back to a 30s timeout when the config supplies none', () => {
    constructClient({ getDefaultOptions: vi.fn().mockReturnValue({}) });
    expect(hoisted.createArgs?.timeout).toBe(30000);
  });

  it('honours an explicit timeout from the config', () => {
    constructClient();
    expect(hoisted.createArgs?.timeout).toBe(1000);
  });

  it('marks the User-Agent as dev when running in development', () => {
    constructClient({ isDevelopment: vi.fn().mockReturnValue(true) }, '9.9.9');
    const headers = hoisted.createArgs?.headers as Record<string, string>;
    expect(headers['User-Agent']).toBe('obs-cli/9.9.9 (dev)');
  });

  it('leaves the auth header off an allowlisted host when no API key is configured', () => {
    constructClient({ getApiKey: vi.fn().mockReturnValue(undefined) });
    const config: ReqConfig = { headers: {} };
    hoisted.requestInterceptor!(config);
    expect(config.headers['x-obs1-cli']).toBeUndefined();
  });

  it('reports "unknown" in the off-host warning when there is no base URL', () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    constructClient({ getApiUrl: vi.fn().mockReturnValue(undefined) });
    hoisted.requestInterceptor!({ headers: {} });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"unknown"'));
  });

  it('reports the raw value when the base URL cannot be parsed as a URL', () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    constructClient({ getApiUrl: vi.fn().mockReturnValue('not-a-url') });
    hoisted.requestInterceptor!({ headers: {} });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"not-a-url"'));
  });
});

describe('ApiClient provisionHeadlessAuth connection errors', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to the client baseURL when the config reports no API URL', async () => {
    const client = new ApiClient(makeConfig({ getApiUrl: vi.fn().mockReturnValue('') }));
    (client as unknown as { client: { post: unknown } }).client.post = vi
      .fn()
      .mockRejectedValue({ code: 'ECONNREFUSED' });

    await expect(client.provisionHeadlessAuth('a@b.c', 'pw')).rejects.toThrow(
      'https://fallback.observeone.com/api'
    );
  });

  it('reports the configured API URL on a network error', async () => {
    const client = new ApiClient(makeConfig());
    (client as unknown as { client: { post: unknown } }).client.post = vi
      .fn()
      .mockRejectedValue({ message: 'Network Error' });

    await expect(client.provisionHeadlessAuth('a@b.c', 'pw')).rejects.toThrow(
      'https://api.observeone.com/api'
    );
  });

  it('rethrows unrelated errors untouched', async () => {
    const client = new ApiClient(makeConfig());
    const original = new Error('boom');
    (client as unknown as { client: { post: unknown } }).client.post = vi
      .fn()
      .mockRejectedValue(original);

    await expect(client.provisionHeadlessAuth('a@b.c', 'pw')).rejects.toBe(original);
  });
});
