import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
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
});
