import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from '../../services/api-client.service.js';
import { createMockConfigService, mockClientMethods } from './api-client-test-support.js';

vi.mock('axios', async () => {
  const { createAxiosMock } = await import('./api-client-test-support.js');
  return createAxiosMock();
});

// Covers the Playwright-autopilot suite methods (suite CRUD, schedule/secrets,
// executions, CI-integration token/teardown, scripts, planned-file generate/
// dismiss/restore, heal history) that the polling specs don't exercise.
const BASE = '/playwright-autopilot';

describe('ApiClient suite (playwright-autopilot) methods', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    apiClient = new ApiClient(createMockConfigService());
  });

  it('getSuite GETs the suite by id', async () => {
    const suite = { id: 's1', suite_name: 'Checkout' };
    const get = vi.fn().mockResolvedValue({ data: suite });
    mockClientMethods(apiClient, { get });

    const result = await apiClient.getSuite('s1');

    expect(get).toHaveBeenCalledWith(`${BASE}/suites/s1`);
    expect(result).toEqual(suite);
  });

  it('generateSuite POSTs the generation payload', async () => {
    const payload = { target_url: 'https://x', suite_name: 'X' };
    const suite = { id: 's2', ...payload };
    const post = vi.fn().mockResolvedValue({ data: suite });
    mockClientMethods(apiClient, { post });

    const result = await apiClient.generateSuite(payload);

    expect(post).toHaveBeenCalledWith(`${BASE}/suites`, payload);
    expect(result).toEqual(suite);
  });

  it('updateSuite PATCHes name/url changes', async () => {
    const payload = { suite_name: 'Renamed' };
    const patch = vi.fn().mockResolvedValue({ data: { id: 's1', ...payload } });
    mockClientMethods(apiClient, { patch });

    const result = await apiClient.updateSuite('s1', payload);

    expect(patch).toHaveBeenCalledWith(`${BASE}/suites/s1`, payload);
    expect(result).toEqual({ id: 's1', suite_name: 'Renamed' });
  });

  it('updateSuite PATCHes planner_instructions changes', async () => {
    const payload = { planner_instructions: 'Focus on the checkout flow' };
    const patch = vi.fn().mockResolvedValue({ data: { id: 's1', ...payload } });
    mockClientMethods(apiClient, { patch });

    const result = await apiClient.updateSuite('s1', payload);

    expect(patch).toHaveBeenCalledWith(`${BASE}/suites/s1`, payload);
    expect(result).toEqual({ id: 's1', planner_instructions: 'Focus on the checkout flow' });
  });

  it('updateSuitePlan PUTs plan_markdown to the plan sub-resource', async () => {
    const put = vi.fn().mockResolvedValue({ data: { id: 's1', plan_markdown: '# Edited' } });
    mockClientMethods(apiClient, { put });

    const result = await apiClient.updateSuitePlan('s1', '# Edited');

    expect(put).toHaveBeenCalledWith(`${BASE}/suites/s1/plan`, { plan_markdown: '# Edited' });
    expect(result).toEqual({ id: 's1', plan_markdown: '# Edited' });
  });

  it('getSuiteEnvVars GETs the env-vars sub-resource', async () => {
    const get = vi.fn().mockResolvedValue({ data: { secret_keys: ['API_TOKEN'] } });
    mockClientMethods(apiClient, { get });

    const result = await apiClient.getSuiteEnvVars('s1');

    expect(get).toHaveBeenCalledWith(`${BASE}/suites/s1/env-vars`);
    expect(result).toEqual({ secret_keys: ['API_TOKEN'] });
  });

  it('updateSuiteSchedule PATCHes the schedule sub-resource', async () => {
    const payload = { schedule_active: true, cron_expression: '0 * * * *' };
    const patch = vi.fn().mockResolvedValue({ data: { id: 's1' } });
    mockClientMethods(apiClient, { patch });

    const result = await apiClient.updateSuiteSchedule('s1', payload);

    expect(patch).toHaveBeenCalledWith(`${BASE}/suites/s1/schedule`, payload);
    expect(result).toEqual({ id: 's1' });
  });

  it('updateSuiteSecrets PATCHes secrets wrapped in a secrets key', async () => {
    const patch = vi.fn().mockResolvedValue({ data: {} });
    mockClientMethods(apiClient, { patch });

    await apiClient.updateSuiteSecrets('s1', { TOKEN: 'abc' });

    expect(patch).toHaveBeenCalledWith(`${BASE}/suites/s1/secrets`, {
      secrets: { TOKEN: 'abc' },
    });
  });

  it('getSuiteExecution GETs the nested execution', async () => {
    const execution = { id: 'x1', status: 'passed' };
    const get = vi.fn().mockResolvedValue({ data: execution });
    mockClientMethods(apiClient, { get });

    const result = await apiClient.getSuiteExecution('s1', 'x1');

    expect(get).toHaveBeenCalledWith(`${BASE}/suites/s1/executions/x1`);
    expect(result).toEqual(execution);
  });

  it('deleteSuite DELETEs the suite by id', async () => {
    const del = vi.fn().mockResolvedValue({ data: {} });
    mockClientMethods(apiClient, { delete: del });

    await apiClient.deleteSuite('s1');

    expect(del).toHaveBeenCalledWith(`${BASE}/suites/s1`);
  });

  it('generateSuiteCiWebhookToken POSTs and returns the token', async () => {
    const post = vi.fn().mockResolvedValue({ data: { token: 'tok_123' } });
    mockClientMethods(apiClient, { post });

    const result = await apiClient.generateSuiteCiWebhookToken('s1');

    expect(post).toHaveBeenCalledWith(`${BASE}/suites/s1/ci/generate-token`);
    expect(result).toEqual({ token: 'tok_123' });
  });

  it('deleteSuiteCiIntegration DELETEs the CI sub-resource', async () => {
    const del = vi.fn().mockResolvedValue({ data: {} });
    mockClientMethods(apiClient, { delete: del });

    await apiClient.deleteSuiteCiIntegration('s1');

    expect(del).toHaveBeenCalledWith(`${BASE}/suites/s1/ci`);
  });

  it('getSuiteScripts GETs the scripts bundle', async () => {
    const bundle = { suite_id: 's1', tests: [{ id: 't1', name: 'a', code: 'x' }] };
    const get = vi.fn().mockResolvedValue({ data: bundle });
    mockClientMethods(apiClient, { get });

    const result = await apiClient.getSuiteScripts('s1');

    expect(get).toHaveBeenCalledWith(`${BASE}/suites/s1/scripts`);
    expect(result).toEqual(bundle);
  });

  it('updateTestScript PATCHes the test code', async () => {
    const patch = vi.fn().mockResolvedValue({ data: {} });
    mockClientMethods(apiClient, { patch });

    await apiClient.updateTestScript('t1', 'await page.goto("/")');

    expect(patch).toHaveBeenCalledWith(`${BASE}/tests/t1/script`, {
      code: 'await page.goto("/")',
    });
  });

  it('generateTest POSTs the planned file and returns the test id', async () => {
    const post = vi.fn().mockResolvedValue({ data: { testId: 't9' } });
    mockClientMethods(apiClient, { post });

    const result = await apiClient.generateTest('s1', 'login.plan');

    expect(post).toHaveBeenCalledWith(`${BASE}/suites/s1/generate-test`, {
      planned_file: 'login.plan',
    });
    expect(result).toEqual({ testId: 't9' });
  });

  it('dismissPlannedFile POSTs to the dismiss endpoint', async () => {
    const post = vi.fn().mockResolvedValue({ data: { dismissed_planned_files: ['login.plan'] } });
    mockClientMethods(apiClient, { post });

    const result = await apiClient.dismissPlannedFile('s1', 'login.plan');

    expect(post).toHaveBeenCalledWith(`${BASE}/suites/s1/planned-files/dismiss`, {
      plannedFile: 'login.plan',
    });
    expect(result).toEqual({ dismissed_planned_files: ['login.plan'] });
  });

  it('restorePlannedFile POSTs to the restore endpoint', async () => {
    const post = vi.fn().mockResolvedValue({ data: { dismissed_planned_files: [] } });
    mockClientMethods(apiClient, { post });

    const result = await apiClient.restorePlannedFile('s1', 'login.plan');

    expect(post).toHaveBeenCalledWith(`${BASE}/suites/s1/planned-files/restore`, {
      plannedFile: 'login.plan',
    });
    expect(result).toEqual({ dismissed_planned_files: [] });
  });

  it('testHealHistory GETs the heal history for a test', async () => {
    const history = [{ id: 'h1', status: 'applied' }];
    const get = vi.fn().mockResolvedValue({ data: history });
    mockClientMethods(apiClient, { get });

    const result = await apiClient.testHealHistory('t1', 'heal1');

    expect(get).toHaveBeenCalledWith(`${BASE}/tests/t1/heals/heal1/history`);
    expect(result).toEqual(history);
  });
});
