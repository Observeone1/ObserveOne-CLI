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

  describe('response interceptor (no auth-token leak on client errors)', () => {
    // The constructor registers the response interceptor via the mocked
    // `client.interceptors.response.use(onFulfilled, onRejected)`. Pull the
    // rejection handler back out so we can drive it directly.
    function getRejectionHandler(): (error: unknown) => unknown {
      const useMock = (
        apiClient as unknown as {
          client: { interceptors: { response: { use: ReturnType<typeof vi.fn> } } };
        }
      ).client.interceptors.response.use;
      const lastCall = useMock.mock.calls[useMock.mock.calls.length - 1];
      return lastCall[1] as (error: unknown) => unknown;
    }

    it('surfaces a 422 as a clean Error with the server message and no auth header attached', () => {
      const onRejected = getRejectionHandler();
      const axiosError = {
        message: 'Request failed with status code 422',
        config: {
          url: '/api-checks',
          headers: { 'x-obs1-cli': 'super-secret-token', 'Content-Type': 'application/json' },
        },
        response: { status: 422, data: { message: 'Validation failed: url is required' } },
      };

      let thrown: unknown;
      try {
        onRejected(axiosError);
      } catch (e) {
        thrown = e;
      }

      // A clean Error carrying ONLY the server message — not the raw axios
      // error, and without any config/headers that would leak the token.
      expect(thrown).toBeInstanceOf(Error);
      expect(thrown).not.toBe(axiosError);
      expect((thrown as Error).message).toBe('Validation failed: url is required');
      expect((thrown as { config?: unknown }).config).toBeUndefined();
    });

    it('re-throws the raw error (preserving .code) when there is no response', () => {
      const onRejected = getRejectionHandler();
      // Network error: no `response`, carries a `.code` that callers branch on.
      const networkError = { code: 'ECONNREFUSED', message: 'connect ECONNREFUSED 127.0.0.1' };

      let thrown: unknown;
      try {
        onRejected(networkError);
      } catch (e) {
        thrown = e;
      }

      // Must be the SAME object (not a wrapped Error) so `.code` survives.
      expect(thrown).toBe(networkError);
    });

    it('falls back to the .error field, then a generic status message', () => {
      const onRejected = getRejectionHandler();

      let fromError: unknown;
      try {
        onRejected({
          config: { headers: {} },
          response: { status: 409, data: { error: 'conflict' } },
        });
      } catch (e) {
        fromError = e;
      }
      expect((fromError as Error).message).toBe('conflict');

      let fromStatus: unknown;
      try {
        onRejected({ config: { headers: {} }, response: { status: 400, data: {} } });
      } catch (e) {
        fromStatus = e;
      }
      expect((fromStatus as Error).message).toBe('Request failed with status 400');
    });
  });

  describe('validateApiKey (never mutates shared client default header)', () => {
    it('restores the default x-obs1-cli header to its pre-call value when there was no prior key', async () => {
      const mockClient = (
        apiClient as unknown as {
          client: { defaults: { headers: Record<string, unknown> }; get: ReturnType<typeof vi.fn> };
        }
      ).client;

      // No key was set on the client defaults before validation.
      delete mockClient.defaults.headers['x-obs1-cli'];
      mockClient.get = vi.fn().mockResolvedValue({ data: { valid: true } });

      const result = await apiClient.validateApiKey('candidate-key');

      expect(result).toBe(true);
      // The candidate key must NOT be left attached to the shared client.
      expect(mockClient.defaults.headers['x-obs1-cli']).toBeUndefined();
    });
  });
});
