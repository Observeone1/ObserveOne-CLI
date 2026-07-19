import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from '../../services/api-client.service.js';
import { createMockConfigService, mockClientMethods } from './api-client-test-support.js';

vi.mock('axios', async () => {
  const { createAxiosMock } = await import('./api-client-test-support.js');
  return createAxiosMock();
});

// Covers the remaining previously-untested ApiClient methods (monitor/check/
// heartbeat list-delete-run-mute leftovers, single schedule fetch, api-keys,
// teams, suite extras, CLI auth) plus the response-interceptor error mapping.
describe('ApiClient misc methods', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    apiClient = new ApiClient(createMockConfigService());
  });

  describe('url-monitor / api-check / heartbeat leftovers', () => {
    it('deleteUrlMonitor DELETEs the url monitor', async () => {
      const del = vi.fn().mockResolvedValue({ data: {} });
      mockClientMethods(apiClient, { delete: del });
      await apiClient.deleteUrlMonitor('u1');
      expect(del).toHaveBeenCalledWith('/url-monitors/u1');
    });

    it('runUrlMonitor POSTs to the execute endpoint and returns executions', async () => {
      const body = { executions: [{ execution_id: 1, region: 'us', status: 'ok' }], message: 'go' };
      const post = vi.fn().mockResolvedValue({ data: body });
      mockClientMethods(apiClient, { post });
      const result = await apiClient.runUrlMonitor('u1');
      expect(post).toHaveBeenCalledWith('/url-monitors/u1/execute');
      expect(result).toEqual(body);
    });

    it('runApiCheck POSTs to the execute endpoint and returns executions', async () => {
      const body = { executions: [{ execution_id: 2, region: 'eu', status: 'ok' }], message: 'go' };
      const post = vi.fn().mockResolvedValue({ data: body });
      mockClientMethods(apiClient, { post });
      const result = await apiClient.runApiCheck('c1');
      expect(post).toHaveBeenCalledWith('/api-checks/c1/execute');
      expect(result).toEqual(body);
    });

    it('listApiChecks GETs with query params and normalizes a bare array', async () => {
      const checks = [{ id: 'c1' }, { id: 'c2' }];
      const get = vi.fn().mockResolvedValue({ data: checks });
      mockClientMethods(apiClient, { get });
      const result = await apiClient.listApiChecks();
      expect(get).toHaveBeenCalledWith('/api-checks', { params: {} });
      expect(result.items).toEqual(checks);
      expect(result.pagination.total).toBe(2);
    });

    it('getApiChecks returns just the items array', async () => {
      const get = vi.fn().mockResolvedValue({ data: [{ id: 'c1' }] });
      mockClientMethods(apiClient, { get });
      const result = await apiClient.getApiChecks();
      expect(result).toEqual([{ id: 'c1' }]);
    });

    it('deleteApiCheck DELETEs the api check', async () => {
      const del = vi.fn().mockResolvedValue({ data: {} });
      mockClientMethods(apiClient, { delete: del });
      await apiClient.deleteApiCheck('c1');
      expect(del).toHaveBeenCalledWith('/api-checks/c1');
    });

    it('toggleMuteApiCheck PATCHes toggle-muted and returns the mute state', async () => {
      const body = { alert_on_failure: false, message: 'muted' };
      const patch = vi.fn().mockResolvedValue({ data: body });
      mockClientMethods(apiClient, { patch });
      const result = await apiClient.toggleMuteApiCheck('c1');
      expect(patch).toHaveBeenCalledWith('/api-checks/c1/toggle-muted');
      expect(result).toEqual(body);
    });

    it('listHeartbeats GETs with query params and normalizes a bare array', async () => {
      const beats = [{ id: 'h1' }];
      const get = vi.fn().mockResolvedValue({ data: beats });
      mockClientMethods(apiClient, { get });
      const result = await apiClient.listHeartbeats();
      expect(get).toHaveBeenCalledWith('/heartbeats', { params: {} });
      expect(result.items).toEqual(beats);
    });

    it('getHeartbeats returns just the items array', async () => {
      const get = vi.fn().mockResolvedValue({ data: [{ id: 'h1' }] });
      mockClientMethods(apiClient, { get });
      const result = await apiClient.getHeartbeats();
      expect(result).toEqual([{ id: 'h1' }]);
    });

    it('deleteHeartbeat DELETEs the heartbeat', async () => {
      const del = vi.fn().mockResolvedValue({ data: {} });
      mockClientMethods(apiClient, { delete: del });
      await apiClient.deleteHeartbeat('h1');
      expect(del).toHaveBeenCalledWith('/heartbeats/h1');
    });

    it('toggleMuteHeartbeat PATCHes toggle-muted and returns the mute state', async () => {
      const body = { alert_on_failure: true, message: 'unmuted' };
      const patch = vi.fn().mockResolvedValue({ data: body });
      mockClientMethods(apiClient, { patch });
      const result = await apiClient.toggleMuteHeartbeat('h1');
      expect(patch).toHaveBeenCalledWith('/heartbeats/h1/toggle-muted');
      expect(result).toEqual(body);
    });
  });

  describe('schedules / api-keys / teams / suite-extras / cli-auth', () => {
    it('getSchedule GETs the schedule and unwraps the { schedule } envelope', async () => {
      const schedule = { id: 'sch1', cron_expression: '0 0 * * *' };
      const get = vi.fn().mockResolvedValue({ data: { schedule } });
      mockClientMethods(apiClient, { get });
      const result = await apiClient.getSchedule('sch1');
      expect(get).toHaveBeenCalledWith('/schedules/sch1');
      expect(result).toEqual(schedule);
    });

    it('deleteApiKey DELETEs the key and returns the message body', async () => {
      const body = { message: 'deleted', apiKey: { id: 'k1' } };
      const del = vi.fn().mockResolvedValue({ data: body });
      mockClientMethods(apiClient, { delete: del });
      const result = await apiClient.deleteApiKey('k1');
      expect(del).toHaveBeenCalledWith('/api-keys/k1');
      expect(result).toEqual(body);
    });

    it('toggleApiKey PATCHes toggle and returns the message body', async () => {
      const body = { message: 'toggled', apiKey: { id: 'k1' } };
      const patch = vi.fn().mockResolvedValue({ data: body });
      mockClientMethods(apiClient, { patch });
      const result = await apiClient.toggleApiKey('k1');
      expect(patch).toHaveBeenCalledWith('/api-keys/k1/toggle');
      expect(result).toEqual(body);
    });

    it('regenerateTeamInvite POSTs and returns the new invite code', async () => {
      const body = { message: 'ok', inviteCode: 'INV123' };
      const post = vi.fn().mockResolvedValue({ data: body });
      mockClientMethods(apiClient, { post });
      const result = await apiClient.regenerateTeamInvite('t1');
      expect(post).toHaveBeenCalledWith('/teams/t1/regenerate-invite');
      expect(result).toEqual(body);
    });

    it('removeTeamMember DELETEs the member and returns the body', async () => {
      const del = vi.fn().mockResolvedValue({ data: { removed: true } });
      mockClientMethods(apiClient, { delete: del });
      const result = await apiClient.removeTeamMember('t1', 'u1');
      expect(del).toHaveBeenCalledWith('/teams/t1/members/u1');
      expect(result).toEqual({ removed: true });
    });

    it('updateTeamMemberRole PUTs the role and returns the body', async () => {
      const put = vi.fn().mockResolvedValue({ data: { role: 'admin' } });
      mockClientMethods(apiClient, { put });
      const result = await apiClient.updateTeamMemberRole('t1', 'u1', 'admin');
      expect(put).toHaveBeenCalledWith('/teams/t1/members/u1', { role: 'admin' });
      expect(result).toEqual({ role: 'admin' });
    });

    it('toggleSuitePublic PATCHes is_public and returns the body', async () => {
      const patch = vi.fn().mockResolvedValue({ data: { is_public: true } });
      mockClientMethods(apiClient, { patch });
      const result = await apiClient.toggleSuitePublic('s1', true);
      expect(patch).toHaveBeenCalledWith('/playwright-autopilot/suites/s1/toggle-public', {
        is_public: true,
      });
      expect(result).toEqual({ is_public: true });
    });

    it('healSuite POSTs to the heal endpoint and returns the heals', async () => {
      const body = { suite_id: 's1', heals: [{ testId: 't1', healId: 'h1' }] };
      const post = vi.fn().mockResolvedValue({ data: body });
      mockClientMethods(apiClient, { post });
      const result = await apiClient.healSuite('s1');
      expect(post).toHaveBeenCalledWith('/playwright-autopilot/suites/s1/heal', {});
      expect(result).toEqual(body);
    });

    it('requestCliAuth POSTs to the request endpoint and returns the auth url', async () => {
      const body = { request_id: 'r1', auth_url: 'https://app/auth' };
      const post = vi.fn().mockResolvedValue({ data: body });
      mockClientMethods(apiClient, { post });
      const result = await apiClient.requestCliAuth();
      expect(post).toHaveBeenCalledWith('/cli/auth/request');
      expect(result).toEqual(body);
    });

    it('checkCliAuthStatus GETs the request status', async () => {
      const body = { status: 'approved', api_key: 'sk_1' };
      const get = vi.fn().mockResolvedValue({ data: body });
      mockClientMethods(apiClient, { get });
      const result = await apiClient.checkCliAuthStatus('r1');
      expect(get).toHaveBeenCalledWith('/cli/auth/check/r1');
      expect(result).toEqual(body);
    });
  });

  describe('response interceptor error mapping', () => {
    // The constructor registers `client.interceptors.response.use(ok, onError)`
    // on the mocked axios client, so we can pull the handlers back off the spy.
    const handlers = (client: ApiClient) => {
      const c = client as unknown as {
        client: {
          interceptors: {
            response: { use: { mock: { calls: Array<[unknown, unknown]> } } };
          };
        };
      };
      const [onFulfilled, onRejected] = c.client.interceptors.response.use.mock.calls[0];
      return {
        onFulfilled: onFulfilled as (r: unknown) => unknown,
        onRejected: onRejected as (e: unknown) => unknown,
      };
    };

    it('passes successful responses straight through', () => {
      const { onFulfilled } = handlers(apiClient);
      const response = { data: { ok: 1 } };
      expect(onFulfilled(response)).toBe(response);
    });

    it('maps 401 to a login hint', () => {
      const { onRejected } = handlers(apiClient);
      expect(() => onRejected({ response: { status: 401 } })).toThrow(/Authentication failed/);
    });

    it('maps 403 to an access-denied message', () => {
      const { onRejected } = handlers(apiClient);
      expect(() => onRejected({ response: { status: 403 } })).toThrow(/Access denied/);
    });

    it('maps 404 to a not-found message with the attempted URL', () => {
      const { onRejected } = handlers(apiClient);
      expect(() =>
        onRejected({
          response: { status: 404 },
          config: { baseURL: 'https://api', url: '/x' },
        })
      ).toThrow('Resource not found. (Attempted API URL: https://api/x)');
    });

    it('maps 5xx to a server-error message', () => {
      const { onRejected } = handlers(apiClient);
      expect(() => onRejected({ response: { status: 503 } })).toThrow('Server error: 503');
    });

    it('surfaces the server message for other 4xx errors without leaking headers', () => {
      const { onRejected } = handlers(apiClient);
      expect(() =>
        onRejected({ response: { status: 422, data: { message: 'bad name' } } })
      ).toThrow('bad name');
    });

    it('rethrows the raw error when there is no response (network failure)', () => {
      const { onRejected } = handlers(apiClient);
      const netErr = new Error('ECONNREFUSED');
      expect(() => onRejected(netErr)).toThrow('ECONNREFUSED');
    });
  });
});
