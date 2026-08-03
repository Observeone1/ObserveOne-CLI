import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from '../../services/api-client.service.js';
import { ProtocolMonitorKind } from '../../types/index.js';
import { createMockConfigService, mockClientMethods } from './api-client-test-support.js';

vi.mock('axios', async () => {
  const { createAxiosMock } = await import('./api-client-test-support.js');
  return createAxiosMock();
});

const KIND_PATHS: Record<ProtocolMonitorKind, string> = {
  ssl: '/ssl-monitors',
  tcp: '/tcp-monitors',
  udp: '/udp-monitors',
  db: '/db-monitors',
};

describe('ApiClient protocol monitors', () => {
  let apiClient: ApiClient;

  const mockClient = (overrides: Partial<Record<string, unknown>>) =>
    mockClientMethods(apiClient, overrides);

  beforeEach(() => {
    apiClient = new ApiClient(createMockConfigService());
  });

  it.each(Object.entries(KIND_PATHS))(
    'listProtocolMonitors(%s) hits the right path and normalizes {monitors: []}',
    async (kind, path) => {
      const get = vi.fn().mockResolvedValue({ data: { monitors: [{ id: 'm1', name: 'x' }] } });
      mockClient({ get });

      const result = await apiClient.listProtocolMonitors(kind as ProtocolMonitorKind);

      expect(get).toHaveBeenCalledWith(path, { params: {} });
      expect(result.items).toEqual([{ id: 'm1', name: 'x' }]);
    }
  );

  it('getProtocolMonitors returns the items array', async () => {
    const get = vi.fn().mockResolvedValue({ data: [{ id: 'a' }, { id: 'b' }] });
    mockClient({ get });
    const items = await apiClient.getProtocolMonitors('ssl');
    expect(items).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('getProtocolMonitor unwraps a bare object', async () => {
    const get = vi.fn().mockResolvedValue({ data: { id: 'm1', hostname: 'example.com' } });
    mockClient({ get });
    const monitor = await apiClient.getProtocolMonitor('ssl', 'm1');
    expect(get).toHaveBeenCalledWith('/ssl-monitors/m1');
    expect(monitor).toEqual({ id: 'm1', hostname: 'example.com' });
  });

  it('createProtocolMonitor posts to the base path and unwraps {monitor}', async () => {
    const post = vi.fn().mockResolvedValue({ data: { monitor: { id: 'new', name: 'n' } } });
    mockClient({ post });
    const created = await apiClient.createProtocolMonitor('tcp', { name: 'n' });
    expect(post).toHaveBeenCalledWith('/tcp-monitors', { name: 'n' });
    expect(created).toEqual({ id: 'new', name: 'n' });
  });

  it('updateProtocolMonitor PUTs to the id path and unwraps {monitor}', async () => {
    const put = vi.fn().mockResolvedValue({ data: { monitor: { id: 'm1', port: 5432 } } });
    mockClient({ put });
    const updated = await apiClient.updateProtocolMonitor('db', 'm1', { port: 5432 });
    expect(put).toHaveBeenCalledWith('/db-monitors/m1', { port: 5432 });
    expect(updated).toEqual({ id: 'm1', port: 5432 });
  });

  it('deleteProtocolMonitor DELETEs the id path', async () => {
    const del = vi.fn().mockResolvedValue({ data: { message: 'deleted' } });
    mockClient({ delete: del });
    await apiClient.deleteProtocolMonitor('udp', 'm1');
    expect(del).toHaveBeenCalledWith('/udp-monitors/m1');
  });

  it('toggleProtocolMonitor returns is_active', async () => {
    const patch = vi.fn().mockResolvedValue({ data: { is_active: false } });
    mockClient({ patch });
    const active = await apiClient.toggleProtocolMonitor('ssl', 'm1');
    expect(patch).toHaveBeenCalledWith('/ssl-monitors/m1/toggle');
    expect(active).toBe(false);
  });

  it('toggleMuteProtocolMonitor returns the mute payload', async () => {
    const patch = vi
      .fn()
      .mockResolvedValue({ data: { alert_on_failure: true, message: 'Unmuted' } });
    mockClient({ patch });
    const result = await apiClient.toggleMuteProtocolMonitor('tcp', 'm1');
    expect(patch).toHaveBeenCalledWith('/tcp-monitors/m1/toggle-muted');
    expect(result).toEqual({ alert_on_failure: true, message: 'Unmuted' });
  });

  it('runProtocolMonitor posts to /execute', async () => {
    const post = vi
      .fn()
      .mockResolvedValue({ data: { executions: [{ execution_id: 1 }], message: 'started' } });
    mockClient({ post });
    const result = await apiClient.runProtocolMonitor('db', 'm1');
    expect(post).toHaveBeenCalledWith('/db-monitors/m1/execute');
    expect(result.message).toBe('started');
  });

  it('getProtocolMonitorRuns normalizes {executions: []}', async () => {
    const get = vi.fn().mockResolvedValue({ data: { executions: [{ id: 'e1' }] } });
    mockClient({ get });
    const runs = await apiClient.getProtocolMonitorRuns('udp', 'm1', 5);
    expect(get).toHaveBeenCalledWith('/udp-monitors/m1/executions', { params: { limit: 5 } });
    expect(runs).toEqual([{ id: 'e1' }]);
  });
});
