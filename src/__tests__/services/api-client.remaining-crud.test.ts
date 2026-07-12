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

type Verb = 'get' | 'post' | 'put' | 'patch' | 'delete';

/**
 * A single thin-wrapper test case: mock the given HTTP verb to resolve with
 * `responseData`, invoke the method under test, and assert the call shape
 * (and, unless `checkResult` is `false`, the resolved value).
 */
interface EndpointCase {
  name: string;
  verb: Verb;
  responseData?: unknown;
  invoke: () => Promise<unknown>;
  expectedArgs: unknown[];
  expectedResult?: unknown;
  checkResult?: boolean;
}

describe('ApiClient remaining CRUD surfaces', () => {
  let apiClient: ApiClient;

  const mockClient = (overrides: Partial<Record<string, unknown>>) =>
    mockClientMethods(apiClient, overrides);

  beforeEach(() => {
    apiClient = new ApiClient(createMockConfigService());
  });

  // Runs a table of thin-wrapper cases: mock `verb`, invoke, assert the call
  // args and (by default) the resolved value equals `responseData`.
  function runEndpointCases(cases: EndpointCase[]) {
    it.each(cases)('$name', async (testCase) => {
      const fn = vi.fn().mockResolvedValue({ data: testCase.responseData });
      mockClient({ [testCase.verb]: fn });
      const result = await testCase.invoke();
      expect(fn).toHaveBeenCalledWith(...testCase.expectedArgs);
      if (testCase.checkResult === false) return;
      expect(result).toEqual(testCase.expectedResult ?? testCase.responseData);
    });
  }

  describe('alert channels', () => {
    it.each([
      ['bare array', [{ id: 'ac1' }], [{ id: 'ac1' }]],
      ['.data fallback', { data: [{ id: 'ac2' }] }, [{ id: 'ac2' }]],
      ['neither shape matches', {}, []],
    ])('getAlertChannels returns %s', async (_label, responseData, expected) => {
      mockClient({ get: vi.fn().mockResolvedValue({ data: responseData }) });
      expect(await apiClient.getAlertChannels()).toEqual(expected);
    });

    runEndpointCases([
      {
        name: 'getAlertChannel GETs the id path and returns the body',
        verb: 'get',
        responseData: { id: 'ac1', name: 'Ops' },
        invoke: () => apiClient.getAlertChannel('ac1'),
        expectedArgs: ['/alert-channels/ac1'],
      },
      {
        name: 'createAlertChannel POSTs to the base path and returns the body',
        verb: 'post',
        responseData: { id: 'new', name: 'Ops' },
        invoke: () => apiClient.createAlertChannel({ name: 'Ops' }),
        expectedArgs: ['/alert-channels', { name: 'Ops' }],
      },
      {
        name: 'updateAlertChannel PUTs to the id path and returns the body',
        verb: 'put',
        responseData: { id: 'ac1', name: 'Renamed' },
        invoke: () => apiClient.updateAlertChannel('ac1', { name: 'Renamed' }),
        expectedArgs: ['/alert-channels/ac1', { name: 'Renamed' }],
      },
      {
        name: 'deleteAlertChannel DELETEs the id path',
        verb: 'delete',
        invoke: () => apiClient.deleteAlertChannel('ac1'),
        expectedArgs: ['/alert-channels/ac1'],
        checkResult: false,
      },
      {
        name: 'testAlertChannel POSTs to the /test sub-path and returns the result',
        verb: 'post',
        responseData: { success: true, message: 'Sent' },
        invoke: () => apiClient.testAlertChannel('ac1'),
        expectedArgs: ['/alert-channels/ac1/test'],
      },
    ]);
  });

  describe('status pages', () => {
    it.each([
      ['bare array', [{ id: 'sp1' }], [{ id: 'sp1' }]],
      ['.data fallback', { data: [{ id: 'sp2' }] }, [{ id: 'sp2' }]],
    ])('getStatusPages returns %s', async (_label, responseData, expected) => {
      mockClient({ get: vi.fn().mockResolvedValue({ data: responseData }) });
      expect(await apiClient.getStatusPages()).toEqual(expected);
    });

    runEndpointCases([
      {
        name: 'getStatusPage GETs the id path',
        verb: 'get',
        responseData: { id: 'sp1', name: 'Status' },
        invoke: () => apiClient.getStatusPage('sp1'),
        expectedArgs: ['/status-pages/sp1'],
      },
      {
        name: 'createStatusPage POSTs to the base path',
        verb: 'post',
        responseData: { id: 'new', name: 'Status' },
        invoke: () => apiClient.createStatusPage({ name: 'Status' }),
        expectedArgs: ['/status-pages', { name: 'Status' }],
      },
      {
        name: 'updateStatusPage PUTs to the id path',
        verb: 'put',
        responseData: { id: 'sp1', name: 'Renamed' },
        invoke: () => apiClient.updateStatusPage('sp1', { name: 'Renamed' }),
        expectedArgs: ['/status-pages/sp1', { name: 'Renamed' }],
      },
      {
        name: 'deleteStatusPage DELETEs the id path',
        verb: 'delete',
        invoke: () => apiClient.deleteStatusPage('sp1'),
        expectedArgs: ['/status-pages/sp1'],
        checkResult: false,
      },
      {
        name: 'addMonitorToStatusPage POSTs to the monitors sub-path',
        verb: 'post',
        responseData: { id: 'entry1', status_page_id: 'sp1', monitor_id: 'm1' },
        invoke: () =>
          apiClient.addMonitorToStatusPage('sp1', {
            monitor_type: 'url-monitor',
            monitor_id: 'm1',
            display_name: 'Homepage',
          }),
        expectedArgs: [
          '/status-pages/sp1/monitors',
          { monitor_type: 'url-monitor', monitor_id: 'm1', display_name: 'Homepage' },
        ],
      },
      {
        name: 'removeMonitorFromStatusPage DELETEs the entry path',
        verb: 'delete',
        invoke: () => apiClient.removeMonitorFromStatusPage('sp1', 'entry1'),
        expectedArgs: ['/status-pages/sp1/monitors/entry1'],
        checkResult: false,
      },
      {
        name: 'updateStatusPageMonitorOrder PATCHes display_order to the entry path',
        verb: 'patch',
        responseData: { id: 'entry1', status_page_id: 'sp1', monitor_id: 'm1' },
        invoke: () => apiClient.updateStatusPageMonitorOrder('sp1', 'entry1', 3),
        expectedArgs: ['/status-pages/sp1/monitors/entry1', { display_order: 3 }],
      },
    ]);
  });

  describe('incidents (single-resource + extras)', () => {
    runEndpointCases([
      {
        name: 'getIncident GETs the id path',
        verb: 'get',
        responseData: { id: 'i1', title: 'Outage' },
        invoke: () => apiClient.getIncident('i1'),
        expectedArgs: ['/incidents/i1'],
      },
      {
        name: 'createIncident POSTs to the base path',
        verb: 'post',
        responseData: { id: 'new', title: 'Outage' },
        invoke: () => apiClient.createIncident({ title: 'Outage' }),
        expectedArgs: ['/incidents', { title: 'Outage' }],
      },
      {
        name: 'updateIncident PUTs to the id path',
        verb: 'put',
        responseData: { id: 'i1', title: 'Resolved' },
        invoke: () => apiClient.updateIncident('i1', { title: 'Resolved' }),
        expectedArgs: ['/incidents/i1', { title: 'Resolved' }],
      },
      {
        name: 'deleteIncident DELETEs the id path',
        verb: 'delete',
        invoke: () => apiClient.deleteIncident('i1'),
        expectedArgs: ['/incidents/i1'],
        checkResult: false,
      },
      {
        name: 'addIncidentComment POSTs the message to the comments sub-path',
        verb: 'post',
        responseData: { id: 'ev1', message: 'Investigating' },
        invoke: () => apiClient.addIncidentComment('i1', 'Investigating'),
        expectedArgs: ['/incidents/i1/comments', { message: 'Investigating' }],
      },
      {
        name: 'assignIncident POSTs assigned_to to the assign sub-path',
        verb: 'post',
        responseData: { id: 'i1', assigned_to: 'u1' },
        invoke: () => apiClient.assignIncident('i1', 'u1'),
        expectedArgs: ['/incidents/i1/assign', { assigned_to: 'u1' }],
      },
      {
        name: 'assignIncident supports unassigning with null',
        verb: 'post',
        responseData: { id: 'i1', assigned_to: null },
        invoke: () => apiClient.assignIncident('i1', null),
        expectedArgs: ['/incidents/i1/assign', { assigned_to: null }],
        checkResult: false,
      },
    ]);
  });

  describe('API keys (extras)', () => {
    it.each([
      ['bare array', [{ id: 'k1' }], [{ id: 'k1' }]],
      ['{ apiKeys: [] }', { apiKeys: [{ id: 'k2' }] }, [{ id: 'k2' }]],
      ['apiKeys absent', {}, []],
    ])('getApiKeys handles %s', async (_label, responseData, expected) => {
      mockClient({ get: vi.fn().mockResolvedValue({ data: responseData }) });
      expect(await apiClient.getApiKeys()).toEqual(expected);
    });

    runEndpointCases([
      {
        name: 'deleteApiKey DELETEs the id path and returns the body',
        verb: 'delete',
        responseData: { message: 'Deleted', apiKey: { id: 'k1' } },
        invoke: () => apiClient.deleteApiKey('k1'),
        expectedArgs: ['/api-keys/k1'],
      },
      {
        name: 'toggleApiKey PATCHes the toggle sub-path and returns the body',
        verb: 'patch',
        responseData: { message: 'Toggled', apiKey: { id: 'k1', active: false } },
        invoke: () => apiClient.toggleApiKey('k1'),
        expectedArgs: ['/api-keys/k1/toggle'],
      },
    ]);
  });

  describe('teams', () => {
    it.each([
      ['bare array', [{ id: 't1' }], [{ id: 't1' }]],
      ['{ teams: [] }', { teams: [{ id: 't2' }] }, [{ id: 't2' }]],
      ['teams absent', {}, []],
    ])('getTeams handles %s', async (_label, responseData, expected) => {
      mockClient({ get: vi.fn().mockResolvedValue({ data: responseData }) });
      expect(await apiClient.getTeams()).toEqual(expected);
    });

    it.each([
      ['bare array', [{ id: 'u1' }], [{ id: 'u1' }], true],
      ['{ members: [] }', { members: [{ id: 'u2' }] }, [{ id: 'u2' }], false],
      ['members absent', {}, [], false],
    ])(
      'getTeamMembers handles %s',
      async (_label, responseData, expected, assertCallArgs: boolean) => {
        const get = vi.fn().mockResolvedValue({ data: responseData });
        mockClient({ get });
        expect(await apiClient.getTeamMembers('t1')).toEqual(expected);
        if (assertCallArgs) {
          expect(get).toHaveBeenCalledWith('/teams/t1/members');
        }
      }
    );

    runEndpointCases([
      {
        name: 'regenerateTeamInvite POSTs to the sub-path and returns the body',
        verb: 'post',
        responseData: { message: 'Regenerated', inviteCode: 'abc123' },
        invoke: () => apiClient.regenerateTeamInvite('t1'),
        expectedArgs: ['/teams/t1/regenerate-invite'],
      },
      {
        name: 'removeTeamMember DELETEs the member path and returns the body',
        verb: 'delete',
        responseData: { success: true },
        invoke: () => apiClient.removeTeamMember('t1', 'u1'),
        expectedArgs: ['/teams/t1/members/u1'],
      },
      {
        name: 'updateTeamMemberRole PUTs the role to the member path',
        verb: 'put',
        responseData: { success: true },
        invoke: () => apiClient.updateTeamMemberRole('t1', 'u1', 'admin'),
        expectedArgs: ['/teams/t1/members/u1', { role: 'admin' }],
      },
    ]);
  });

  describe('suite extras', () => {
    runEndpointCases([
      {
        name: 'toggleSuitePublic PATCHes is_public to the toggle-public sub-path',
        verb: 'patch',
        responseData: { is_public: true },
        invoke: () => apiClient.toggleSuitePublic('s1', true),
        expectedArgs: ['/playwright-autopilot/suites/s1/toggle-public', { is_public: true }],
      },
      {
        name: 'healSuite POSTs to the heal sub-path and returns the body',
        verb: 'post',
        responseData: { suite_id: 's1', heals: [{ testId: 't1', healId: 'h1' }] },
        invoke: () => apiClient.healSuite('s1'),
        expectedArgs: ['/playwright-autopilot/suites/s1/heal', {}],
      },
      {
        name: 'requestCliAuth POSTs to the auth request path',
        verb: 'post',
        responseData: { request_id: 'r1', auth_url: 'https://x/auth' },
        invoke: () => apiClient.requestCliAuth(),
        expectedArgs: ['/cli/auth/request'],
      },
      {
        name: 'checkCliAuthStatus GETs the check path with the request id',
        verb: 'get',
        responseData: { status: 'approved', api_key: 'k1' },
        invoke: () => apiClient.checkCliAuthStatus('r1'),
        expectedArgs: ['/cli/auth/check/r1'],
      },
    ]);
  });

  describe('suite CRUD', () => {
    runEndpointCases([
      {
        name: 'getSuite GETs the id path and returns the body',
        verb: 'get',
        responseData: { id: 's1', generated_tests: [] },
        invoke: () => apiClient.getSuite('s1'),
        expectedArgs: ['/playwright-autopilot/suites/s1'],
      },
      {
        name: 'generateSuite POSTs the payload to the base path and returns the body',
        verb: 'post',
        responseData: { id: 'new', generated_tests: [] },
        invoke: () =>
          apiClient.generateSuite({
            target_url: 'https://example.com',
            suite_name: 'Suite',
          }),
        expectedArgs: [
          '/playwright-autopilot/suites',
          { target_url: 'https://example.com', suite_name: 'Suite' },
        ],
      },
      {
        name: 'updateSuite PATCHes the id path and returns the body',
        verb: 'patch',
        responseData: { id: 's1', suite_name: 'Renamed' },
        invoke: () => apiClient.updateSuite('s1', { suite_name: 'Renamed' }),
        expectedArgs: ['/playwright-autopilot/suites/s1', { suite_name: 'Renamed' }],
      },
      {
        name: 'updateSuiteSchedule PATCHes the schedule sub-path and returns the body',
        verb: 'patch',
        responseData: { id: 's1', schedule_active: true },
        invoke: () => apiClient.updateSuiteSchedule('s1', { schedule_active: true }),
        expectedArgs: ['/playwright-autopilot/suites/s1/schedule', { schedule_active: true }],
      },
      {
        name: 'updateSuiteSecrets PATCHes the secrets sub-path',
        verb: 'patch',
        invoke: () => apiClient.updateSuiteSecrets('s1', { API_KEY: 'abc' }),
        expectedArgs: ['/playwright-autopilot/suites/s1/secrets', { secrets: { API_KEY: 'abc' } }],
        checkResult: false,
      },
      {
        name: 'getSuiteExecution GETs the execution path and returns the body',
        verb: 'get',
        responseData: { id: 'e1', status: 'COMPLETED' },
        invoke: () => apiClient.getSuiteExecution('s1', 'e1'),
        expectedArgs: ['/playwright-autopilot/suites/s1/executions/e1'],
      },
    ]);
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
    runEndpointCases([
      {
        name: 'generateSuiteCiWebhookToken POSTs and returns the token',
        verb: 'post',
        responseData: { token: 'tok-1' },
        invoke: () => apiClient.generateSuiteCiWebhookToken('s1'),
        expectedArgs: ['/playwright-autopilot/suites/s1/ci/generate-token'],
      },
      {
        name: 'deleteSuiteCiIntegration DELETEs the ci path',
        verb: 'delete',
        invoke: () => apiClient.deleteSuiteCiIntegration('s1'),
        expectedArgs: ['/playwright-autopilot/suites/s1/ci'],
        checkResult: false,
      },
      {
        name: 'getSuiteScripts GETs the scripts sub-path',
        verb: 'get',
        responseData: { suite_id: 's1', tests: [{ id: 't1', name: 'n', code: 'c' }] },
        invoke: () => apiClient.getSuiteScripts('s1'),
        expectedArgs: ['/playwright-autopilot/suites/s1/scripts'],
      },
      {
        name: 'updateTestScript PATCHes the code to the test script path',
        verb: 'patch',
        invoke: () => apiClient.updateTestScript('t1', 'console.log(1)'),
        expectedArgs: ['/playwright-autopilot/tests/t1/script', { code: 'console.log(1)' }],
        checkResult: false,
      },
      {
        name: 'generateTest POSTs the planned file and returns the new testId',
        verb: 'post',
        responseData: { testId: 't1' },
        invoke: () => apiClient.generateTest('s1', 'planned.spec.ts'),
        expectedArgs: [
          '/playwright-autopilot/suites/s1/generate-test',
          { planned_file: 'planned.spec.ts' },
        ],
      },
      {
        name: 'dismissPlannedFile POSTs the planned file and returns the dismissed list',
        verb: 'post',
        responseData: { dismissed_planned_files: ['planned.spec.ts'] },
        invoke: () => apiClient.dismissPlannedFile('s1', 'planned.spec.ts'),
        expectedArgs: [
          '/playwright-autopilot/suites/s1/planned-files/dismiss',
          { plannedFile: 'planned.spec.ts' },
        ],
      },
      {
        name: 'restorePlannedFile POSTs the planned file and returns the dismissed list',
        verb: 'post',
        responseData: { dismissed_planned_files: [] },
        invoke: () => apiClient.restorePlannedFile('s1', 'planned.spec.ts'),
        expectedArgs: [
          '/playwright-autopilot/suites/s1/planned-files/restore',
          { plannedFile: 'planned.spec.ts' },
        ],
      },
      {
        name: 'testHealHistory GETs the heal history path',
        verb: 'get',
        responseData: [{ id: 'heal-1' }],
        invoke: () => apiClient.testHealHistory('t1', 'h1'),
        expectedArgs: ['/playwright-autopilot/tests/t1/heals/h1/history'],
      },
      {
        name: 'deleteSuite DELETEs the suite path',
        verb: 'delete',
        invoke: () => apiClient.deleteSuite('s1'),
        expectedArgs: ['/playwright-autopilot/suites/s1'],
        checkResult: false,
      },
    ]);
  });

  describe('misc single-purpose endpoints', () => {
    runEndpointCases([
      {
        name: 'healthCheck GETs /health and returns the body',
        verb: 'get',
        responseData: { status: 'ok', timestamp: 't', environment: 'prod' },
        invoke: () => apiClient.healthCheck(),
        expectedArgs: ['/health'],
      },
      {
        name: 'getSchedule GETs the id path and unwraps {schedule}',
        verb: 'get',
        responseData: { schedule: { id: 'sch1' } },
        invoke: () => apiClient.getSchedule('sch1'),
        expectedArgs: ['/schedules/sch1'],
        expectedResult: { id: 'sch1' },
      },
      {
        name: 'deleteUrlMonitor DELETEs the id path',
        verb: 'delete',
        invoke: () => apiClient.deleteUrlMonitor('m1'),
        expectedArgs: ['/url-monitors/m1'],
        checkResult: false,
      },
      {
        name: 'runApiCheck POSTs to the execute sub-path and returns the body',
        verb: 'post',
        responseData: { executions: [], message: 'started' },
        invoke: () => apiClient.runApiCheck('c1'),
        expectedArgs: ['/api-checks/c1/execute'],
      },
      {
        name: 'runUrlMonitor POSTs to the execute sub-path and returns the body',
        verb: 'post',
        responseData: { executions: [], message: 'started' },
        invoke: () => apiClient.runUrlMonitor('m1'),
        expectedArgs: ['/url-monitors/m1/execute'],
      },
      {
        name: 'deleteHeartbeat DELETEs the id path',
        verb: 'delete',
        invoke: () => apiClient.deleteHeartbeat('h1'),
        expectedArgs: ['/heartbeats/h1'],
        checkResult: false,
      },
      {
        name: 'deleteApiCheck DELETEs the id path',
        verb: 'delete',
        invoke: () => apiClient.deleteApiCheck('c1'),
        expectedArgs: ['/api-checks/c1'],
        checkResult: false,
      },
      {
        name: 'toggleMuteApiCheck PATCHes the toggle-muted sub-path',
        verb: 'patch',
        responseData: { alert_on_failure: false, message: 'Muted' },
        invoke: () => apiClient.toggleMuteApiCheck('c1'),
        expectedArgs: ['/api-checks/c1/toggle-muted'],
      },
      {
        name: 'toggleMuteHeartbeat PATCHes the toggle-muted sub-path',
        verb: 'patch',
        responseData: { alert_on_failure: true, message: 'Unmuted' },
        invoke: () => apiClient.toggleMuteHeartbeat('h1'),
        expectedArgs: ['/heartbeats/h1/toggle-muted'],
      },
    ]);
  });
});
