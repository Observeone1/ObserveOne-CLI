import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from '../../services/api-client.service.js';
import { IConfigService } from '../../interfaces/config.interface.js';
import { AxiosInstance } from 'axios';

// Mock axios instance to avoid real requests
vi.mock('axios', () => {
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
      (apiClient as unknown as { client: AxiosInstance }).client.get = mockGet;

      const tests = await apiClient.getTests();
      expect(tests).toEqual([{ id: 1, name: 'test' }]);
    });

    it('normalizes getTests returning [] directly', async () => {
      const mockGet = vi.fn().mockResolvedValue({ data: [{ id: 2, name: 'direct-test' }] });
      (apiClient as unknown as { client: AxiosInstance }).client.get = mockGet;

      const tests = await apiClient.getTests();
      expect(tests).toEqual([{ id: 2, name: 'direct-test' }]);
    });

    it('normalizes getUrlMonitors returning {monitors: []}', async () => {
      const mockGet = vi
        .fn()
        .mockResolvedValue({ data: { monitors: [{ id: 3, name: 'monitor' }] } });
      (apiClient as unknown as { client: AxiosInstance }).client.get = mockGet;

      const monitors = await apiClient.getUrlMonitors();
      expect(monitors).toEqual([{ id: 3, name: 'monitor' }]);
    });

    it('normalizes getUrlMonitors returning {data: []}', async () => {
      const mockGet = vi
        .fn()
        .mockResolvedValue({ data: { data: [{ id: 4, name: 'monitor-data' }] } });
      (apiClient as unknown as { client: AxiosInstance }).client.get = mockGet;

      const monitors = await apiClient.getUrlMonitors();
      expect(monitors).toEqual([{ id: 4, name: 'monitor-data' }]);
    });

    it('normalizes getUrlMonitors returning {items, pagination}', async () => {
      const mockGet = vi.fn().mockResolvedValue({
        data: {
          items: [{ id: 6, name: 'paginated-monitor' }],
          pagination: { page: 2, limit: 10, total: 11, totalPages: 2 },
        },
      });
      (apiClient as unknown as { client: AxiosInstance }).client.get = mockGet;

      const result = await apiClient.listUrlMonitors({ page: 2, limit: 10 });
      expect(result).toEqual({
        items: [{ id: 6, name: 'paginated-monitor' }],
        pagination: { page: 2, limit: 10, total: 11, totalPages: 2 },
      });
    });

    it('normalizes getUrlMonitors returning [] directly', async () => {
      const mockGet = vi.fn().mockResolvedValue({ data: [{ id: 5, name: 'direct-monitor' }] });
      (apiClient as unknown as { client: AxiosInstance }).client.get = mockGet;

      const monitors = await apiClient.getUrlMonitors();
      expect(monitors).toEqual([{ id: 5, name: 'direct-monitor' }]);
    });

    it('normalizes monitor runs returning {executions: []}', async () => {
      const mockGet = vi.fn().mockResolvedValue({ data: { executions: [{ id: 101 }] } });
      (apiClient as unknown as { client: AxiosInstance }).client.get = mockGet;

      const runs = await apiClient.getUrlMonitorRuns('1', 5);
      expect(runs).toEqual([{ id: 101 }]);
    });

    it('normalizes API check runs returning [] directly', async () => {
      const mockGet = vi.fn().mockResolvedValue({ data: [{ id: 202 }] });
      (apiClient as unknown as { client: AxiosInstance }).client.get = mockGet;

      const runs = await apiClient.getApiCheckRuns('1', 5);
      expect(runs).toEqual([{ id: 202 }]);
    });

    it('normalizes heartbeat runs returning {pings: []}', async () => {
      const mockGet = vi.fn().mockResolvedValue({ data: { pings: [{ id: 303 }] } });
      (apiClient as unknown as { client: AxiosInstance }).client.get = mockGet;

      const runs = await apiClient.getHeartbeatRuns('1', 5);
      expect(runs).toEqual([{ id: 303 }]);
    });
  });

  describe('poll error handling (fail fast on 4xx)', () => {
    it('pollExecutionStatus throws immediately on a 4xx without looping maxAttempts', async () => {
      const axios404 = { response: { status: 404 } };
      const mockStatus = vi.fn().mockRejectedValue(axios404);
      (apiClient as unknown as { getExecutionStatus: typeof mockStatus }).getExecutionStatus =
        mockStatus;

      await expect(apiClient.pollExecutionStatus(123, 60, 0)).rejects.toBe(axios404);
      // Without the fix this would be called 60 times before giving up.
      expect(mockStatus).toHaveBeenCalledTimes(1);
    });

    it('pollExecutionStatus keeps retrying a transient 5xx until maxAttempts', async () => {
      const axios503 = { response: { status: 503 } };
      const mockStatus = vi.fn().mockRejectedValue(axios503);
      (apiClient as unknown as { getExecutionStatus: typeof mockStatus }).getExecutionStatus =
        mockStatus;

      await expect(apiClient.pollExecutionStatus(123, 3, 0)).rejects.toBe(axios503);
      expect(mockStatus).toHaveBeenCalledTimes(3);
    });

    it('pollExecutionStatus keeps retrying a transient (network) error until maxAttempts', async () => {
      // No `response` field — looks like a network/timeout error, must retry.
      const networkErr = new Error('ECONNRESET');
      const mockStatus = vi.fn().mockRejectedValue(networkErr);
      (apiClient as unknown as { getExecutionStatus: typeof mockStatus }).getExecutionStatus =
        mockStatus;

      await expect(apiClient.pollExecutionStatus(123, 3, 0)).rejects.toBe(networkErr);
      expect(mockStatus).toHaveBeenCalledTimes(3);
    });

    it('pollSuiteExecution throws immediately on a 4xx without looping maxAttempts', async () => {
      const axios404 = { response: { status: 404 } };
      const mockExec = vi.fn().mockRejectedValue(axios404);
      (apiClient as unknown as { getSuiteExecution: typeof mockExec }).getSuiteExecution = mockExec;

      await expect(apiClient.pollSuiteExecution('suite-1', 'exec-1', 60, 0)).rejects.toBe(axios404);
      expect(mockExec).toHaveBeenCalledTimes(1);
    });

    it('pollSuiteExecution keeps retrying a transient 5xx until maxAttempts', async () => {
      const axios500 = { response: { status: 500 } };
      const mockExec = vi.fn().mockRejectedValue(axios500);
      (apiClient as unknown as { getSuiteExecution: typeof mockExec }).getSuiteExecution = mockExec;

      await expect(apiClient.pollSuiteExecution('suite-1', 'exec-1', 3, 0)).rejects.toBe(axios500);
      expect(mockExec).toHaveBeenCalledTimes(3);
    });
  });
});
