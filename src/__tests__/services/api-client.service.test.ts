import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from '../../services/api-client.service.js';
import { AxiosInstance } from 'axios';
import { createMockConfigService } from './api-client-test-support.js';

// Mock axios instance to avoid real requests
vi.mock('axios', async () => {
  const { createAxiosMock } = await import('./api-client-test-support.js');
  return createAxiosMock();
});

describe('ApiClient', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    apiClient = new ApiClient(createMockConfigService());
  });

  // The constructor registers the response interceptor via the mocked
  // `client.interceptors.response.use(onFulfilled, onRejected)`. Pull the
  // rejection handler back out so tests can drive it directly.
  function getRejectionHandler(): (error: unknown) => unknown {
    const useMock = (
      apiClient as unknown as {
        client: { interceptors: { response: { use: ReturnType<typeof vi.fn> } } };
      }
    ).client.interceptors.response.use;
    const lastCall = useMock.mock.calls[useMock.mock.calls.length - 1];
    return lastCall[1] as (error: unknown) => unknown;
  }

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

    it('restores the PRIOR key (not undefined) after validating a different candidate', async () => {
      const mockClient = (
        apiClient as unknown as {
          client: { defaults: { headers: Record<string, unknown> }; get: ReturnType<typeof vi.fn> };
        }
      ).client;

      mockClient.defaults.headers['x-obs1-cli'] = 'existing-session-key';
      mockClient.get = vi.fn().mockResolvedValue({ data: { valid: true } });

      await apiClient.validateApiKey('candidate-key');

      // The original session key must be back in place, not left as the
      // candidate and not wiped to undefined.
      expect(mockClient.defaults.headers['x-obs1-cli']).toBe('existing-session-key');
    });

    it('returns false and still restores the header when the request rejects', async () => {
      const mockClient = (
        apiClient as unknown as {
          client: { defaults: { headers: Record<string, unknown> }; get: ReturnType<typeof vi.fn> };
        }
      ).client;

      mockClient.defaults.headers['x-obs1-cli'] = 'existing-session-key';
      mockClient.get = vi.fn().mockRejectedValue(new Error('network down'));

      const result = await apiClient.validateApiKey('candidate-key');

      expect(result).toBe(false);
      expect(mockClient.defaults.headers['x-obs1-cli']).toBe('existing-session-key');
    });

    it('logs the failure reason to stderr under OBS_VERBOSE instead of swallowing it silently', async () => {
      process.env.OBS_VERBOSE = 'true';
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockClient = (
        apiClient as unknown as {
          client: { defaults: { headers: Record<string, unknown> }; get: ReturnType<typeof vi.fn> };
        }
      ).client;
      mockClient.get = vi.fn().mockRejectedValue(new Error('network down'));

      await apiClient.validateApiKey('candidate-key');

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('network down'));
      errorSpy.mockRestore();
      delete process.env.OBS_VERBOSE;
    });
  });

  describe('validateToken (session key check)', () => {
    it('returns false immediately without a request when no apiKey is set', async () => {
      const mockGet = vi.fn();
      (apiClient as unknown as { apiKey: string | undefined }).apiKey = undefined;
      (apiClient as unknown as { client: AxiosInstance }).client.get = mockGet;

      expect(await apiClient.validateToken()).toBe(false);
      expect(mockGet).not.toHaveBeenCalled();
    });

    it('returns true when the API reports the token valid', async () => {
      (apiClient as unknown as { apiKey: string | undefined }).apiKey = 'a-key';
      (apiClient as unknown as { client: AxiosInstance }).client.get = vi
        .fn()
        .mockResolvedValue({ data: { valid: true } });

      expect(await apiClient.validateToken()).toBe(true);
    });

    it('returns false when the request rejects (expired/invalid token)', async () => {
      (apiClient as unknown as { apiKey: string | undefined }).apiKey = 'a-key';
      (apiClient as unknown as { client: AxiosInstance }).client.get = vi
        .fn()
        .mockRejectedValue({ response: { status: 401 } });

      expect(await apiClient.validateToken()).toBe(false);
    });

    it('logs the failure reason to stderr under OBS_VERBOSE instead of swallowing it silently', async () => {
      process.env.OBS_VERBOSE = 'true';
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (apiClient as unknown as { apiKey: string | undefined }).apiKey = 'a-key';
      (apiClient as unknown as { client: AxiosInstance }).client.get = vi
        .fn()
        .mockRejectedValue(new Error('expired token'));

      await apiClient.validateToken();

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('expired token'));
      errorSpy.mockRestore();
      delete process.env.OBS_VERBOSE;
    });
  });

  describe('provisionHeadlessAuth', () => {
    it('returns the api_key on success', async () => {
      (apiClient as unknown as { client: { post: ReturnType<typeof vi.fn> } }).client.post = vi
        .fn()
        .mockResolvedValue({ data: { api_key: 'provisioned-key' } });

      const result = await apiClient.provisionHeadlessAuth('a@b.com', 'pw');
      expect(result).toEqual({ api_key: 'provisioned-key' });
    });

    it('maps ECONNREFUSED to a clear connection-failure message including the attempted URL', async () => {
      (apiClient as unknown as { client: { post: ReturnType<typeof vi.fn> } }).client.post = vi
        .fn()
        .mockRejectedValue({ code: 'ECONNREFUSED' });

      await expect(apiClient.provisionHeadlessAuth()).rejects.toThrow(
        /Failed to connect to ObserveOne API.*https:\/\/test-api\/api/
      );
    });

    it('maps a "Network Error" message the same way as ECONNREFUSED', async () => {
      (apiClient as unknown as { client: { post: ReturnType<typeof vi.fn> } }).client.post = vi
        .fn()
        .mockRejectedValue({ message: 'Network Error' });

      await expect(apiClient.provisionHeadlessAuth()).rejects.toThrow(
        /Failed to connect to ObserveOne API/
      );
    });

    it('re-throws any other error unchanged', async () => {
      const other = new Error('validation failed: bad email');
      (apiClient as unknown as { client: { post: ReturnType<typeof vi.fn> } }).client.post = vi
        .fn()
        .mockRejectedValue(other);

      await expect(apiClient.provisionHeadlessAuth()).rejects.toBe(other);
    });
  });

  describe('setApiKey (in-memory + shared client default header)', () => {
    it('updates the in-memory apiKey and the client default header', () => {
      const mockClient = (
        apiClient as unknown as { client: { defaults: { headers: Record<string, unknown> } } }
      ).client;

      apiClient.setApiKey('fresh-key');

      expect((apiClient as unknown as { apiKey: string }).apiKey).toBe('fresh-key');
      expect(mockClient.defaults.headers['x-obs1-cli']).toBe('fresh-key');
    });
  });

  describe('createApiKey (envelope unwrap)', () => {
    it('unwraps { apiKey: T }', async () => {
      (apiClient as unknown as { client: { post: ReturnType<typeof vi.fn> } }).client.post = vi
        .fn()
        .mockResolvedValue({ data: { apiKey: { id: 'k1', name: 'ci' } } });
      expect(await apiClient.createApiKey('ci')).toEqual({ id: 'k1', name: 'ci' });
    });

    it('falls back to the bare response when there is no apiKey wrapper', async () => {
      (apiClient as unknown as { client: { post: ReturnType<typeof vi.fn> } }).client.post = vi
        .fn()
        .mockResolvedValue({ data: { id: 'k1', name: 'ci' } });
      expect(await apiClient.createApiKey('ci')).toEqual({ id: 'k1', name: 'ci' });
    });
  });

  describe('runSuite (optional test_ids filter)', () => {
    it('sends { test_ids } when a non-empty list is given', async () => {
      const post = vi.fn().mockResolvedValue({ data: { execution_id: 'e1' } });
      (apiClient as unknown as { client: { post: typeof post } }).client.post = post;

      await apiClient.runSuite('suite-1', ['t1', 't2']);

      expect(post).toHaveBeenCalledWith('/playwright-autopilot/suites/suite-1/run', {
        test_ids: ['t1', 't2'],
      });
    });

    it.each([[undefined], [[]]])(
      'sends {} when testIds is %s (run the full suite)',
      async (testIds) => {
        const post = vi.fn().mockResolvedValue({ data: { execution_id: 'e1' } });
        (apiClient as unknown as { client: { post: typeof post } }).client.post = post;

        await apiClient.runSuite('suite-1', testIds);

        expect(post).toHaveBeenCalledWith('/playwright-autopilot/suites/suite-1/run', {});
      }
    );
  });

  describe('getSuiteCiIntegration (delegates to mapSuiteCiIntegration)', () => {
    it('returns null when there is no CI integration configured', async () => {
      (apiClient as unknown as { client: AxiosInstance }).client.get = vi
        .fn()
        .mockResolvedValue({ data: null });
      expect(await apiClient.getSuiteCiIntegration('suite-1')).toBeNull();
    });

    it('maps a configured integration payload through to the typed result', async () => {
      (apiClient as unknown as { client: AxiosInstance }).client.get = vi.fn().mockResolvedValue({
        data: { provider: 'github', repo_slug: 'org/repo', connected: true },
      });
      const result = await apiClient.getSuiteCiIntegration('suite-1');
      expect(result).not.toBeNull();
    });
  });

  describe('generic get/post passthrough', () => {
    it('post returns response.data', async () => {
      (apiClient as unknown as { client: { post: ReturnType<typeof vi.fn> } }).client.post = vi
        .fn()
        .mockResolvedValue({ data: { ok: true } });
      expect(await apiClient.post('/anything', { a: 1 })).toEqual({ ok: true });
    });

    it('get returns response.data', async () => {
      (apiClient as unknown as { client: AxiosInstance }).client.get = vi
        .fn()
        .mockResolvedValue({ data: { ok: true } });
      expect(await apiClient.get('/anything')).toEqual({ ok: true });
    });
  });

  describe('response interceptor status mapping', () => {
    it.each([
      [401, 'Authentication failed. Run "obs login"'],
      [403, 'Access denied. You do not have permission to perform this action.'],
      [500, 'Server error: 500'],
      [503, 'Server error: 503'],
    ])('maps HTTP %s to the expected message', (status, expectedSubstring) => {
      const onRejected = getRejectionHandler();
      // toThrowError does a substring match on a plain string — no need to
      // hand-build a RegExp (and escape it) for this.
      expect(() => onRejected({ response: { status } })).toThrowError(expectedSubstring);
    });

    it('maps 404 to a not-found message including the attempted URL', () => {
      const onRejected = getRejectionHandler();
      expect(() =>
        onRejected({
          response: { status: 404 },
          config: { baseURL: 'https://api.observeone.com/api', url: '/url-monitors/xyz' },
        })
      ).toThrowError(
        'Resource not found. (Attempted API URL: https://api.observeone.com/api/url-monitors/xyz)'
      );
    });

    it('maps 404 with no config to "unknown" attempted URL', () => {
      const onRejected = getRejectionHandler();
      expect(() => onRejected({ response: { status: 404 } })).toThrowError(
        'Resource not found. (Attempted API URL: unknown)'
      );
    });
  });
});
