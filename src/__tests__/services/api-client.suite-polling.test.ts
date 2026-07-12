import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from '../../services/api-client.service.js';
import { IConfigService } from '../../interfaces/config.interface.js';
import { Suite } from '../../types/index.js';

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

describe('ApiClient suite polling loops', () => {
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

  const setGetSuite = (impl: (id: string) => Promise<Suite>) => {
    (apiClient as unknown as { getSuite: typeof impl }).getSuite = impl;
  };

  describe('pollSuiteTests (resolves once enough tests are generated)', () => {
    it('resolves as soon as generated_tests.length reaches expectedCount', async () => {
      let calls = 0;
      const getSuite = vi.fn(async () => {
        calls++;
        return {
          generated_tests: new Array(calls).fill({}),
        } as unknown as Suite;
      });
      setGetSuite(getSuite);

      const suite = await apiClient.pollSuiteTests('suite-1', 3, 10, 0);

      expect(getSuite).toHaveBeenCalledTimes(3);
      expect(suite.generated_tests).toHaveLength(3);
    });

    it('gives up after maxAttempts and returns whatever the last getSuite call returned', async () => {
      const finalSuite = { generated_tests: [{}] } as unknown as Suite;
      const getSuite = vi.fn().mockResolvedValue(finalSuite);
      setGetSuite(getSuite);

      const suite = await apiClient.pollSuiteTests('suite-1', 99, 2, 0);

      // 2 attempts inside the loop + 1 final fetch after the loop exits.
      expect(getSuite).toHaveBeenCalledTimes(3);
      expect(suite).toBe(finalSuite);
    });
  });

  describe('pollSuiteGeneration (resolves on scheduled/failed status)', () => {
    it.each(['scheduled', 'failed'])('resolves as soon as status becomes "%s"', async (status) => {
      const getSuite = vi.fn().mockResolvedValue({ status } as unknown as Suite);
      setGetSuite(getSuite);

      const suite = await apiClient.pollSuiteGeneration('suite-1', 5, 0);

      expect(getSuite).toHaveBeenCalledTimes(1);
      expect(suite.status).toBe(status);
    });

    it('keeps polling while status is neither scheduled nor failed, then throws after maxAttempts', async () => {
      const getSuite = vi.fn().mockResolvedValue({ status: 'generating' } as unknown as Suite);
      setGetSuite(getSuite);

      await expect(apiClient.pollSuiteGeneration('suite-1', 3, 0)).rejects.toThrow(
        'Suite generation did not complete within the timeout period'
      );
      expect(getSuite).toHaveBeenCalledTimes(3);
    });
  });

  describe('pollSuiteExecution (resolves on COMPLETED/FAILED status)', () => {
    it.each(['COMPLETED', 'FAILED'])('resolves as soon as status becomes "%s"', async (status) => {
      const getSuiteExecution = vi.fn().mockResolvedValue({ status });
      (apiClient as unknown as { getSuiteExecution: typeof getSuiteExecution }).getSuiteExecution =
        getSuiteExecution;

      const execution = await apiClient.pollSuiteExecution('suite-1', 'exec-1', 5, 0);

      expect(getSuiteExecution).toHaveBeenCalledTimes(1);
      expect(execution.status).toBe(status);
    });

    it('throws the timeout error after exhausting maxAttempts on a non-terminal status', async () => {
      const getSuiteExecution = vi.fn().mockResolvedValue({ status: 'RUNNING' });
      (apiClient as unknown as { getSuiteExecution: typeof getSuiteExecution }).getSuiteExecution =
        getSuiteExecution;

      await expect(apiClient.pollSuiteExecution('suite-1', 'exec-1', 2, 0)).rejects.toThrow(
        'Suite execution did not complete within the timeout period'
      );
      expect(getSuiteExecution).toHaveBeenCalledTimes(2);
    });
  });
});
