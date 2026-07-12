import { vi } from 'vitest';
import { IConfigService } from '../../interfaces/config.interface.js';

/**
 * Shared axios mock factory for ApiClient specs. Returns a minimal fake
 * AxiosInstance; individual tests override `get`/`post`/`put`/`patch`/
 * `delete` per case via {@link mockClientMethods}.
 *
 * Pass this directly as the `vi.mock('axios', ...)` factory — do not wrap it
 * in another arrow function, or every spec file re-duplicates the same
 * object literal (the thing this helper exists to avoid).
 */
export function createAxiosMock() {
  return {
    default: {
      create: vi.fn().mockReturnValue({
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
        defaults: { headers: {} },
        get: vi.fn(),
      }),
    },
  };
}

/** A ready-to-use IConfigService mock for constructing an ApiClient under test. */
export function createMockConfigService(): IConfigService {
  return {
    getApiKey: vi.fn().mockReturnValue('test-key'),
    getApiUrl: vi.fn().mockReturnValue('https://test-api/api'),
    isDevelopment: vi.fn().mockReturnValue(true),
    getDefaultOptions: vi.fn().mockReturnValue({ timeout: 1000 }),
  } as unknown as IConfigService;
}

/** Overrides methods on an ApiClient's private axios client for one test case. */
export function mockClientMethods(
  apiClient: unknown,
  overrides: Partial<Record<string, unknown>>
): void {
  const client = (apiClient as { client: Record<string, unknown> }).client;
  Object.assign(client, overrides);
}
