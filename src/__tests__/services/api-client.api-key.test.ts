import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from '../../services/api-client.service.js';
import { createMockConfigService, mockClientMethods } from './api-client-test-support.js';

vi.mock('axios', async () => {
  const { createAxiosMock } = await import('./api-client-test-support.js');
  return createAxiosMock();
});

describe('ApiClient api keys', () => {
  let apiClient: ApiClient;

  const mockClient = (overrides: Partial<Record<string, unknown>>) =>
    mockClientMethods(apiClient, overrides);

  beforeEach(() => {
    apiClient = new ApiClient(createMockConfigService());
  });

  it('createApiKey posts just the name when scopes are omitted', async () => {
    const post = vi.fn().mockResolvedValue({ data: { apiKey: { id: 'k1', name: 'a' } } });
    mockClient({ post });

    const created = await apiClient.createApiKey('a');

    // Omitted scopes clamps to the caller's own scopes server-side -- never send an
    // empty/absent-but-present `scopes` key that could be misread as "grant nothing".
    expect(post).toHaveBeenCalledWith('/api-keys', { name: 'a' });
    expect(created).toEqual({ id: 'k1', name: 'a' });
  });

  it('createApiKey forwards explicit scopes', async () => {
    const post = vi.fn().mockResolvedValue({ data: { apiKey: { id: 'k2', name: 'b' } } });
    mockClient({ post });

    await apiClient.createApiKey('b', ['api-checks:read', 'incidents:read']);

    expect(post).toHaveBeenCalledWith('/api-keys', {
      name: 'b',
      scopes: ['api-checks:read', 'incidents:read'],
    });
  });

  it('getApiKeyScopes fetches the taxonomy', async () => {
    const get = vi.fn().mockResolvedValue({ data: { scopes: ['*', 'api-checks:read'] } });
    mockClient({ get });

    const scopes = await apiClient.getApiKeyScopes();

    expect(get).toHaveBeenCalledWith('/api-keys/scopes');
    expect(scopes).toEqual(['*', 'api-checks:read']);
  });
});
