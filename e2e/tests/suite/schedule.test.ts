import { runCLI, assertFailure, assertStrictJSON } from '../../lib/test-runner.js';

export async function testSuiteScheduleMissingIdFails() {
  const result = await runCLI(['suite', 'schedule', 'nonexistent-suite-id-xyz', '--enable']);
  assertFailure(result, 'obs suite schedule with bad ID should fail');
}

export async function testSuiteScheduleNoFlagsFails() {
  const result = await runCLI(['suite', 'schedule', 'nonexistent-suite-id-xyz']);
  assertFailure(result, 'obs suite schedule with no flags should fail');
}

export async function testSuiteScheduleJsonEnvelope() {
  const result = await runCLI([
    'suite',
    'schedule',
    'nonexistent-suite-id-xyz',
    '--enable',
    '--json',
  ]);
  if (result.stdout.trim()) {
    assertStrictJSON(result.stdout, 'suite schedule --json must output valid JSON envelope');
    const parsed = JSON.parse(result.stdout.trim()) as { status?: string };
    if (parsed.status !== 'SUCCESS' && parsed.status !== 'ERROR') {
      throw new Error(`JSON envelope status must be SUCCESS or ERROR, got: ${parsed.status}`);
    }
  }
}
