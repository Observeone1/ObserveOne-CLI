import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from '../../services/api-client.service.js';
import { createMockConfigService, mockClientMethods } from './api-client-test-support.js';

vi.mock('axios', async () => {
  const { createAxiosMock } = await import('./api-client-test-support.js');
  return createAxiosMock();
});

describe('ApiClient api collections', () => {
  let apiClient: ApiClient;

  const mockClient = (overrides: Partial<Record<string, unknown>>) =>
    mockClientMethods(apiClient, overrides);

  beforeEach(() => {
    apiClient = new ApiClient(createMockConfigService());
  });

  it('getApiCollections normalizes {collections: []}', async () => {
    const get = vi.fn().mockResolvedValue({ data: { collections: [{ id: 'c1', name: 'a' }] } });
    mockClient({ get });
    const collections = await apiClient.getApiCollections();
    expect(get).toHaveBeenCalledWith('/api-collections');
    expect(collections).toEqual([{ id: 'c1', name: 'a' }]);
  });

  it('getApiCollection unwraps {collection}', async () => {
    const get = vi.fn().mockResolvedValue({ data: { collection: { id: 'c1', name: 'a' } } });
    mockClient({ get });
    const collection = await apiClient.getApiCollection('c1');
    expect(get).toHaveBeenCalledWith('/api-collections/c1');
    expect(collection).toEqual({ id: 'c1', name: 'a' });
  });

  it('createApiCollection posts and unwraps {collection}', async () => {
    const post = vi.fn().mockResolvedValue({ data: { collection: { id: 'new', name: 'a' } } });
    mockClient({ post });
    const created = await apiClient.createApiCollection({
      name: 'a',
      base_url: 'https://x',
      headers: { Authorization: 'Bearer t' },
    });
    expect(post).toHaveBeenCalledWith('/api-collections', {
      name: 'a',
      base_url: 'https://x',
      headers: { Authorization: 'Bearer t' },
    });
    expect(created).toEqual({ id: 'new', name: 'a' });
  });

  it('updateApiCollection PUTs and unwraps {collection}', async () => {
    const put = vi.fn().mockResolvedValue({ data: { collection: { id: 'c1', name: 'b' } } });
    mockClient({ put });
    const updated = await apiClient.updateApiCollection('c1', { name: 'b' });
    expect(put).toHaveBeenCalledWith('/api-collections/c1', { name: 'b' });
    expect(updated).toEqual({ id: 'c1', name: 'b' });
  });

  it('deleteApiCollection DELETEs the id path', async () => {
    const del = vi.fn().mockResolvedValue({ status: 204 });
    mockClient({ delete: del });
    await apiClient.deleteApiCollection('c1');
    expect(del).toHaveBeenCalledWith('/api-collections/c1');
  });
});
