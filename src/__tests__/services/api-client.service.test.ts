import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from '../../services/api-client.service.js';
import { IConfigService } from '../../interfaces/config.interface.js';
import axios from 'axios';

// Mock axios instance to avoid real requests
vi.mock('axios', () => {
  return {
    default: {
      create: vi.fn().mockReturnValue({
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() }
        },
        defaults: { headers: {} },
        get: vi.fn()
      })
    }
  };
});

describe('ApiClient', () => {
  let apiClient: ApiClient;
  let mockConfigService: IConfigService;

  beforeEach(() => {
    mockConfigService = {
      getApiKey: vi.fn().mockReturnValue('test-key'),
      getApiUrl: vi.fn().mockReturnValue('http://test-api/api'),
      isDevelopment: vi.fn().mockReturnValue(true),
      getDefaultOptions: vi.fn().mockReturnValue({ timeout: 1000 }),
    } as unknown as IConfigService;
    
    apiClient = new ApiClient(mockConfigService);
  });

  describe('Response Normalization', () => {
    it('normalizes getTests returning {tests: []}', async () => {
      const mockGet = vi.fn().mockResolvedValue({ data: { tests: [{ id: 1, name: 'test' }] } });
      (apiClient as any).client.get = mockGet;
      
      const tests = await apiClient.getTests();
      expect(tests).toEqual([{ id: 1, name: 'test' }]);
    });

    it('normalizes getTests returning [] directly', async () => {
      const mockGet = vi.fn().mockResolvedValue({ data: [{ id: 2, name: 'direct-test' }] });
      (apiClient as any).client.get = mockGet;
      
      const tests = await apiClient.getTests();
      expect(tests).toEqual([{ id: 2, name: 'direct-test' }]);
    });

    it('normalizes getUrlMonitors returning {monitors: []}', async () => {
      const mockGet = vi.fn().mockResolvedValue({ data: { monitors: [{ id: 3, name: 'monitor' }] } });
      (apiClient as any).client.get = mockGet;
      
      const monitors = await apiClient.getUrlMonitors();
      expect(monitors).toEqual([{ id: 3, name: 'monitor' }]);
    });
    
    it('normalizes getUrlMonitors returning {data: []}', async () => {
      const mockGet = vi.fn().mockResolvedValue({ data: { data: [{ id: 4, name: 'monitor-data' }] } });
      (apiClient as any).client.get = mockGet;
      
      const monitors = await apiClient.getUrlMonitors();
      expect(monitors).toEqual([{ id: 4, name: 'monitor-data' }]);
    });

    it('normalizes getUrlMonitors returning [] directly', async () => {
      const mockGet = vi.fn().mockResolvedValue({ data: [{ id: 5, name: 'direct-monitor' }] });
      (apiClient as any).client.get = mockGet;
      
      const monitors = await apiClient.getUrlMonitors();
      expect(monitors).toEqual([{ id: 5, name: 'direct-monitor' }]);
    });
  });
});
