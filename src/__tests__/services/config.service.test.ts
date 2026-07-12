import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fs from 'fs';
import { ConfigService } from '../../services/config.service.js';
import Conf from 'conf';
import { ObserveOneConfig } from '../../types/index.js';

// Mock the isDevelopment helper internally
vi.mock('../../services/config.service.js', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import('../../services/config.service.js');
  return {
    ...actual,
  };
});

// The repo root has a real, committed .obs.config.json (used for local dev).
// Stub fs so these tests exercise ConfigService's *global*-store logic in
// isolation, unaffected by that file's actual contents.
vi.mock('fs', async (importActual) => {
  const actual = await importActual<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(false),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  };
});

const mockedFs = vi.mocked(fs);

describe('ConfigService', () => {
  let configService: ConfigService;

  interface MockConf {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
    path: string;
  }

  let mockConf: MockConf;

  beforeEach(() => {
    // Clear relevant env vars
    delete process.env.OBS_API_URL;
    delete process.env.OBS_API_KEY;
    delete process.env.NODE_ENV;
    delete process.env.OBS_ENV;
    delete process.env.OBS_DEV;

    mockConf = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      path: '/mock/path/config.json',
    };
    mockedFs.existsSync.mockReturnValue(false);

    configService = new ConfigService(mockConf as unknown as Conf<ObserveOneConfig>);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('API URL Priority', () => {
    it('uses default API URL in production', () => {
      mockConf.get.mockReturnValue(undefined);
      expect(configService.getApiUrl()).toBe('https://api.observeone.com/api');
    });

    it('uses dev API URL in development', () => {
      process.env.NODE_ENV = 'development';
      mockConf.get.mockReturnValue(undefined);
      expect(configService.getApiUrl()).toBe('http://localhost:8080/api');
    });

    it('uses saved config URL over default', () => {
      mockConf.get.mockImplementation((key: string) => {
        if (key === 'apiUrl') return 'https://config.observeone.com/api';
        return undefined;
      });
      expect(configService.getApiUrl()).toBe('https://config.observeone.com/api');
    });

    it('uses environment variable over saved config', () => {
      process.env.OBS_API_URL = 'https://env.observeone.com/api';
      mockConf.get.mockImplementation((key: string) => {
        if (key === 'apiUrl') return 'https://config.observeone.com/api';
        return undefined;
      });
      expect(configService.getApiUrl()).toBe('https://env.observeone.com/api');
    });

    it('uses command line option over environment variable', () => {
      process.env.OBS_API_URL = 'https://env.observeone.com/api';
      configService.setCommandLineApiUrl('https://cli.observeone.com/api');
      expect(configService.getApiUrl()).toBe('https://cli.observeone.com/api');
    });

    it('ensures API URLs end with /api', () => {
      configService.setCommandLineApiUrl('https://example.com');
      expect(configService.getApiUrl()).toBe('https://example.com/api');

      configService.setCommandLineApiUrl('https://example.com/');
      expect(configService.getApiUrl()).toBe('https://example.com/api');

      configService.setCommandLineApiUrl('https://example.com/api');
      expect(configService.getApiUrl()).toBe('https://example.com/api');

      configService.setCommandLineApiUrl('https://example.com/api/');
      expect(configService.getApiUrl()).toBe('https://example.com/api');
    });
  });

  describe('API Key Priority', () => {
    it('uses saved config key if no env var', () => {
      mockConf.get.mockImplementation((key: string) => {
        if (key === 'apiKey') return 'saved_api_key';
        return undefined;
      });
      expect(configService.getApiKey()).toBe('saved_api_key');
    });

    it('uses env var over saved config key', () => {
      process.env.OBS_API_KEY = 'env_api_key';
      mockConf.get.mockImplementation((key: string) => {
        if (key === 'apiKey') return 'saved_api_key';
        return undefined;
      });
      expect(configService.getApiKey()).toBe('env_api_key');
    });

    it('clears the API key from storage', () => {
      configService.clearApiKey();
      expect(mockConf.delete).toHaveBeenCalledWith('apiKey');
    });
  });

  describe('Runtime --api-key override (session-only, not persisted)', () => {
    it('uses the runtime key over the env var and the global store', () => {
      process.env.OBS_API_KEY = 'env_api_key';
      mockConf.get.mockImplementation((key: string) =>
        key === 'apiKey' ? 'saved_api_key' : undefined
      );

      configService.setCommandLineApiKey('cli_api_key');

      expect(configService.getApiKey()).toBe('cli_api_key');
    });

    it('does NOT write the runtime key to the global Conf store', () => {
      configService.setCommandLineApiKey('cli_api_key');

      // An invalid --api-key must never be persisted to disk before validation.
      expect(mockConf.set).not.toHaveBeenCalled();
      // But it is still honored for the session.
      expect(configService.getApiKey()).toBe('cli_api_key');
    });

    it('returns undefined when no runtime key, env var, or stored key is set', () => {
      mockConf.get.mockReturnValue(undefined);
      expect(configService.getApiKey()).toBeUndefined();
    });
  });

  describe('setApiUrl (persisted write, distinct from the session-only CLI override)', () => {
    it.each([
      ['https://example.com', 'https://example.com/api'],
      ['https://example.com/', 'https://example.com/api'],
      ['https://example.com/api', 'https://example.com/api'],
      ['https://example.com/api/', 'https://example.com/api'],
    ])('normalizes %s to %s and persists it to the global store', (input, expected) => {
      configService.setApiUrl(input);
      expect(mockConf.set).toHaveBeenCalledWith('apiUrl', expected);
    });

    it('round-trips through the store: a persisted URL is later read back via getApiUrl', () => {
      let stored: string | undefined;
      mockConf.set.mockImplementation((key: string, value: string) => {
        if (key === 'apiUrl') stored = value;
      });
      mockConf.get.mockImplementation((key: string) => (key === 'apiUrl' ? stored : undefined));

      configService.setApiUrl('https://round-trip.example.com');
      expect(configService.getApiUrl()).toBe('https://round-trip.example.com/api');
    });
  });

  describe('setApiKey (persisted write, distinct from the session-only CLI override)', () => {
    it('persists the key to the global store', () => {
      configService.setApiKey('persisted-key');
      expect(mockConf.set).toHaveBeenCalledWith('apiKey', 'persisted-key');
    });

    it('round-trips through the store: a persisted key is later read back via getApiKey', () => {
      let stored: string | undefined;
      mockConf.set.mockImplementation((key: string, value: string) => {
        if (key === 'apiKey') stored = value;
      });
      mockConf.get.mockImplementation((key: string) => (key === 'apiKey' ? stored : undefined));

      configService.setApiKey('round-trip-key');
      expect(configService.getApiKey()).toBe('round-trip-key');
    });
  });

  describe('Project config (global + local merge)', () => {
    it('reads the global project config when no local override exists', () => {
      mockConf.get.mockImplementation((key: string) =>
        key === 'project' ? { name: 'global-proj', description: 'from global' } : undefined
      );
      expect(configService.getProjectConfig()).toEqual({
        name: 'global-proj',
        description: 'from global',
      });
    });

    it('persists project config to the global store', () => {
      configService.setProjectConfig({ name: 'new-proj' });
      expect(mockConf.set).toHaveBeenCalledWith('project', { name: 'new-proj' });
    });

    it('defaults to an empty object when neither global nor local project config exists', () => {
      mockConf.get.mockReturnValue(undefined);
      expect(configService.getProjectConfig()).toEqual({});
    });
  });

  describe('Default options (local > global > hardcoded, per-field)', () => {
    it('falls back to hardcoded defaults when nothing is configured', () => {
      mockConf.get.mockReturnValue(undefined);
      expect(configService.getDefaultOptions()).toEqual({
        timeout: 600000,
        retries: 3,
        verbose: false,
        pollIntervalMs: 2000,
        maxAttempts: 300,
      });
    });

    it('uses the global saved options over hardcoded defaults', () => {
      mockConf.get.mockImplementation((key: string) =>
        key === 'defaultOptions'
          ? { timeout: 1000, retries: 5, verbose: true, pollIntervalMs: 500, maxAttempts: 10 }
          : undefined
      );
      expect(configService.getDefaultOptions()).toEqual({
        timeout: 1000,
        retries: 5,
        verbose: true,
        pollIntervalMs: 500,
        maxAttempts: 10,
      });
    });

    it('persists default options to the global store', () => {
      const options = {
        timeout: 2000,
        retries: 1,
        verbose: true,
        pollIntervalMs: 100,
        maxAttempts: 5,
      };
      configService.setDefaultOptions(options);
      expect(mockConf.set).toHaveBeenCalledWith('defaultOptions', options);
    });
  });

  describe('reset / getConfigPath', () => {
    it('reset clears the global store', () => {
      configService.reset();
      expect(mockConf.clear).toHaveBeenCalledTimes(1);
    });

    it('getConfigPath returns the underlying Conf store path', () => {
      expect(configService.getConfigPath()).toBe('/mock/path/config.json');
    });
  });

  describe('OBS_VERBOSE diagnostic logging (getApiKey source trace)', () => {
    it.each([
      [
        'runtime --api-key flag',
        () => configService.setCommandLineApiKey('runtime-key'),
        'Using API key from --api-key flag (session only)',
      ],
      [
        'OBS_API_KEY env var',
        () => {
          process.env.OBS_API_KEY = 'env-key';
        },
        'Using API key from Environment Variable (OBS_API_KEY)',
      ],
      [
        'global OS store',
        () =>
          mockConf.get.mockImplementation((key: string) =>
            key === 'apiKey' ? 'global-key' : undefined
          ),
        'Using API key from Global OS Store',
      ],
    ])('logs the source when resolved from %s', (_label, arrange, expectedSubstring) => {
      process.env.OBS_VERBOSE = 'true';
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      arrange();

      configService.getApiKey();

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(expectedSubstring));
      delete process.env.OBS_VERBOSE;
    });

    it('does not log when OBS_VERBOSE is unset', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      process.env.OBS_API_KEY = 'env-key';

      configService.getApiKey();

      expect(errorSpy).not.toHaveBeenCalled();
    });
  });
});
