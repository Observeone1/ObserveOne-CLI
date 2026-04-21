import {
  runCLI,
  assertFailure,
  assertSuccess,
  assertContains,
  assertStrictJSON,
} from '../../lib/test-runner.js';

export async function testSuiteUpdateNoFlagsFails() {
  const result = await runCLI(['suite', 'update', 'nonexistent-suite-id-xyz']);
  assertFailure(result, 'obs suite update with no flags should fail');
  assertContains(result.stdout + result.stderr, 'required', 'Error should mention required flag');
}

export async function testSuiteUpdateBadIdFails() {
  const result = await runCLI([
    'suite',
    'update',
    'nonexistent-suite-id-xyz',
    '--name',
    'Test Suite',
  ]);
  assertFailure(result, 'obs suite update with unknown ID should fail');
}

export async function testSuiteUpdateJsonEnvelope() {
  const result = await runCLI([
    'suite',
    'update',
    'nonexistent-suite-id-xyz',
    '--name',
    'Test Suite',
    '--json',
  ]);
  assertStrictJSON(result.stdout, 'suite update --json must output valid JSON envelope');
  const parsed = JSON.parse(result.stdout.trim()) as { status?: string };
  if (parsed.status !== 'SUCCESS' && parsed.status !== 'ERROR') {
    throw new Error(`JSON envelope status must be SUCCESS or ERROR, got: ${parsed.status}`);
  }
}

export async function testSuiteUpdateHelp() {
  const result = await runCLI(['suite', 'update', '--help']);
  assertSuccess(result, 'obs suite update --help should succeed');
  assertContains(result.stdout, '--name', 'Help should show --name option');
  assertContains(result.stdout, '--url', 'Help should show --url option');
}
