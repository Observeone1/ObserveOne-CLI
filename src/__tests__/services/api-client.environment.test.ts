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

describe('ApiClient environments', () => {
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

  it('getEnvironments normalizes {environments: []}', async () => {
    const get = vi.fn().mockResolvedValue({ data: { environments: [{ id: 'e1', name: 'prod' }] } });
    mockClient({ get });
    const envs = await apiClient.getEnvironments();
    expect(get).toHaveBeenCalledWith('/environments');
    expect(envs).toEqual([{ id: 'e1', name: 'prod' }]);
  });

  it('getEnvironment unwraps {environment}', async () => {
    const get = vi.fn().mockResolvedValue({ data: { environment: { id: 'e1', name: 'prod' } } });
    mockClient({ get });
    const env = await apiClient.getEnvironment('e1');
    expect(get).toHaveBeenCalledWith('/environments/e1');
    expect(env).toEqual({ id: 'e1', name: 'prod' });
  });

  it('createEnvironment posts and unwraps {environment}', async () => {
    const post = vi.fn().mockResolvedValue({ data: { environment: { id: 'new', name: 'prod' } } });
    mockClient({ post });
    const created = await apiClient.createEnvironment({ name: 'prod' });
    expect(post).toHaveBeenCalledWith('/environments', { name: 'prod' });
    expect(created).toEqual({ id: 'new', name: 'prod' });
  });

  it('updateEnvironment PUTs and unwraps {environment}', async () => {
    const put = vi.fn().mockResolvedValue({ data: { environment: { id: 'e1', name: 'staging' } } });
    mockClient({ put });
    const updated = await apiClient.updateEnvironment('e1', { name: 'staging' });
    expect(put).toHaveBeenCalledWith('/environments/e1', { name: 'staging' });
    expect(updated).toEqual({ id: 'e1', name: 'staging' });
  });

  it('deleteEnvironment DELETEs the id path', async () => {
    const del = vi.fn().mockResolvedValue({ status: 204 });
    mockClient({ delete: del });
    await apiClient.deleteEnvironment('e1');
    expect(del).toHaveBeenCalledWith('/environments/e1');
  });

  it('updateEnvironmentSecrets sends { secrets } and returns secret_keys only', async () => {
    const put = vi.fn().mockResolvedValue({ data: { secret_keys: ['API_TOKEN'] } });
    mockClient({ put });
    const result = await apiClient.updateEnvironmentSecrets('e1', { API_TOKEN: 'xyz' });
    expect(put).toHaveBeenCalledWith('/environments/e1/secrets', {
      secrets: { API_TOKEN: 'xyz' },
    });
    expect(result).toEqual({ secret_keys: ['API_TOKEN'] });
  });

  it('updateEnvironmentSecrets defaults secret_keys to [] when absent', async () => {
    const put = vi.fn().mockResolvedValue({ data: {} });
    mockClient({ put });
    const result = await apiClient.updateEnvironmentSecrets('e1', { K: '' });
    expect(result).toEqual({ secret_keys: [] });
  });
});
