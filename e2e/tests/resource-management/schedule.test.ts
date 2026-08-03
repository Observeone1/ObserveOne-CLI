import { runCLI, assertSuccess, assertFailure, assertStrictJSON } from '../../lib/test-runner.js';

const BOGUS_UUID_1 = '00000000-0000-0000-0000-000000000001';
const BOGUS_UUID_2 = '00000000-0000-0000-0000-000000000002';

export async function testScheduleListJson() {
  const result = await runCLI(['schedule', 'list', '--json']);
  assertSuccess(result, 'schedule list should succeed');
  assertStrictJSON(result.stdout, 'schedule list --json must output a valid JSON envelope');
}

export async function testScheduleCreateBadTestIdFails() {
  const result = await runCLI([
    'schedule',
    'create',
    '--test-id',
    BOGUS_UUID_1,
    '--interval',
    '*/5 * * * *',
  ]);
  assertFailure(result, 'schedule create with a non-existent test id should fail');
}

export async function testScheduleGetBadIdFails() {
  const result = await runCLI(['schedule', 'get', BOGUS_UUID_1]);
  assertFailure(result, 'schedule get with an unknown id should fail');
}

export async function testScheduleBulkRequiresIds() {
  const result = await runCLI(['schedule', 'bulk', 'stop', '--json']);
  assertFailure(result, 'schedule bulk with no ids should fail');
}

export async function testScheduleBulkRejectsBadAction() {
  const result = await runCLI(['schedule', 'bulk', 'frobnicate', '--id', BOGUS_UUID_1]);
  assertFailure(result, 'schedule bulk with an invalid action should fail');
}

export async function testScheduleBulkLoopsPerIdAndReportsFailures() {
  // Two bogus IDs — the bulk loop should attempt both, report both as failed,
  // and exit non-zero (partial/total failure is detectable in a pipeline).
  const result = await runCLI([
    'schedule',
    'bulk',
    'stop',
    '--id',
    BOGUS_UUID_1,
    '--id',
    BOGUS_UUID_2,
    '--json',
  ]);
  assertFailure(result, 'bulk stop over unknown ids should exit non-zero');
  assertStrictJSON(result.stdout, 'bulk --json must output a valid JSON envelope');
  const parsed = JSON.parse(result.stdout.trim()) as {
    data?: { action?: string; succeeded?: number; failed?: number; results?: { id: string }[] };
  };
  const data = parsed.data;
  if (data?.action !== 'stop') {
    throw new Error(`Expected action "stop", got: ${JSON.stringify(data)}`);
  }
  if (data.failed !== 2 || (data.results?.length ?? 0) !== 2) {
    throw new Error(`Expected 2 failed results, got: ${JSON.stringify(data)}`);
  }
}

export async function testScheduleStopAllResumeAll() {
  // Idempotent account-wide ops — succeed even with zero schedules.
  const stopAll = await runCLI(['schedule', 'stop-all', '--json']);
  assertSuccess(stopAll, 'schedule stop-all should succeed');
  const resumeAll = await runCLI(['schedule', 'resume-all', '--json']);
  assertSuccess(resumeAll, 'schedule resume-all should succeed');
}
