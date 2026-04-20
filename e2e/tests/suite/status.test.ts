import { runCLI, assertStrictJSON } from '../../lib/test-runner.js';

export async function testSuiteStatusJsonEnvelope() {
  const result = await runCLI(['suite', 'status', 'nonexistent-suite-xyz', '--json']);
  if (result.stdout.trim()) {
    assertStrictJSON(result.stdout, 'suite status --json must output valid JSON');
    const parsed = JSON.parse(result.stdout.trim()) as { status?: string };
    if (parsed.status !== 'SUCCESS' && parsed.status !== 'ERROR') {
      throw new Error(`JSON envelope status must be SUCCESS or ERROR, got: ${parsed.status}`);
    }
  }
}
