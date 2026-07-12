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

describe('ApiClient url-monitor / api-check / heartbeat CRUD', () => {
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

  // Three families (url-monitors, api-checks, heartbeats) each expose
  // get/create/update methods that unwrap the response through the same
  // three envelope shapes: `{entityKey: T}`, `{data: T}`, or a bare `T`.
  // Table-drive it once instead of three near-identical describe blocks.
  const families: Array<{
    label: string;
    entityKey: string;
    basePath: string;
    get: (c: ApiClient, id: string) => Promise<unknown>;
    create: (c: ApiClient, data: Record<string, unknown>) => Promise<unknown>;
    update: (c: ApiClient, id: string, data: Record<string, unknown>) => Promise<unknown>;
    toggle: (c: ApiClient, id: string) => Promise<boolean>;
  }> = [
    {
      label: 'api-check',
      entityKey: 'apiCheck',
      basePath: '/api-checks',
      get: (c, id) => c.getApiCheck(id),
      create: (c, data) => c.createApiCheck(data),
      update: (c, id, data) => c.updateApiCheck(id, data),
      toggle: (c, id) => c.toggleApiCheck(id),
    },
    {
      label: 'heartbeat',
      entityKey: 'heartbeat',
      basePath: '/heartbeats',
      get: (c, id) => c.getHeartbeat(id),
      create: (c, data) => c.createHeartbeat(data),
      update: (c, id, data) => c.updateHeartbeat(id, data),
      toggle: (c, id) => c.toggleHeartbeat(id),
    },
  ];

  describe.each(families)('$label envelope unwrap', (family) => {
    it.each([
      ['{ [entityKey]: T }', { [family.entityKey]: { id: 'e1', name: 'n' } }],
      ['{ data: T }', { data: { id: 'e1', name: 'n' } }],
      ['bare T', { id: 'e1', name: 'n' }],
    ])('get unwraps %s', async (_shape, payload) => {
      mockClient({ get: vi.fn().mockResolvedValue({ data: payload }) });
      const result = await family.get(apiClient, 'e1');
      expect(result).toEqual({ id: 'e1', name: 'n' });
    });

    it('create posts to the base path and unwraps the envelope', async () => {
      const post = vi
        .fn()
        .mockResolvedValue({ data: { [family.entityKey]: { id: 'new', name: 'created' } } });
      mockClient({ post });
      const result = await family.create(apiClient, { name: 'created' });
      expect(post).toHaveBeenCalledWith(family.basePath, { name: 'created' });
      expect(result).toEqual({ id: 'new', name: 'created' });
    });

    it('update PUTs to the id path and unwraps the envelope', async () => {
      const put = vi
        .fn()
        .mockResolvedValue({ data: { [family.entityKey]: { id: 'e1', name: 'updated' } } });
      mockClient({ put });
      const result = await family.update(apiClient, 'e1', { name: 'updated' });
      expect(put).toHaveBeenCalledWith(`${family.basePath}/e1`, { name: 'updated' });
      expect(result).toEqual({ id: 'e1', name: 'updated' });
    });

    it.each([
      ['is_active present', { is_active: true }, true],
      ['nested data.is_active', { data: { is_active: false } }, false],
      ['neither present, falls back to false', {}, false],
    ])('toggle resolves is_active: %s', async (_case, payload, expected) => {
      mockClient({ patch: vi.fn().mockResolvedValue({ data: payload }) });
      expect(await family.toggle(apiClient, 'e1')).toBe(expected);
    });
  });

  describe('url-monitor (interval <-> cron_expression mapping, distinct from the shared families)', () => {
    it('getUrlMonitor unwraps {monitor} and maps cron_expression back to interval', async () => {
      mockClient({
        get: vi
          .fn()
          .mockResolvedValue({ data: { monitor: { id: 'm1', cron_expression: '*/5 * * * *' } } }),
      });
      const result = await apiClient.getUrlMonitor('m1');
      expect(result).toEqual({ id: 'm1', interval: '*/5 * * * *' });
    });

    it('createUrlMonitor translates interval -> cron_expression in the outgoing payload', async () => {
      const post = vi
        .fn()
        .mockResolvedValue({ data: { monitor: { id: 'new', cron_expression: '* * * * *' } } });
      mockClient({ post });

      await apiClient.createUrlMonitor({ name: 'n', url: 'https://x.com', interval: '* * * * *' });

      expect(post).toHaveBeenCalledWith('/url-monitors', {
        name: 'n',
        url: 'https://x.com',
        cron_expression: '* * * * *',
      });
    });

    it('createUrlMonitor omits cron_expression entirely when interval is not provided', async () => {
      const post = vi.fn().mockResolvedValue({ data: { monitor: { id: 'new' } } });
      mockClient({ post });

      await apiClient.createUrlMonitor({ name: 'n' });

      expect(post).toHaveBeenCalledWith('/url-monitors', { name: 'n' });
    });

    it('updateUrlMonitor translates interval -> cron_expression the same way', async () => {
      const put = vi
        .fn()
        .mockResolvedValue({ data: { monitor: { id: 'm1', cron_expression: '0 * * * *' } } });
      mockClient({ put });

      await apiClient.updateUrlMonitor('m1', { interval: '0 * * * *' });

      expect(put).toHaveBeenCalledWith('/url-monitors/m1', { cron_expression: '0 * * * *' });
    });

    it('deleteUrlMonitor DELETEs the id path', async () => {
      const del = vi.fn().mockResolvedValue({ data: {} });
      mockClient({ delete: del });
      await apiClient.deleteUrlMonitor('m1');
      expect(del).toHaveBeenCalledWith('/url-monitors/m1');
    });

    it.each([
      ['is_active present', { is_active: true }, true],
      ['nested data.is_active', { data: { is_active: false } }, false],
    ])('toggleUrlMonitor resolves is_active: %s', async (_case, payload, expected) => {
      const patch = vi.fn().mockResolvedValue({ data: payload });
      mockClient({ patch });
      expect(await apiClient.toggleUrlMonitor('m1')).toBe(expected);
      expect(patch).toHaveBeenCalledWith('/url-monitors/m1/toggle');
    });

    it('toggleMuteUrlMonitor returns the mute payload', async () => {
      const patch = vi
        .fn()
        .mockResolvedValue({ data: { alert_on_failure: false, message: 'Muted' } });
      mockClient({ patch });
      const result = await apiClient.toggleMuteUrlMonitor('m1');
      expect(patch).toHaveBeenCalledWith('/url-monitors/m1/toggle-muted');
      expect(result).toEqual({ alert_on_failure: false, message: 'Muted' });
    });
  });

  describe('heartbeat extras', () => {
    it('resetHeartbeat posts to /reset and returns the fresh heartbeat', async () => {
      const post = vi.fn().mockResolvedValue({ data: { id: 'h1', status: 'up' } });
      mockClient({ post });
      const result = await apiClient.resetHeartbeat('h1');
      expect(post).toHaveBeenCalledWith('/heartbeats/h1/reset');
      expect(result).toEqual({ id: 'h1', status: 'up' });
    });

    it('deleteHeartbeat DELETEs the id path', async () => {
      const del = vi.fn().mockResolvedValue({ data: {} });
      mockClient({ delete: del });
      await apiClient.deleteHeartbeat('h1');
      expect(del).toHaveBeenCalledWith('/heartbeats/h1');
    });
  });

  describe('api-check extras', () => {
    it('deleteApiCheck DELETEs the id path', async () => {
      const del = vi.fn().mockResolvedValue({ data: {} });
      mockClient({ delete: del });
      await apiClient.deleteApiCheck('c1');
      expect(del).toHaveBeenCalledWith('/api-checks/c1');
    });
  });
});
