import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from '../../services/api-client.service.js';
import { createMockConfigService, mockClientMethods } from './api-client-test-support.js';

// Covers the ApiClient method groups that have no dedicated spec file yet:
// alert channels, status pages, incidents (single-resource + extras), API
// keys (extras), teams, and suite/CI "extra" endpoints. All of these are
// thin get/post/put/patch/delete wrappers, so each test just asserts the
// HTTP call shape and the passthrough/unwrap of the response.
vi.mock('axios', async () => {
  const { createAxiosMock } = await import('./api-client-test-support.js');
  return createAxiosMock();
});

describe('ApiClient remaining CRUD surfaces', () => {
  let apiClient: ApiClient;

  const mockClient = (overrides: Partial<Record<string, unknown>>) =>
    mockClientMethods(apiClient, overrides);

  beforeEach(() => {
    apiClient = new ApiClient(createMockConfigService());
  });

  describe('alert channels', () => {
    it('getAlertChannels returns a bare array as-is', async () => {
      mockClient({ get: vi.fn().mockResolvedValue({ data: [{ id: 'ac1' }] }) });
      expect(await apiClient.getAlertChannels()).toEqual([{ id: 'ac1' }]);
    });

    it('getAlertChannels falls back to .data when not a bare array', async () => {
      mockClient({ get: vi.fn().mockResolvedValue({ data: { data: [{ id: 'ac2' }] } }) });
      expect(await apiClient.getAlertChannels()).toEqual([{ id: 'ac2' }]);
    });

    it('getAlertChannels falls back to [] when neither shape matches', async () => {
      mockClient({ get: vi.fn().mockResolvedValue({ data: {} }) });
      expect(await apiClient.getAlertChannels()).toEqual([]);
    });

    it('getAlertChannel GETs the id path and returns the body', async () => {
      const get = vi.fn().mockResolvedValue({ data: { id: 'ac1', name: 'Ops' } });
      mockClient({ get });
      expect(await apiClient.getAlertChannel('ac1')).toEqual({ id: 'ac1', name: 'Ops' });
      expect(get).toHaveBeenCalledWith('/alert-channels/ac1');
    });

    it('createAlertChannel POSTs to the base path and returns the body', async () => {
      const post = vi.fn().mockResolvedValue({ data: { id: 'new', name: 'Ops' } });
      mockClient({ post });
      const result = await apiClient.createAlertChannel({ name: 'Ops' });
      expect(post).toHaveBeenCalledWith('/alert-channels', { name: 'Ops' });
      expect(result).toEqual({ id: 'new', name: 'Ops' });
    });

    it('updateAlertChannel PUTs to the id path and returns the body', async () => {
      const put = vi.fn().mockResolvedValue({ data: { id: 'ac1', name: 'Renamed' } });
      mockClient({ put });
      const result = await apiClient.updateAlertChannel('ac1', { name: 'Renamed' });
      expect(put).toHaveBeenCalledWith('/alert-channels/ac1', { name: 'Renamed' });
      expect(result).toEqual({ id: 'ac1', name: 'Renamed' });
    });

    it('deleteAlertChannel DELETEs the id path', async () => {
      const del = vi.fn().mockResolvedValue({ data: undefined });
      mockClient({ delete: del });
      await apiClient.deleteAlertChannel('ac1');
      expect(del).toHaveBeenCalledWith('/alert-channels/ac1');
    });

    it('testAlertChannel POSTs to the /test sub-path and returns the result', async () => {
      const post = vi.fn().mockResolvedValue({ data: { success: true, message: 'Sent' } });
      mockClient({ post });
      const result = await apiClient.testAlertChannel('ac1');
      expect(post).toHaveBeenCalledWith('/alert-channels/ac1/test');
      expect(result).toEqual({ success: true, message: 'Sent' });
    });
  });

  describe('status pages', () => {
    it('getStatusPages returns a bare array as-is', async () => {
      mockClient({ get: vi.fn().mockResolvedValue({ data: [{ id: 'sp1' }] }) });
      expect(await apiClient.getStatusPages()).toEqual([{ id: 'sp1' }]);
    });

    it('getStatusPages falls back to .data when not a bare array', async () => {
      mockClient({ get: vi.fn().mockResolvedValue({ data: { data: [{ id: 'sp2' }] } }) });
      expect(await apiClient.getStatusPages()).toEqual([{ id: 'sp2' }]);
    });

    it('getStatusPage GETs the id path', async () => {
      const get = vi.fn().mockResolvedValue({ data: { id: 'sp1', name: 'Status' } });
      mockClient({ get });
      expect(await apiClient.getStatusPage('sp1')).toEqual({ id: 'sp1', name: 'Status' });
      expect(get).toHaveBeenCalledWith('/status-pages/sp1');
    });

    it('createStatusPage POSTs to the base path', async () => {
      const post = vi.fn().mockResolvedValue({ data: { id: 'new', name: 'Status' } });
      mockClient({ post });
      const result = await apiClient.createStatusPage({ name: 'Status' });
      expect(post).toHaveBeenCalledWith('/status-pages', { name: 'Status' });
      expect(result).toEqual({ id: 'new', name: 'Status' });
    });

    it('updateStatusPage PUTs to the id path', async () => {
      const put = vi.fn().mockResolvedValue({ data: { id: 'sp1', name: 'Renamed' } });
      mockClient({ put });
      const result = await apiClient.updateStatusPage('sp1', { name: 'Renamed' });
      expect(put).toHaveBeenCalledWith('/status-pages/sp1', { name: 'Renamed' });
      expect(result).toEqual({ id: 'sp1', name: 'Renamed' });
    });

    it('deleteStatusPage DELETEs the id path', async () => {
      const del = vi.fn().mockResolvedValue({ data: undefined });
      mockClient({ delete: del });
      await apiClient.deleteStatusPage('sp1');
      expect(del).toHaveBeenCalledWith('/status-pages/sp1');
    });

    it('addMonitorToStatusPage POSTs to the monitors sub-path', async () => {
      const post = vi.fn().mockResolvedValue({
        data: { id: 'entry1', status_page_id: 'sp1', monitor_id: 'm1' },
      });
      mockClient({ post });
      const payload = {
        monitor_type: 'url-monitor',
        monitor_id: 'm1',
        display_name: 'Homepage',
      };
      const result = await apiClient.addMonitorToStatusPage('sp1', payload);
      expect(post).toHaveBeenCalledWith('/status-pages/sp1/monitors', payload);
      expect(result).toEqual({ id: 'entry1', status_page_id: 'sp1', monitor_id: 'm1' });
    });

    it('removeMonitorFromStatusPage DELETEs the entry path', async () => {
      const del = vi.fn().mockResolvedValue({ data: undefined });
      mockClient({ delete: del });
      await apiClient.removeMonitorFromStatusPage('sp1', 'entry1');
      expect(del).toHaveBeenCalledWith('/status-pages/sp1/monitors/entry1');
    });

    it('updateStatusPageMonitorOrder PATCHes display_order to the entry path', async () => {
      const patch = vi.fn().mockResolvedValue({
        data: { id: 'entry1', status_page_id: 'sp1', monitor_id: 'm1' },
      });
      mockClient({ patch });
      const result = await apiClient.updateStatusPageMonitorOrder('sp1', 'entry1', 3);
      expect(patch).toHaveBeenCalledWith('/status-pages/sp1/monitors/entry1', {
        display_order: 3,
      });
      expect(result).toEqual({ id: 'entry1', status_page_id: 'sp1', monitor_id: 'm1' });
    });
  });

  describe('incidents (single-resource + extras)', () => {
    it('getIncident GETs the id path', async () => {
      const get = vi.fn().mockResolvedValue({ data: { id: 'i1', title: 'Outage' } });
      mockClient({ get });
      expect(await apiClient.getIncident('i1')).toEqual({ id: 'i1', title: 'Outage' });
      expect(get).toHaveBeenCalledWith('/incidents/i1');
    });

    it('createIncident POSTs to the base path', async () => {
      const post = vi.fn().mockResolvedValue({ data: { id: 'new', title: 'Outage' } });
      mockClient({ post });
      const result = await apiClient.createIncident({ title: 'Outage' });
      expect(post).toHaveBeenCalledWith('/incidents', { title: 'Outage' });
      expect(result).toEqual({ id: 'new', title: 'Outage' });
    });

    it('updateIncident PUTs to the id path', async () => {
      const put = vi.fn().mockResolvedValue({ data: { id: 'i1', title: 'Resolved' } });
      mockClient({ put });
      const result = await apiClient.updateIncident('i1', { title: 'Resolved' });
      expect(put).toHaveBeenCalledWith('/incidents/i1', { title: 'Resolved' });
      expect(result).toEqual({ id: 'i1', title: 'Resolved' });
    });

    it('deleteIncident DELETEs the id path', async () => {
      const del = vi.fn().mockResolvedValue({ data: undefined });
      mockClient({ delete: del });
      await apiClient.deleteIncident('i1');
      expect(del).toHaveBeenCalledWith('/incidents/i1');
    });

    it('addIncidentComment POSTs the message to the comments sub-path', async () => {
      const post = vi.fn().mockResolvedValue({ data: { id: 'ev1', message: 'Investigating' } });
      mockClient({ post });
      const result = await apiClient.addIncidentComment('i1', 'Investigating');
      expect(post).toHaveBeenCalledWith('/incidents/i1/comments', { message: 'Investigating' });
      expect(result).toEqual({ id: 'ev1', message: 'Investigating' });
    });

    it('assignIncident POSTs assigned_to to the assign sub-path', async () => {
      const post = vi.fn().mockResolvedValue({ data: { id: 'i1', assigned_to: 'u1' } });
      mockClient({ post });
      const result = await apiClient.assignIncident('i1', 'u1');
      expect(post).toHaveBeenCalledWith('/incidents/i1/assign', { assigned_to: 'u1' });
      expect(result).toEqual({ id: 'i1', assigned_to: 'u1' });
    });

    it('assignIncident supports unassigning with null', async () => {
      const post = vi.fn().mockResolvedValue({ data: { id: 'i1', assigned_to: null } });
      mockClient({ post });
      await apiClient.assignIncident('i1', null);
      expect(post).toHaveBeenCalledWith('/incidents/i1/assign', { assigned_to: null });
    });
  });

  describe('API keys (extras)', () => {
    it('getApiKeys returns a bare array as-is', async () => {
      mockClient({ get: vi.fn().mockResolvedValue({ data: [{ id: 'k1' }] }) });
      expect(await apiClient.getApiKeys()).toEqual([{ id: 'k1' }]);
    });

    it('getApiKeys unwraps { apiKeys: [] }', async () => {
      mockClient({ get: vi.fn().mockResolvedValue({ data: { apiKeys: [{ id: 'k2' }] } }) });
      expect(await apiClient.getApiKeys()).toEqual([{ id: 'k2' }]);
    });

    it('getApiKeys falls back to [] when apiKeys is absent', async () => {
      mockClient({ get: vi.fn().mockResolvedValue({ data: {} }) });
      expect(await apiClient.getApiKeys()).toEqual([]);
    });

    it('deleteApiKey DELETEs the id path and returns the body', async () => {
      const del = vi.fn().mockResolvedValue({ data: { message: 'Deleted', apiKey: { id: 'k1' } } });
      mockClient({ delete: del });
      const result = await apiClient.deleteApiKey('k1');
      expect(del).toHaveBeenCalledWith('/api-keys/k1');
      expect(result).toEqual({ message: 'Deleted', apiKey: { id: 'k1' } });
    });

    it('toggleApiKey PATCHes the toggle sub-path and returns the body', async () => {
      const patch = vi
        .fn()
        .mockResolvedValue({ data: { message: 'Toggled', apiKey: { id: 'k1', active: false } } });
      mockClient({ patch });
      const result = await apiClient.toggleApiKey('k1');
      expect(patch).toHaveBeenCalledWith('/api-keys/k1/toggle');
      expect(result).toEqual({ message: 'Toggled', apiKey: { id: 'k1', active: false } });
    });
  });

  describe('teams', () => {
    it('getTeams returns a bare array as-is', async () => {
      mockClient({ get: vi.fn().mockResolvedValue({ data: [{ id: 't1' }] }) });
      expect(await apiClient.getTeams()).toEqual([{ id: 't1' }]);
    });

    it('getTeams unwraps { teams: [] }', async () => {
      mockClient({ get: vi.fn().mockResolvedValue({ data: { teams: [{ id: 't2' }] } }) });
      expect(await apiClient.getTeams()).toEqual([{ id: 't2' }]);
    });

    it('getTeams falls back to [] when teams is absent', async () => {
      mockClient({ get: vi.fn().mockResolvedValue({ data: {} }) });
      expect(await apiClient.getTeams()).toEqual([]);
    });

    it('getTeamMembers returns a bare array as-is', async () => {
      const get = vi.fn().mockResolvedValue({ data: [{ id: 'u1' }] });
      mockClient({ get });
      expect(await apiClient.getTeamMembers('t1')).toEqual([{ id: 'u1' }]);
      expect(get).toHaveBeenCalledWith('/teams/t1/members');
    });

    it('getTeamMembers unwraps { members: [] }', async () => {
      mockClient({ get: vi.fn().mockResolvedValue({ data: { members: [{ id: 'u2' }] } }) });
      expect(await apiClient.getTeamMembers('t1')).toEqual([{ id: 'u2' }]);
    });

    it('getTeamMembers falls back to [] when members is absent', async () => {
      mockClient({ get: vi.fn().mockResolvedValue({ data: {} }) });
      expect(await apiClient.getTeamMembers('t1')).toEqual([]);
    });

    it('regenerateTeamInvite POSTs to the sub-path and returns the body', async () => {
      const post = vi
        .fn()
        .mockResolvedValue({ data: { message: 'Regenerated', inviteCode: 'abc123' } });
      mockClient({ post });
      const result = await apiClient.regenerateTeamInvite('t1');
      expect(post).toHaveBeenCalledWith('/teams/t1/regenerate-invite');
      expect(result).toEqual({ message: 'Regenerated', inviteCode: 'abc123' });
    });

    it('removeTeamMember DELETEs the member path and returns the body', async () => {
      const del = vi.fn().mockResolvedValue({ data: { success: true } });
      mockClient({ delete: del });
      const result = await apiClient.removeTeamMember('t1', 'u1');
      expect(del).toHaveBeenCalledWith('/teams/t1/members/u1');
      expect(result).toEqual({ success: true });
    });

    it('updateTeamMemberRole PUTs the role to the member path', async () => {
      const put = vi.fn().mockResolvedValue({ data: { success: true } });
      mockClient({ put });
      const result = await apiClient.updateTeamMemberRole('t1', 'u1', 'admin');
      expect(put).toHaveBeenCalledWith('/teams/t1/members/u1', { role: 'admin' });
      expect(result).toEqual({ success: true });
    });
  });

  describe('suite extras', () => {
    it('toggleSuitePublic PATCHes is_public to the toggle-public sub-path', async () => {
      const patch = vi.fn().mockResolvedValue({ data: { is_public: true } });
      mockClient({ patch });
      const result = await apiClient.toggleSuitePublic('s1', true);
      expect(patch).toHaveBeenCalledWith('/playwright-autopilot/suites/s1/toggle-public', {
        is_public: true,
      });
      expect(result).toEqual({ is_public: true });
    });

    it('healSuite POSTs to the heal sub-path and returns the body', async () => {
      const post = vi
        .fn()
        .mockResolvedValue({ data: { suite_id: 's1', heals: [{ testId: 't1', healId: 'h1' }] } });
      mockClient({ post });
      const result = await apiClient.healSuite('s1');
      expect(post).toHaveBeenCalledWith('/playwright-autopilot/suites/s1/heal', {});
      expect(result).toEqual({ suite_id: 's1', heals: [{ testId: 't1', healId: 'h1' }] });
    });

    it('requestCliAuth POSTs to the auth request path', async () => {
      const post = vi
        .fn()
        .mockResolvedValue({ data: { request_id: 'r1', auth_url: 'https://x/auth' } });
      mockClient({ post });
      const result = await apiClient.requestCliAuth();
      expect(post).toHaveBeenCalledWith('/cli/auth/request');
      expect(result).toEqual({ request_id: 'r1', auth_url: 'https://x/auth' });
    });

    it('checkCliAuthStatus GETs the check path with the request id', async () => {
      const get = vi.fn().mockResolvedValue({ data: { status: 'approved', api_key: 'k1' } });
      mockClient({ get });
      const result = await apiClient.checkCliAuthStatus('r1');
      expect(get).toHaveBeenCalledWith('/cli/auth/check/r1');
      expect(result).toEqual({ status: 'approved', api_key: 'k1' });
    });
  });

  describe('suite CRUD', () => {
    it('getSuite GETs the id path and returns the body', async () => {
      const get = vi.fn().mockResolvedValue({ data: { id: 's1', generated_tests: [] } });
      mockClient({ get });
      const result = await apiClient.getSuite('s1');
      expect(get).toHaveBeenCalledWith('/playwright-autopilot/suites/s1');
      expect(result).toEqual({ id: 's1', generated_tests: [] });
    });

    it('generateSuite POSTs the payload to the base path and returns the body', async () => {
      const post = vi.fn().mockResolvedValue({ data: { id: 'new', generated_tests: [] } });
      mockClient({ post });
      const payload = { target_url: 'https://example.com', suite_name: 'Suite' };
      const result = await apiClient.generateSuite(payload);
      expect(post).toHaveBeenCalledWith('/playwright-autopilot/suites', payload);
      expect(result).toEqual({ id: 'new', generated_tests: [] });
    });

    it('updateSuite PATCHes the id path and returns the body', async () => {
      const patch = vi.fn().mockResolvedValue({ data: { id: 's1', suite_name: 'Renamed' } });
      mockClient({ patch });
      const result = await apiClient.updateSuite('s1', { suite_name: 'Renamed' });
      expect(patch).toHaveBeenCalledWith('/playwright-autopilot/suites/s1', {
        suite_name: 'Renamed',
      });
      expect(result).toEqual({ id: 's1', suite_name: 'Renamed' });
    });

    it('updateSuiteSchedule PATCHes the schedule sub-path and returns the body', async () => {
      const patch = vi.fn().mockResolvedValue({ data: { id: 's1', schedule_active: true } });
      mockClient({ patch });
      const result = await apiClient.updateSuiteSchedule('s1', { schedule_active: true });
      expect(patch).toHaveBeenCalledWith('/playwright-autopilot/suites/s1/schedule', {
        schedule_active: true,
      });
      expect(result).toEqual({ id: 's1', schedule_active: true });
    });

    it('updateSuiteSecrets PATCHes the secrets sub-path', async () => {
      const patch = vi.fn().mockResolvedValue({ data: undefined });
      mockClient({ patch });
      await apiClient.updateSuiteSecrets('s1', { API_KEY: 'abc' });
      expect(patch).toHaveBeenCalledWith('/playwright-autopilot/suites/s1/secrets', {
        secrets: { API_KEY: 'abc' },
      });
    });

    it('getSuiteExecution GETs the execution path and returns the body', async () => {
      const get = vi.fn().mockResolvedValue({ data: { id: 'e1', status: 'COMPLETED' } });
      mockClient({ get });
      const result = await apiClient.getSuiteExecution('s1', 'e1');
      expect(get).toHaveBeenCalledWith('/playwright-autopilot/suites/s1/executions/e1');
      expect(result).toEqual({ id: 'e1', status: 'COMPLETED' });
    });
  });

  describe('api-check / heartbeat "get all" convenience wrappers', () => {
    it('getApiChecks delegates to listApiChecks and returns just the items', async () => {
      const get = vi.fn().mockResolvedValue({ data: { items: [{ id: 'c1' }] } });
      mockClient({ get });
      const result = await apiClient.getApiChecks();
      expect(get).toHaveBeenCalledWith('/api-checks', { params: {} });
      expect(result).toEqual([{ id: 'c1' }]);
    });

    it('listApiChecks normalizes {apiChecks: []}', async () => {
      const get = vi.fn().mockResolvedValue({ data: { apiChecks: [{ id: 'c2' }] } });
      mockClient({ get });
      const result = await apiClient.listApiChecks({ page: 1 });
      expect(get).toHaveBeenCalledWith('/api-checks', { params: { page: 1 } });
      expect(result.items).toEqual([{ id: 'c2' }]);
    });

    it('getHeartbeats delegates to listHeartbeats and returns just the items', async () => {
      const get = vi.fn().mockResolvedValue({ data: { items: [{ id: 'h1' }] } });
      mockClient({ get });
      const result = await apiClient.getHeartbeats();
      expect(get).toHaveBeenCalledWith('/heartbeats', { params: {} });
      expect(result).toEqual([{ id: 'h1' }]);
    });

    it('listHeartbeats normalizes {heartbeats: []}', async () => {
      const get = vi.fn().mockResolvedValue({ data: { heartbeats: [{ id: 'h2' }] } });
      mockClient({ get });
      const result = await apiClient.listHeartbeats({ page: 1 });
      expect(get).toHaveBeenCalledWith('/heartbeats', { params: { page: 1 } });
      expect(result.items).toEqual([{ id: 'h2' }]);
    });
  });

  describe('suite CI + script extras', () => {
    it('generateSuiteCiWebhookToken POSTs and returns the token', async () => {
      const post = vi.fn().mockResolvedValue({ data: { token: 'tok-1' } });
      mockClient({ post });
      const result = await apiClient.generateSuiteCiWebhookToken('s1');
      expect(post).toHaveBeenCalledWith('/playwright-autopilot/suites/s1/ci/generate-token');
      expect(result).toEqual({ token: 'tok-1' });
    });

    it('deleteSuiteCiIntegration DELETEs the ci path', async () => {
      const del = vi.fn().mockResolvedValue({ data: undefined });
      mockClient({ delete: del });
      await apiClient.deleteSuiteCiIntegration('s1');
      expect(del).toHaveBeenCalledWith('/playwright-autopilot/suites/s1/ci');
    });

    it('getSuiteScripts GETs the scripts sub-path', async () => {
      const get = vi.fn().mockResolvedValue({
        data: { suite_id: 's1', tests: [{ id: 't1', name: 'n', code: 'c' }] },
      });
      mockClient({ get });
      const result = await apiClient.getSuiteScripts('s1');
      expect(get).toHaveBeenCalledWith('/playwright-autopilot/suites/s1/scripts');
      expect(result).toEqual({ suite_id: 's1', tests: [{ id: 't1', name: 'n', code: 'c' }] });
    });

    it('updateTestScript PATCHes the code to the test script path', async () => {
      const patch = vi.fn().mockResolvedValue({ data: undefined });
      mockClient({ patch });
      await apiClient.updateTestScript('t1', 'console.log(1)');
      expect(patch).toHaveBeenCalledWith('/playwright-autopilot/tests/t1/script', {
        code: 'console.log(1)',
      });
    });

    it('generateTest POSTs the planned file and returns the new testId', async () => {
      const post = vi.fn().mockResolvedValue({ data: { testId: 't1' } });
      mockClient({ post });
      const result = await apiClient.generateTest('s1', 'planned.spec.ts');
      expect(post).toHaveBeenCalledWith('/playwright-autopilot/suites/s1/generate-test', {
        planned_file: 'planned.spec.ts',
      });
      expect(result).toEqual({ testId: 't1' });
    });

    it('dismissPlannedFile POSTs the planned file and returns the dismissed list', async () => {
      const post = vi
        .fn()
        .mockResolvedValue({ data: { dismissed_planned_files: ['planned.spec.ts'] } });
      mockClient({ post });
      const result = await apiClient.dismissPlannedFile('s1', 'planned.spec.ts');
      expect(post).toHaveBeenCalledWith('/playwright-autopilot/suites/s1/planned-files/dismiss', {
        plannedFile: 'planned.spec.ts',
      });
      expect(result).toEqual({ dismissed_planned_files: ['planned.spec.ts'] });
    });

    it('restorePlannedFile POSTs the planned file and returns the dismissed list', async () => {
      const post = vi.fn().mockResolvedValue({ data: { dismissed_planned_files: [] } });
      mockClient({ post });
      const result = await apiClient.restorePlannedFile('s1', 'planned.spec.ts');
      expect(post).toHaveBeenCalledWith('/playwright-autopilot/suites/s1/planned-files/restore', {
        plannedFile: 'planned.spec.ts',
      });
      expect(result).toEqual({ dismissed_planned_files: [] });
    });

    it('testHealHistory GETs the heal history path', async () => {
      const get = vi.fn().mockResolvedValue({ data: [{ id: 'heal-1' }] });
      mockClient({ get });
      const result = await apiClient.testHealHistory('t1', 'h1');
      expect(get).toHaveBeenCalledWith('/playwright-autopilot/tests/t1/heals/h1/history');
      expect(result).toEqual([{ id: 'heal-1' }]);
    });

    it('deleteSuite DELETEs the suite path', async () => {
      const del = vi.fn().mockResolvedValue({ data: undefined });
      mockClient({ delete: del });
      await apiClient.deleteSuite('s1');
      expect(del).toHaveBeenCalledWith('/playwright-autopilot/suites/s1');
    });
  });

  describe('misc single-purpose endpoints', () => {
    it('healthCheck GETs /health and returns the body', async () => {
      const get = vi
        .fn()
        .mockResolvedValue({ data: { status: 'ok', timestamp: 't', environment: 'prod' } });
      mockClient({ get });
      const result = await apiClient.healthCheck();
      expect(get).toHaveBeenCalledWith('/health');
      expect(result).toEqual({ status: 'ok', timestamp: 't', environment: 'prod' });
    });

    it('getSchedule GETs the id path and unwraps {schedule}', async () => {
      const get = vi.fn().mockResolvedValue({ data: { schedule: { id: 'sch1' } } });
      mockClient({ get });
      const result = await apiClient.getSchedule('sch1');
      expect(get).toHaveBeenCalledWith('/schedules/sch1');
      expect(result).toEqual({ id: 'sch1' });
    });

    it('deleteUrlMonitor DELETEs the id path', async () => {
      const del = vi.fn().mockResolvedValue({ data: undefined });
      mockClient({ delete: del });
      await apiClient.deleteUrlMonitor('m1');
      expect(del).toHaveBeenCalledWith('/url-monitors/m1');
    });

    it('runApiCheck POSTs to the execute sub-path and returns the body', async () => {
      const post = vi.fn().mockResolvedValue({ data: { executions: [], message: 'started' } });
      mockClient({ post });
      const result = await apiClient.runApiCheck('c1');
      expect(post).toHaveBeenCalledWith('/api-checks/c1/execute');
      expect(result).toEqual({ executions: [], message: 'started' });
    });

    it('runUrlMonitor POSTs to the execute sub-path and returns the body', async () => {
      const post = vi.fn().mockResolvedValue({ data: { executions: [], message: 'started' } });
      mockClient({ post });
      const result = await apiClient.runUrlMonitor('m1');
      expect(post).toHaveBeenCalledWith('/url-monitors/m1/execute');
      expect(result).toEqual({ executions: [], message: 'started' });
    });

    it('deleteHeartbeat DELETEs the id path', async () => {
      const del = vi.fn().mockResolvedValue({ data: undefined });
      mockClient({ delete: del });
      await apiClient.deleteHeartbeat('h1');
      expect(del).toHaveBeenCalledWith('/heartbeats/h1');
    });

    it('deleteApiCheck DELETEs the id path', async () => {
      const del = vi.fn().mockResolvedValue({ data: undefined });
      mockClient({ delete: del });
      await apiClient.deleteApiCheck('c1');
      expect(del).toHaveBeenCalledWith('/api-checks/c1');
    });

    it('toggleMuteApiCheck PATCHes the toggle-muted sub-path', async () => {
      const patch = vi
        .fn()
        .mockResolvedValue({ data: { alert_on_failure: false, message: 'Muted' } });
      mockClient({ patch });
      const result = await apiClient.toggleMuteApiCheck('c1');
      expect(patch).toHaveBeenCalledWith('/api-checks/c1/toggle-muted');
      expect(result).toEqual({ alert_on_failure: false, message: 'Muted' });
    });

    it('toggleMuteHeartbeat PATCHes the toggle-muted sub-path', async () => {
      const patch = vi
        .fn()
        .mockResolvedValue({ data: { alert_on_failure: true, message: 'Unmuted' } });
      mockClient({ patch });
      const result = await apiClient.toggleMuteHeartbeat('h1');
      expect(patch).toHaveBeenCalledWith('/heartbeats/h1/toggle-muted');
      expect(result).toEqual({ alert_on_failure: true, message: 'Unmuted' });
    });
  });
});
