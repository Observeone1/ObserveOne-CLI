import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import {
  suiteStatusColor,
  formatCron,
  printSuiteList,
  printSuiteDetail,
  printExecutionResults,
} from '../../../commands/suite/formatters.js';
import { Suite, SuiteExecution } from '../../../types/index.js';

const baseSuite: Suite = {
  id: 'suite-1',
  user_id: 'user-1',
  team_id: null,
  target_url: 'https://example.com',
  suite_name: 'Checkout flow',
  status: 'scheduled',
  error_message: null,
  plan_markdown: null,
  test_count: 3,
  max_tests: 10,
  public_slug: null,
  is_public: false,
  cron_expression: '0 */6 * * *',
  schedule_active: true,
  secret_keys: [],
  allow_form_submit: false,
  generated_tests: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const baseExecution: SuiteExecution = {
  id: 'exec-1',
  suite_id: 'suite-1',
  user_id: 'user-1',
  status: 'COMPLETED',
  test_results: [],
  total: 0,
  passed: 0,
  failed: 0,
  duration_ms: 4200,
  error_message: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function loggedLines(): string {
  return (console.log as Mock).mock.calls.map((call) => String(call[0])).join('\n');
}

describe('suiteStatusColor', () => {
  it.each([
    ['scheduled'],
    ['failed'],
    ['pending'],
    ['generating'],
    ['crawling'],
    ['planning'],
    ['healing'],
    ['unknown-status'],
  ])('renders a colored label for status %s', (status) => {
    expect(suiteStatusColor(status)).toContain(status);
  });
});

describe('formatCron', () => {
  it('shows "manual" when the schedule is inactive', () => {
    expect(formatCron('0 */6 * * *', false)).toContain('manual');
  });

  it('shows "manual" when the expression is empty', () => {
    expect(formatCron('', true)).toContain('manual');
  });

  it.each([
    ['0 */6 * * *', 'every 6h'],
    ['0 */12 * * *', 'every 12h'],
    ['0 0 * * *', 'daily'],
    ['0 0 * * 0', 'weekly'],
  ])('maps known cron expression %s to %s', (expr, label) => {
    expect(formatCron(expr, true)).toContain(label);
  });

  it('falls back to the raw expression for unknown crons', () => {
    expect(formatCron('*/15 * * * *', true)).toContain('*/15 * * * *');
  });
});

describe('printSuiteList / printSuiteDetail / printExecutionResults', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints an empty-state message when there are no suites', () => {
    printSuiteList([]);
    expect(loggedLines()).toContain('No suites yet');
  });

  it('lists each suite with its name, status, test count, and URL', () => {
    printSuiteList([baseSuite, { ...baseSuite, id: 'suite-2', suite_name: 'Second suite' }]);
    const out = loggedLines();
    expect(out).toContain('Checkout flow');
    expect(out).toContain('Second suite');
    expect(out).toContain('3 tests');
    expect(out).toContain('https://example.com');
  });

  it('prints suite detail including variables, error, and generated tests', () => {
    printSuiteDetail({
      ...baseSuite,
      secret_keys: ['API_KEY'],
      error_message: 'crawl timed out',
      generated_tests: [{ id: 'test-1', name: 'Login test', script_path: 'login.spec.ts' }],
    });
    const out = loggedLines();
    expect(out).toContain('Checkout flow');
    expect(out).toContain('API_KEY');
    expect(out).toContain('crawl timed out');
    expect(out).toContain('Login test');
  });

  it('omits optional detail sections when absent', () => {
    printSuiteDetail(baseSuite);
    const out = loggedLines();
    expect(out).not.toContain('Variables:');
    expect(out).not.toContain('Error:');
    expect(out).not.toContain('Generated tests');
  });

  it('reports a passing run with per-test rows and a duration', () => {
    printExecutionResults({
      ...baseExecution,
      test_results: [
        { test_id: 't1', name: 'loads homepage', status: 'PASSED', duration_ms: 1200, error: null },
      ],
      total: 1,
      passed: 1,
      failed: 0,
    });
    const out = loggedLines();
    expect(out).toContain('completed');
    expect(out).toContain('loads homepage');
    expect(out).toContain('1/1 passed');
    expect(out).toContain('all passed');
    expect(out).toContain('exec-1');
  });

  it('reports a failing run and includes the failure error text', () => {
    printExecutionResults({
      ...baseExecution,
      status: 'FAILED',
      test_results: [
        {
          test_id: 't1',
          name: 'checks pricing',
          status: 'FAILED',
          duration_ms: null,
          error: 'selector not found',
        },
        { test_id: 't2', name: 'skipped test', status: 'SKIPPED', duration_ms: null, error: null },
        { test_id: 't3', name: 'pending test', status: 'PENDING', duration_ms: null, error: null },
      ],
      total: 3,
      passed: 0,
      failed: 1,
    });
    const out = loggedLines();
    expect(out).toContain('failed');
    expect(out).toContain('checks pricing');
    expect(out).toContain('selector not found');
    expect(out).toContain('0/3 passed');
  });

  it('derives totals from test_results when total/passed/failed are not provided', () => {
    printExecutionResults({
      ...baseExecution,
      total: undefined,
      passed: undefined,
      failed: undefined,
      duration_ms: null,
      test_results: [
        { test_id: 't1', name: 'a', status: 'PASSED', duration_ms: null, error: null },
        { test_id: 't2', name: 'b', status: 'FAILED', duration_ms: null, error: null },
      ],
    } as unknown as SuiteExecution);
    const out = loggedLines();
    expect(out).toContain('1/2 passed');
    expect(out).toContain('1 failed');
  });
});
