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

describe('ApiClient projects', () => {
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

  it('getProjects normalizes {projects: []}', async () => {
    const get = vi.fn().mockResolvedValue({ data: { projects: [{ id: 'p1', name: 'a' }] } });
    mockClient({ get });
    const projects = await apiClient.getProjects();
    expect(get).toHaveBeenCalledWith('/projects');
    expect(projects).toEqual([{ id: 'p1', name: 'a' }]);
  });

  it('getProjects normalizes a bare array', async () => {
    const get = vi.fn().mockResolvedValue({ data: [{ id: 'p2' }] });
    mockClient({ get });
    expect(await apiClient.getProjects()).toEqual([{ id: 'p2' }]);
  });

  it('getProject unwraps {project}', async () => {
    const get = vi.fn().mockResolvedValue({ data: { project: { id: 'p1', name: 'a' } } });
    mockClient({ get });
    const project = await apiClient.getProject('p1');
    expect(get).toHaveBeenCalledWith('/projects/p1');
    expect(project).toEqual({ id: 'p1', name: 'a' });
  });

  it('createProject posts and unwraps {project}', async () => {
    const post = vi.fn().mockResolvedValue({ data: { project: { id: 'new', name: 'a' } } });
    mockClient({ post });
    const created = await apiClient.createProject({ name: 'a', description: 'x' });
    expect(post).toHaveBeenCalledWith('/projects', { name: 'a', description: 'x' });
    expect(created).toEqual({ id: 'new', name: 'a' });
  });

  it('updateProject PUTs and unwraps {project}', async () => {
    const put = vi.fn().mockResolvedValue({ data: { project: { id: 'p1', name: 'b' } } });
    mockClient({ put });
    const updated = await apiClient.updateProject('p1', { name: 'b' });
    expect(put).toHaveBeenCalledWith('/projects/p1', { name: 'b' });
    expect(updated).toEqual({ id: 'p1', name: 'b' });
  });

  it('deleteProject DELETEs the id path', async () => {
    const del = vi.fn().mockResolvedValue({ status: 204 });
    mockClient({ delete: del });
    await apiClient.deleteProject('p1');
    expect(del).toHaveBeenCalledWith('/projects/p1');
  });
});
