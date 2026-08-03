import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from '../../services/api-client.service.js';
import { createMockConfigService, mockClientMethods } from './api-client-test-support.js';

vi.mock('axios', async () => {
  const { createAxiosMock } = await import('./api-client-test-support.js');
  return createAxiosMock();
});

describe('ApiClient projects', () => {
  let apiClient: ApiClient;

  const mockClient = (overrides: Partial<Record<string, unknown>>) =>
    mockClientMethods(apiClient, overrides);

  beforeEach(() => {
    apiClient = new ApiClient(createMockConfigService());
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
