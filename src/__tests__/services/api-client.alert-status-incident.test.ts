import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from '../../services/api-client.service.js';
import { createMockConfigService, mockClientMethods } from './api-client-test-support.js';

vi.mock('axios', async () => {
  const { createAxiosMock } = await import('./api-client-test-support.js');
  return createAxiosMock();
});

// Covers the alert-channel, status-page and incident resource methods plus the
// health check. Each asserts the exact verb + path (+ payload) sent to the
// axios client and the value unwrapped from the response.
describe('ApiClient alert-channel / status-page / incident methods', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    apiClient = new ApiClient(createMockConfigService());
  });

  describe('alert channels', () => {
    it('getAlertChannel GETs /alert-channels/:id and returns the body', async () => {
      const channel = { id: 'ac1', type: 'email' };
      const get = vi.fn().mockResolvedValue({ data: channel });
      mockClientMethods(apiClient, { get });

      const result = await apiClient.getAlertChannel('ac1');

      expect(get).toHaveBeenCalledWith('/alert-channels/ac1');
      expect(result).toEqual(channel);
    });

    it('createAlertChannel POSTs the payload to /alert-channels', async () => {
      const payload = { type: 'slack', name: 'Ops' };
      const created = { id: 'ac2', ...payload };
      const post = vi.fn().mockResolvedValue({ data: created });
      mockClientMethods(apiClient, { post });

      const result = await apiClient.createAlertChannel(payload);

      expect(post).toHaveBeenCalledWith('/alert-channels', payload);
      expect(result).toEqual(created);
    });

    it('updateAlertChannel PUTs the payload to /alert-channels/:id', async () => {
      const payload = { name: 'Renamed' };
      const put = vi.fn().mockResolvedValue({ data: { id: 'ac1', ...payload } });
      mockClientMethods(apiClient, { put });

      const result = await apiClient.updateAlertChannel('ac1', payload);

      expect(put).toHaveBeenCalledWith('/alert-channels/ac1', payload);
      expect(result).toEqual({ id: 'ac1', name: 'Renamed' });
    });

    it('deleteAlertChannel DELETEs /alert-channels/:id', async () => {
      const del = vi.fn().mockResolvedValue({ data: {} });
      mockClientMethods(apiClient, { delete: del });

      await apiClient.deleteAlertChannel('ac1');

      expect(del).toHaveBeenCalledWith('/alert-channels/ac1');
    });

    it('testAlertChannel POSTs to /alert-channels/:id/test and returns the result', async () => {
      const body = { success: true, message: 'sent' };
      const post = vi.fn().mockResolvedValue({ data: body });
      mockClientMethods(apiClient, { post });

      const result = await apiClient.testAlertChannel('ac1');

      expect(post).toHaveBeenCalledWith('/alert-channels/ac1/test');
      expect(result).toEqual(body);
    });
  });

  describe('status pages', () => {
    it('getStatusPage GETs /status-pages/:id and returns the body', async () => {
      const page = { id: 'sp1', slug: 'status' };
      const get = vi.fn().mockResolvedValue({ data: page });
      mockClientMethods(apiClient, { get });

      const result = await apiClient.getStatusPage('sp1');

      expect(get).toHaveBeenCalledWith('/status-pages/sp1');
      expect(result).toEqual(page);
    });

    it('createStatusPage POSTs the payload to /status-pages', async () => {
      const payload = { name: 'Public', slug: 'public' };
      const created = { id: 'sp2', ...payload };
      const post = vi.fn().mockResolvedValue({ data: created });
      mockClientMethods(apiClient, { post });

      const result = await apiClient.createStatusPage(payload);

      expect(post).toHaveBeenCalledWith('/status-pages', payload);
      expect(result).toEqual(created);
    });

    it('updateStatusPage PUTs the payload to /status-pages/:id', async () => {
      const payload = { name: 'Renamed' };
      const put = vi.fn().mockResolvedValue({ data: { id: 'sp1', ...payload } });
      mockClientMethods(apiClient, { put });

      const result = await apiClient.updateStatusPage('sp1', payload);

      expect(put).toHaveBeenCalledWith('/status-pages/sp1', payload);
      expect(result).toEqual({ id: 'sp1', name: 'Renamed' });
    });

    it('deleteStatusPage DELETEs /status-pages/:id', async () => {
      const del = vi.fn().mockResolvedValue({ data: {} });
      mockClientMethods(apiClient, { delete: del });

      await apiClient.deleteStatusPage('sp1');

      expect(del).toHaveBeenCalledWith('/status-pages/sp1');
    });

    it('addMonitorToStatusPage POSTs the monitor entry', async () => {
      const payload = {
        monitor_type: 'url',
        monitor_id: 'm1',
        display_name: 'Home',
      };
      const entry = { id: 'e1', status_page_id: 'sp1', monitor_id: 'm1' };
      const post = vi.fn().mockResolvedValue({ data: entry });
      mockClientMethods(apiClient, { post });

      const result = await apiClient.addMonitorToStatusPage('sp1', payload);

      expect(post).toHaveBeenCalledWith('/status-pages/sp1/monitors', payload);
      expect(result).toEqual(entry);
    });

    it('removeMonitorFromStatusPage DELETEs the monitor entry', async () => {
      const del = vi.fn().mockResolvedValue({ data: {} });
      mockClientMethods(apiClient, { delete: del });

      await apiClient.removeMonitorFromStatusPage('sp1', 'e1');

      expect(del).toHaveBeenCalledWith('/status-pages/sp1/monitors/e1');
    });

    it('updateStatusPageMonitorOrder PATCHes the display_order', async () => {
      const entry = { id: 'e1', status_page_id: 'sp1', monitor_id: 'm1' };
      const patch = vi.fn().mockResolvedValue({ data: entry });
      mockClientMethods(apiClient, { patch });

      const result = await apiClient.updateStatusPageMonitorOrder('sp1', 'e1', 3);

      expect(patch).toHaveBeenCalledWith('/status-pages/sp1/monitors/e1', {
        display_order: 3,
      });
      expect(result).toEqual(entry);
    });
  });

  describe('incidents', () => {
    it('getIncident GETs /incidents/:id and returns the body', async () => {
      const incident = { id: 'i1', title: 'Outage' };
      const get = vi.fn().mockResolvedValue({ data: incident });
      mockClientMethods(apiClient, { get });

      const result = await apiClient.getIncident('i1');

      expect(get).toHaveBeenCalledWith('/incidents/i1');
      expect(result).toEqual(incident);
    });

    it('createIncident POSTs the payload to /incidents', async () => {
      const payload = { title: 'DB down' };
      const created = { id: 'i2', ...payload };
      const post = vi.fn().mockResolvedValue({ data: created });
      mockClientMethods(apiClient, { post });

      const result = await apiClient.createIncident(payload);

      expect(post).toHaveBeenCalledWith('/incidents', payload);
      expect(result).toEqual(created);
    });

    it('updateIncident PUTs the payload to /incidents/:id', async () => {
      const payload = { status: 'resolved' };
      const put = vi.fn().mockResolvedValue({ data: { id: 'i1', ...payload } });
      mockClientMethods(apiClient, { put });

      const result = await apiClient.updateIncident('i1', payload);

      expect(put).toHaveBeenCalledWith('/incidents/i1', payload);
      expect(result).toEqual({ id: 'i1', status: 'resolved' });
    });

    it('deleteIncident DELETEs /incidents/:id', async () => {
      const del = vi.fn().mockResolvedValue({ data: {} });
      mockClientMethods(apiClient, { delete: del });

      await apiClient.deleteIncident('i1');

      expect(del).toHaveBeenCalledWith('/incidents/i1');
    });

    it('addIncidentComment POSTs the message to the comments endpoint', async () => {
      const event = { id: 'ev1', type: 'comment' };
      const post = vi.fn().mockResolvedValue({ data: event });
      mockClientMethods(apiClient, { post });

      const result = await apiClient.addIncidentComment('i1', 'looking into it');

      expect(post).toHaveBeenCalledWith('/incidents/i1/comments', {
        message: 'looking into it',
      });
      expect(result).toEqual(event);
    });

    it('assignIncident POSTs assigned_to to the assign endpoint', async () => {
      const incident = { id: 'i1', assigned_to: 'u9' };
      const post = vi.fn().mockResolvedValue({ data: incident });
      mockClientMethods(apiClient, { post });

      const result = await apiClient.assignIncident('i1', 'u9');

      expect(post).toHaveBeenCalledWith('/incidents/i1/assign', {
        assigned_to: 'u9',
      });
      expect(result).toEqual(incident);
    });

    it('assignIncident forwards a null userId to unassign', async () => {
      const post = vi.fn().mockResolvedValue({ data: { id: 'i1' } });
      mockClientMethods(apiClient, { post });

      await apiClient.assignIncident('i1', null);

      expect(post).toHaveBeenCalledWith('/incidents/i1/assign', {
        assigned_to: null,
      });
    });
  });

  it('healthCheck GETs /health and returns the status body', async () => {
    const body = { status: 'ok', timestamp: 't', environment: 'dev' };
    const get = vi.fn().mockResolvedValue({ data: body });
    mockClientMethods(apiClient, { get });

    const result = await apiClient.healthCheck();

    expect(get).toHaveBeenCalledWith('/health');
    expect(result).toEqual(body);
  });
});
