import { runCLI, assertFailure, assertStrictJSON } from '../../lib/test-runner.js';

export async function testSuiteDeleteMissingIdFails() {
  const result = await runCLI(['suite', 'delete', 'nonexistent-suite-id-xyz']);
  assertFailure(result, 'obs suite delete with bad ID should fail');
}

export async function testSuiteDeleteJsonEnvelope() {
  const result = await runCLI(['suite', 'delete', 'nonexistent-suite-id-xyz', '--json']);
  if (result.stdout.trim()) {
    assertStrictJSON(result.stdout, 'suite delete --json must output valid JSON envelope');
    const parsed = JSON.parse(result.stdout.trim()) as { status?: string };
    if (parsed.status !== 'SUCCESS' && parsed.status !== 'ERROR') {
      throw new Error(`JSON envelope status must be SUCCESS or ERROR, got: ${parsed.status}`);
    }
  }
}
