import { runCLI, assertFailure } from '../../lib/test-runner.js';

export async function testSuiteGetMissingIdFails() {
  const result = await runCLI(['suite', 'get', 'nonexistent-suite-id-xyz']);
  assertFailure(result, 'obs suite get with bad ID should fail');
}
