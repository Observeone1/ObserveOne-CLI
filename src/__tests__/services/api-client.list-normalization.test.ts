import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from '../../services/api-client.service.js';
import { createMockConfigService, mockClientMethods } from './api-client-test-support.js';

vi.mock('axios', async () => {
  const { createAxiosMock } = await import('./api-client-test-support.js');
  return createAxiosMock();
});

describe('ApiClient list-response normalization (array vs wrapped-key envelope)', () => {
  let apiClient: ApiClient;

  const mockClient = (overrides: Partial<Record<string, unknown>>) =>
    mockClientMethods(apiClient, overrides);

  beforeEach(() => {
    apiClient = new ApiClient(createMockConfigService());
  });

  // Each of these list endpoints accepts either a bare array or an object
  // wrapping the array under a family-specific key, falling back to `[]`.
  // Table-driven across the family instead of duplicating the same three
  // assertions per method.
  const families: Array<{
    label: string;
    wrapKey: string;
    call: (c: ApiClient) => Promise<unknown[]>;
  }> = [
    { label: 'alert channels', wrapKey: 'data', call: (c) => c.getAlertChannels() },
    { label: 'status pages', wrapKey: 'data', call: (c) => c.getStatusPages() },
    { label: 'api keys', wrapKey: 'apiKeys', call: (c) => c.getApiKeys() },
    { label: 'teams', wrapKey: 'teams', call: (c) => c.getTeams() },
    { label: 'team members', wrapKey: 'members', call: (c) => c.getTeamMembers('team-1') },
  ];

  describe.each(families)('$label', (family) => {
    it('returns the array directly when the response is a bare array', async () => {
      mockClient({ get: vi.fn().mockResolvedValue({ data: [{ id: 'x' }, { id: 'y' }] }) });
      expect(await family.call(apiClient)).toEqual([{ id: 'x' }, { id: 'y' }]);
    });

    it(`unwraps the { ${family.wrapKey}: [] } envelope`, async () => {
      mockClient({ get: vi.fn().mockResolvedValue({ data: { [family.wrapKey]: [{ id: 'z' }] } }) });
      expect(await family.call(apiClient)).toEqual([{ id: 'z' }]);
    });

    it('falls back to an empty array when the wrap key is absent', async () => {
      mockClient({ get: vi.fn().mockResolvedValue({ data: {} }) });
      expect(await family.call(apiClient)).toEqual([]);
    });
  });

  describe('incidents (three-shape: array | {incidents} | {data})', () => {
    it('returns a bare array as-is', async () => {
      mockClient({ get: vi.fn().mockResolvedValue({ data: [{ id: 'i1' }] }) });
      expect(await apiClient.getIncidents()).toEqual([{ id: 'i1' }]);
    });

    it('unwraps { incidents: [] }', async () => {
      mockClient({ get: vi.fn().mockResolvedValue({ data: { incidents: [{ id: 'i2' }] } }) });
      expect(await apiClient.getIncidents()).toEqual([{ id: 'i2' }]);
    });

    it('falls back to { data: [] } when neither array nor incidents key is present', async () => {
      mockClient({ get: vi.fn().mockResolvedValue({ data: { data: [{ id: 'i3' }] } }) });
      expect(await apiClient.getIncidents()).toEqual([{ id: 'i3' }]);
    });

    it('falls back to [] when the response has none of the recognized shapes', async () => {
      mockClient({ get: vi.fn().mockResolvedValue({ data: {} }) });
      expect(await apiClient.getIncidents()).toEqual([]);
    });
  });

  describe('suites (array-or-empty fallback)', () => {
    it('listSuites returns the array as-is', async () => {
      mockClient({ get: vi.fn().mockResolvedValue({ data: [{ id: 's1' }] }) });
      expect(await apiClient.listSuites()).toEqual([{ id: 's1' }]);
    });

    it('listSuites falls back to [] for a non-array response', async () => {
      mockClient({ get: vi.fn().mockResolvedValue({ data: { unexpected: true } }) });
      expect(await apiClient.listSuites()).toEqual([]);
    });

    it('listSuiteExecutions returns the array as-is', async () => {
      mockClient({ get: vi.fn().mockResolvedValue({ data: [{ id: 'e1' }] }) });
      expect(await apiClient.listSuiteExecutions('suite-1')).toEqual([{ id: 'e1' }]);
    });

    it('listSuiteExecutions falls back to [] for a non-array response', async () => {
      mockClient({ get: vi.fn().mockResolvedValue({ data: null }) });
      expect(await apiClient.listSuiteExecutions('suite-1')).toEqual([]);
    });
  });
});
