import { IConfigService } from "../../interfaces/config.interface.js";

/**
 * Create a stub implementation of IConfigService for testing
 */
export function createConfigStub(
  overrides?: Partial<IConfigService>
): IConfigService {
  return {
    getApiUrl: () => "http://test.local/api",
    getApiKey: () => "test-api-key",
    setApiUrl: () => {},
    setApiKey: () => {},
    clearApiKey: () => {},
    getProjectConfig: () => ({}),
    setProjectConfig: () => {},
    getDefaultOptions: () => ({
      timeout: 30000,
      retries: 3,
      verbose: false,
      pollIntervalMs: 1000,
      maxAttempts: 10,
    }),
    setDefaultOptions: () => {},
    isDevelopment: () => false,
    reset: () => {},
    getConfigPath: () => "/test/config/path",
    getSupabaseUrl: () => "https://test.supabase.co",
    getSupabaseAnonKey: () => "test-anon-key",
    ...overrides,
  };
}
