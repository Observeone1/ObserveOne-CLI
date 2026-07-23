import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from '../../services/api-client.service.js';
import { createMockConfigService, mockClientMethods } from './api-client-test-support.js';

vi.mock('axios', async () => {
  const { createAxiosMock } = await import('./api-client-test-support.js');
  return createAxiosMock();
});

/**
 * The backend returns the same resource under several envelope shapes
 * (`{entity: T}`, `{data: T}`, or a bare `T`). The happy-path specs only ever
 * exercise the first shape for create/update, so the `??`/`||` fallback legs
 * below are what breaks if the API changes shape. Each case asserts the
 * unwrapped value the caller actually receives.
 */
describe('ApiClient envelope fallbacks', () => {
  let apiClient: ApiClient;

  const mockClient = (overrides: Partial<Record<string, unknown>>) =>
    mockClientMethods(apiClient, overrides);

  beforeEach(() => {
    apiClient = new ApiClient(createMockConfigService());
  });

  describe('url monitors', () => {
    const monitor = { id: 'm1', name: 'Homepage', url: 'https://example.com' };

    it.each([
      ['{ data: T }', { data: monitor }],
      ['bare T', monitor],
    ])('createUrlMonitor unwraps %s', async (_shape, payload) => {
      mockClient({ post: vi.fn().mockResolvedValue({ data: payload }) });
      const result = await apiClient.createUrlMonitor({ name: 'Homepage' });
      expect(result).toMatchObject({ id: 'm1', name: 'Homepage' });
    });

    it.each([
      ['{ data: T }', { data: monitor }],
      ['bare T', monitor],
    ])('updateUrlMonitor unwraps %s', async (_shape, payload) => {
      mockClient({ put: vi.fn().mockResolvedValue({ data: payload }) });
      const result = await apiClient.updateUrlMonitor('m1', { name: 'Homepage' });
      expect(result).toMatchObject({ id: 'm1', name: 'Homepage' });
    });

    it('getUrlMonitor unwraps a bare monitor', async () => {
      mockClient({ get: vi.fn().mockResolvedValue({ data: monitor }) });
      await expect(apiClient.getUrlMonitor('m1')).resolves.toMatchObject({ id: 'm1' });
    });

    it('toggleUrlMonitor reads is_active from the nested envelope and defaults to false', async () => {
      mockClient({ patch: vi.fn().mockResolvedValue({ data: { data: { is_active: true } } }) });
      await expect(apiClient.toggleUrlMonitor('m1')).resolves.toBe(true);

      mockClient({ patch: vi.fn().mockResolvedValue({ data: {} }) });
      await expect(apiClient.toggleUrlMonitor('m1')).resolves.toBe(false);
    });

    it('getUrlMonitorRuns accepts a bare run array as well as an executions envelope', async () => {
      const runs = [{ id: 'r1' }];
      mockClient({ get: vi.fn().mockResolvedValue({ data: runs }) });
      await expect(apiClient.getUrlMonitorRuns('m1')).resolves.toEqual(runs);

      mockClient({ get: vi.fn().mockResolvedValue({ data: { executions: runs } }) });
      await expect(apiClient.getUrlMonitorRuns('m1')).resolves.toEqual(runs);
    });
  });

  describe('protocol monitors', () => {
    it('toggleProtocolMonitor reads the nested envelope and defaults to false', async () => {
      mockClient({ patch: vi.fn().mockResolvedValue({ data: { data: { is_active: true } } }) });
      await expect(apiClient.toggleProtocolMonitor('tcp', 'p1')).resolves.toBe(true);

      mockClient({ patch: vi.fn().mockResolvedValue({ data: {} }) });
      await expect(apiClient.toggleProtocolMonitor('tcp', 'p1')).resolves.toBe(false);
    });

    it('getProtocolMonitorRuns accepts a bare run array', async () => {
      const runs = [{ id: 'r1' }];
      mockClient({ get: vi.fn().mockResolvedValue({ data: runs }) });
      await expect(apiClient.getProtocolMonitorRuns('tcp', 'p1')).resolves.toEqual(runs);
    });
  });

  describe('api checks', () => {
    const check = { id: 'c1', name: 'Health' };

    it.each([
      ['{ data: T }', { data: check }],
      ['bare T', check],
    ])('createApiCheck unwraps %s', async (_shape, payload) => {
      mockClient({ post: vi.fn().mockResolvedValue({ data: payload }) });
      await expect(apiClient.createApiCheck({ name: 'Health' })).resolves.toMatchObject(check);
    });

    it.each([
      ['{ data: T }', { data: check }],
      ['bare T', check],
    ])('updateApiCheck unwraps %s', async (_shape, payload) => {
      mockClient({ put: vi.fn().mockResolvedValue({ data: payload }) });
      await expect(apiClient.updateApiCheck('c1', { name: 'Health' })).resolves.toMatchObject(
        check
      );
    });

    it('getApiCheckRuns accepts a bare run array as well as an executions envelope', async () => {
      const runs = [{ id: 'r1' }];
      mockClient({ get: vi.fn().mockResolvedValue({ data: runs }) });
      await expect(apiClient.getApiCheckRuns('c1')).resolves.toEqual(runs);

      mockClient({ get: vi.fn().mockResolvedValue({ data: { executions: runs } }) });
      await expect(apiClient.getApiCheckRuns('c1')).resolves.toEqual(runs);
    });
  });

  describe('heartbeats', () => {
    const heartbeat = { id: 'h1', name: 'Cron job' };

    it.each([
      ['{ data: T }', { data: heartbeat }],
      ['bare T', heartbeat],
    ])('createHeartbeat unwraps %s', async (_shape, payload) => {
      mockClient({ post: vi.fn().mockResolvedValue({ data: payload }) });
      await expect(apiClient.createHeartbeat({ name: 'Cron job' })).resolves.toMatchObject(
        heartbeat
      );
    });

    it.each([
      ['{ data: T }', { data: heartbeat }],
      ['bare T', heartbeat],
    ])('updateHeartbeat unwraps %s', async (_shape, payload) => {
      mockClient({ put: vi.fn().mockResolvedValue({ data: payload }) });
      await expect(apiClient.updateHeartbeat('h1', { name: 'Cron job' })).resolves.toMatchObject(
        heartbeat
      );
    });

    it('getHeartbeatRuns accepts a bare ping array', async () => {
      const pings = [{ id: 'p1' }];
      mockClient({ get: vi.fn().mockResolvedValue({ data: pings }) });
      await expect(apiClient.getHeartbeatRuns('h1')).resolves.toEqual(pings);
    });
  });

  describe('environments, projects and collections', () => {
    it.each([
      ['{ data: T }', { data: { id: 'e1', name: 'prod' } }],
      ['bare T', { id: 'e1', name: 'prod' }],
    ])('createEnvironment unwraps %s', async (_shape, payload) => {
      mockClient({ post: vi.fn().mockResolvedValue({ data: payload }) });
      await expect(apiClient.createEnvironment({ name: 'prod' })).resolves.toMatchObject({
        id: 'e1',
      });
    });

    it('updateEnvironment unwraps a bare environment', async () => {
      mockClient({ put: vi.fn().mockResolvedValue({ data: { id: 'e1', name: 'prod' } }) });
      await expect(apiClient.updateEnvironment('e1', { name: 'prod' })).resolves.toMatchObject({
        id: 'e1',
      });
    });

    it.each([
      ['{ data: T }', { data: { id: 'pr1', name: 'Storefront' } }],
      ['bare T', { id: 'pr1', name: 'Storefront' }],
    ])('createProject unwraps %s', async (_shape, payload) => {
      mockClient({ post: vi.fn().mockResolvedValue({ data: payload }) });
      await expect(apiClient.createProject({ name: 'Storefront' })).resolves.toMatchObject({
        id: 'pr1',
      });
    });

    it('updateProject unwraps a bare project', async () => {
      mockClient({ put: vi.fn().mockResolvedValue({ data: { id: 'pr1', name: 'Storefront' } }) });
      await expect(apiClient.updateProject('pr1', { name: 'Storefront' })).resolves.toMatchObject({
        id: 'pr1',
      });
    });

    it.each([
      ['{ data: T }', { data: { id: 'ac1', name: 'Billing' } }],
      ['bare T', { id: 'ac1', name: 'Billing' }],
    ])('createApiCollection unwraps %s', async (_shape, payload) => {
      mockClient({ post: vi.fn().mockResolvedValue({ data: payload }) });
      await expect(apiClient.createApiCollection({ name: 'Billing' })).resolves.toMatchObject({
        id: 'ac1',
      });
    });

    it('updateApiCollection unwraps a bare collection', async () => {
      mockClient({ put: vi.fn().mockResolvedValue({ data: { id: 'ac1', name: 'Billing' } }) });
      await expect(
        apiClient.updateApiCollection('ac1', { name: 'Billing' })
      ).resolves.toMatchObject({ id: 'ac1' });
    });
  });

  describe('schedules', () => {
    const schedules = [{ id: 's1', cron_expression: '0 * * * *' }];

    it('getSchedules accepts the nested data envelope and an unknown shape', async () => {
      mockClient({ get: vi.fn().mockResolvedValue({ data: { data: schedules } }) });
      await expect(apiClient.getSchedules()).resolves.toEqual(schedules);

      mockClient({ get: vi.fn().mockResolvedValue({ data: {} }) });
      await expect(apiClient.getSchedules()).resolves.toEqual([]);
    });

    it('getTestSchedules accepts a bare array', async () => {
      mockClient({ get: vi.fn().mockResolvedValue({ data: schedules }) });
      await expect(apiClient.getTestSchedules('t1')).resolves.toEqual(schedules);
    });

    it.each([
      ['resumeSchedule', (c: ApiClient) => c.resumeSchedule('s1')],
      ['stopAllSchedules', (c: ApiClient) => c.stopAllSchedules()],
      ['resumeAllSchedules', (c: ApiClient) => c.resumeAllSchedules()],
    ])('%s defaults to success with an empty message when the body is empty', async (_n, call) => {
      mockClient({ post: vi.fn().mockResolvedValue({ data: {} }) });
      await expect(call(apiClient)).resolves.toEqual({ success: true, message: '' });
    });

    it('resumeSchedule passes through an explicit failure body', async () => {
      mockClient({
        post: vi.fn().mockResolvedValue({ data: { success: false, message: 'nope' } }),
      });
      await expect(apiClient.resumeSchedule('s1')).resolves.toEqual({
        success: false,
        message: 'nope',
      });
    });
  });

  describe('incidents', () => {
    it('returns an empty list when the incidents envelope carries no array', async () => {
      mockClient({ get: vi.fn().mockResolvedValue({ data: { incidents: undefined } }) });
      await expect(apiClient.getIncidents()).resolves.toEqual([]);
    });
  });
});
