import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from '../../services/api-client.service.js';
import { IConfigService } from '../../interfaces/config.interface.js';

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

describe('ApiClient schedules', () => {
  let apiClient: ApiClient;
  let mockConfigService: IConfigService;

  const mockClient = (overrides: Partial<Record<string, unknown>>) => {
    const client = (apiClient as unknown as { client: Record<string, unknown> }).client;
    Object.assign(client, overrides);
  };

  beforeEach(() => {
    mockConfigService = {
      getApiKey: vi.fn().mockReturnValue('test-key'),
      getApiUrl: vi.fn().mockReturnValue('http://test-api/api'),
      isDevelopment: vi.fn().mockReturnValue(true),
      getDefaultOptions: vi.fn().mockReturnValue({ timeout: 1000 }),
    } as unknown as IConfigService;

    apiClient = new ApiClient(mockConfigService);
  });

  it('getSchedules normalizes a bare array', async () => {
    const get = vi.fn().mockResolvedValue({ data: [{ id: 's1' }, { id: 's2' }] });
    mockClient({ get });
    const schedules = await apiClient.getSchedules();
    expect(get).toHaveBeenCalledWith('/schedules');
    expect(schedules).toEqual([{ id: 's1' }, { id: 's2' }]);
  });

  it('getSchedules normalizes {schedules: []}', async () => {
    const get = vi.fn().mockResolvedValue({ data: { schedules: [{ id: 's3' }] } });
    mockClient({ get });
    expect(await apiClient.getSchedules()).toEqual([{ id: 's3' }]);
  });

  it('getTestSchedules hits the per-test path', async () => {
    const get = vi.fn().mockResolvedValue({ data: [{ id: 's1' }] });
    mockClient({ get });
    await apiClient.getTestSchedules('t1');
    expect(get).toHaveBeenCalledWith('/schedules/test/t1');
  });

  it('createSchedule POSTs the camelCase payload to /schedules/create', async () => {
    const post = vi.fn().mockResolvedValue({ data: { id: 'new', test_id: 't1' } });
    mockClient({ post });
    const created = await apiClient.createSchedule({
      testId: 't1',
      cronExpression: '*/5 * * * *',
      retryCount: 2,
    });
    expect(post).toHaveBeenCalledWith('/schedules/create', {
      testId: 't1',
      cronExpression: '*/5 * * * *',
      retryCount: 2,
    });
    expect(created).toEqual({ id: 'new', test_id: 't1' });
  });

  it('updateSchedule PUTs snake_case updates to /schedules/:id', async () => {
    const put = vi.fn().mockResolvedValue({ data: { id: 's1', cron_expression: '0 0 * * *' } });
    mockClient({ put });
    await apiClient.updateSchedule('s1', { cron_expression: '0 0 * * *', retry_count: 3 });
    expect(put).toHaveBeenCalledWith('/schedules/s1', {
      cron_expression: '0 0 * * *',
      retry_count: 3,
    });
  });

  it('deleteSchedule DELETEs the id path', async () => {
    const del = vi.fn().mockResolvedValue({ data: { message: 'ok' } });
    mockClient({ delete: del });
    await apiClient.deleteSchedule('s1');
    expect(del).toHaveBeenCalledWith('/schedules/s1');
  });

  it('stopSchedule / resumeSchedule POST to the right sub-paths', async () => {
    const post = vi.fn().mockResolvedValue({ data: { success: true, message: 'done' } });
    mockClient({ post });
    await apiClient.stopSchedule('s1');
    expect(post).toHaveBeenCalledWith('/schedules/s1/stop');
    await apiClient.resumeSchedule('s1');
    expect(post).toHaveBeenCalledWith('/schedules/s1/resume');
  });

  it('stopAllSchedules / resumeAllSchedules hit the bulk-all endpoints', async () => {
    const post = vi.fn().mockResolvedValue({ data: { success: true, message: 'all' } });
    mockClient({ post });
    await apiClient.stopAllSchedules();
    expect(post).toHaveBeenCalledWith('/schedules/stop-all');
    await apiClient.resumeAllSchedules();
    expect(post).toHaveBeenCalledWith('/schedules/resume-all');
  });

  it('stop returns a normalized {success,message} even when the body is sparse', async () => {
    const post = vi.fn().mockResolvedValue({ data: {} });
    mockClient({ post });
    expect(await apiClient.stopSchedule('s1')).toEqual({ success: true, message: '' });
  });
});
