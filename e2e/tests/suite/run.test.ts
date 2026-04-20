import { runCLI, assertFailure } from '../../lib/test-runner.js';

export async function testSuiteRunMissingIdFails() {
  const result = await runCLI(['suite', 'run', 'nonexistent-suite-id-xyz']);
  assertFailure(result, 'obs suite run with bad ID should fail');
}
