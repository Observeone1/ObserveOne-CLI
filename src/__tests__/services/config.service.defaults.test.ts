import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Every other config.service spec injects a mock Conf instance via the
// constructor, which means the real `new Conf({...defaults})` initializer
// (and therefore getDefaultApiUrl()'s branches) never runs. Mock the `conf`
// module itself so we can exercise that real construction path and assert
// what defaults it computes, without touching the OS config directory.
const ConfMock = vi.fn();

vi.mock('conf', () => ({
  default: class {
    constructor(...args: unknown[]) {
      ConfMock(...args);
    }
    get() {
      return undefined;
    }
    set() {
      // no-op: these tests only assert on the constructor's seeded defaults
    }
    delete() {
      // no-op: these tests only assert on the constructor's seeded defaults
    }
    clear() {
      // no-op: these tests only assert on the constructor's seeded defaults
    }
    get path() {
      return '/mock/path/config.json';
    }
  },
}));

// Mock fs so the constructor's local-config read never touches a real file.
vi.mock('node:fs', async (importActual) => {
  const actual = await importActual<typeof import('node:fs')>();
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(false),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  };
});

describe('ConfigService default Conf initialization (no injected store)', () => {
  beforeEach(() => {
    ConfMock.mockClear();
    delete process.env.NODE_ENV;
    delete process.env.OBS_ENV;
    delete process.env.OBS_DEV;
    delete process.env.OBS_API_URL;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('seeds the global store with the production API URL when not in development', async () => {
    const { ConfigService } = await import('../../services/config.service.js');
    const service = new ConfigService();
    expect(service).toBeInstanceOf(ConfigService);

    expect(ConfMock).toHaveBeenCalledTimes(1);
    const options = ConfMock.mock.calls[0][0] as { defaults: { apiUrl: string } };
    expect(options.defaults.apiUrl).toBe('https://api.observeone.com/api');
  });

  it('seeds the global store with the localhost dev API URL when NODE_ENV=development', async () => {
    process.env.NODE_ENV = 'development';
    const { ConfigService } = await import('../../services/config.service.js');
    const service = new ConfigService();
    expect(service).toBeInstanceOf(ConfigService);

    const options = ConfMock.mock.calls[0][0] as { defaults: { apiUrl: string } };
    expect(options.defaults.apiUrl).toBe('http://localhost:8080/api');
  });

  it('OBS_API_URL env var overrides the computed default when seeding the store', async () => {
    process.env.OBS_API_URL = 'https://env-seeded.example.com/api';
    const { ConfigService } = await import('../../services/config.service.js');
    const service = new ConfigService();
    expect(service).toBeInstanceOf(ConfigService);

    const options = ConfMock.mock.calls[0][0] as { defaults: { apiUrl: string } };
    expect(options.defaults.apiUrl).toBe('https://env-seeded.example.com/api');
  });

  it('seeds hardcoded default options (timeout, retries, etc.) on first run', async () => {
    const { ConfigService } = await import('../../services/config.service.js');
    const service = new ConfigService();
    expect(service).toBeInstanceOf(ConfigService);

    const options = ConfMock.mock.calls[0][0] as {
      defaults: { defaultOptions: Record<string, unknown> };
    };
    expect(options.defaults.defaultOptions).toEqual({
      timeout: 600000,
      retries: 3,
      verbose: false,
      pollIntervalMs: 2000,
      maxAttempts: 300,
    });
  });
});
