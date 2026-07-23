import { describe, it, expect } from 'vitest';
import {
  planFileKey,
  parsePlanScenarios,
  findGeneratedTest,
  classifyPlannedFiles,
  computeRegenerateTargets,
} from '../../utils/plan-scenarios.js';
import { Suite } from '../../types/index.js';

const SAMPLE_PLAN = `# Test Plan

## Login flow
**File:** \`tests/login.spec.ts\`
Verify a user can sign in with valid credentials.

## Checkout flow
**File:** \`tests/checkout.spec.ts\`
Verify the cart totals update correctly.

## Old scenario
**File:** \`tests/old-scenario.spec.ts\` _(dismissed)_
No longer relevant.
`;

function makeSuite(overrides: Partial<Suite> = {}): Suite {
  return {
    id: 's1',
    user_id: 'u1',
    team_id: null,
    target_url: 'https://example.com',
    suite_name: 'Example',
    status: 'scheduled',
    error_message: null,
    plan_markdown: SAMPLE_PLAN,
    planner_instructions: null,
    stale_planned_files: [],
    dismissed_planned_files: [],
    test_count: 0,
    max_tests: 10,
    public_slug: null,
    is_public: false,
    cron_expression: '',
    schedule_active: false,
    secret_keys: [],
    allow_form_submit: false,
    generated_tests: [],
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

describe('planFileKey', () => {
  it('strips a tests/ prefix, the .spec.ts suffix, and lowercases', () => {
    expect(planFileKey('tests/Login.spec.ts')).toBe('login');
  });

  it('strips .test.ts suffix', () => {
    expect(planFileKey('checkout.test.ts')).toBe('checkout');
  });

  it('has no effect on an already-normalized basename', () => {
    expect(planFileKey('login')).toBe('login');
  });
});

describe('parsePlanScenarios', () => {
  it('extracts every File-marked heading at the deepest heading level that carries one', () => {
    const scenarios = parsePlanScenarios(SAMPLE_PLAN);
    expect(scenarios.map((s) => s.file)).toEqual([
      'login.spec.ts',
      'checkout.spec.ts',
      'old-scenario.spec.ts',
    ]);
    expect(scenarios[0]!.title).toBe('Login flow');
    expect(scenarios[0]!.headingLevel).toBe(2);
  });

  it('ignores headings with no File marker', () => {
    const md = '# Title\n\n## No file here\nJust prose.\n';
    expect(parsePlanScenarios(md)).toEqual([]);
  });

  it('returns an empty list for an empty plan', () => {
    expect(parsePlanScenarios('')).toEqual([]);
  });

  it('tolerates the _(dismissed)_ suffix on the File marker line', () => {
    const scenarios = parsePlanScenarios(SAMPLE_PLAN);
    const dismissed = scenarios.find((s) => s.file === 'old-scenario.spec.ts');
    expect(dismissed).toBeDefined();
  });
});

describe('findGeneratedTest', () => {
  const tests = [
    { id: 't1', name: 'login', script_path: 'x' },
    { id: 't2', name: 'checkout flow', script_path: 'y' },
  ];

  it('matches a dashed generated-test name against the planned file basename', () => {
    expect(findGeneratedTest('login.spec.ts', tests)?.id).toBe('t1');
  });

  it('matches a spaced generated-test name against a dashed planned-file key', () => {
    expect(findGeneratedTest('checkout-flow.spec.ts', tests)?.id).toBe('t2');
  });

  it('returns undefined when nothing matches', () => {
    expect(findGeneratedTest('missing.spec.ts', tests)).toBeUndefined();
  });
});

describe('classifyPlannedFiles', () => {
  it('marks a file with no generated test as missing', () => {
    const statuses = classifyPlannedFiles(makeSuite());
    const login = statuses.find((s) => s.file === 'login.spec.ts');
    expect(login?.state).toBe('missing');
  });

  it('marks a file with a matching generated test as generated', () => {
    const suite = makeSuite({
      generated_tests: [{ id: 't1', name: 'login', script_path: 'p' }],
    });
    const statuses = classifyPlannedFiles(suite);
    expect(statuses.find((s) => s.file === 'login.spec.ts')?.state).toBe('generated');
  });

  it('marks a generated file whose key is in stale_planned_files as stale', () => {
    const suite = makeSuite({
      generated_tests: [{ id: 't1', name: 'login', script_path: 'p' }],
      stale_planned_files: ['login'],
    });
    const statuses = classifyPlannedFiles(suite);
    expect(statuses.find((s) => s.file === 'login.spec.ts')?.state).toBe('stale');
  });

  it('marks a dismissed key as dismissed even if it has a generated test', () => {
    const suite = makeSuite({
      generated_tests: [{ id: 't3', name: 'old-scenario', script_path: 'p' }],
      dismissed_planned_files: ['old-scenario'],
    });
    const statuses = classifyPlannedFiles(suite);
    expect(statuses.find((s) => s.file === 'old-scenario.spec.ts')?.state).toBe('dismissed');
  });

  it('returns no statuses when the plan is empty', () => {
    expect(classifyPlannedFiles(makeSuite({ plan_markdown: null }))).toEqual([]);
  });
});

describe('computeRegenerateTargets', () => {
  it('targets stale and missing files, excluding dismissed and generated ones', () => {
    const suite = makeSuite({
      generated_tests: [
        { id: 't1', name: 'login', script_path: 'p' },
        { id: 't2', name: 'checkout', script_path: 'p' },
      ],
      stale_planned_files: ['login'],
      dismissed_planned_files: ['old-scenario'],
    });
    const { targets, usedAllFallback } = computeRegenerateTargets(suite, false);
    expect(targets.map((t) => t.file).sort((a, b) => a.localeCompare(b))).toEqual([
      'login.spec.ts',
    ]);
    expect(usedAllFallback).toBe(false);
  });

  it('returns no targets when nothing is stale/missing and --all is not passed', () => {
    const suite = makeSuite({
      generated_tests: [
        { id: 't1', name: 'login', script_path: 'p' },
        { id: 't2', name: 'checkout', script_path: 'p' },
        { id: 't3', name: 'old-scenario', script_path: 'p' },
      ],
    });
    const { targets, usedAllFallback } = computeRegenerateTargets(suite, false);
    expect(targets).toEqual([]);
    expect(usedAllFallback).toBe(false);
  });

  it('falls back to every non-dismissed file when --all is passed and nothing is stale/missing', () => {
    const suite = makeSuite({
      generated_tests: [
        { id: 't1', name: 'login', script_path: 'p' },
        { id: 't2', name: 'checkout', script_path: 'p' },
      ],
      dismissed_planned_files: ['old-scenario'],
    });
    const { targets, usedAllFallback } = computeRegenerateTargets(suite, true);
    expect(targets.map((t) => t.file).sort((a, b) => a.localeCompare(b))).toEqual([
      'checkout.spec.ts',
      'login.spec.ts',
    ]);
    expect(usedAllFallback).toBe(true);
  });

  it('never includes a dismissed file even with --all', () => {
    const suite = makeSuite({
      dismissed_planned_files: ['old-scenario'],
    });
    const { targets } = computeRegenerateTargets(suite, true);
    expect(targets.some((t) => t.file === 'old-scenario.spec.ts')).toBe(false);
  });

  it('classifies a suite that carries none of the optional planning arrays', () => {
    // generated_tests / dismissed_planned_files / stale_planned_files are all
    // absent here, so every scenario must fall through to the planned state.
    const bare = {
      plan_markdown: SAMPLE_PLAN,
    } as unknown as Parameters<typeof classifyPlannedFiles>[0];

    const statuses = classifyPlannedFiles(bare);

    expect(statuses.length).toBeGreaterThan(0);
    expect(statuses.some((s) => s.status === 'generated')).toBe(false);
    expect(statuses.some((s) => s.status === 'stale')).toBe(false);
  });
});
