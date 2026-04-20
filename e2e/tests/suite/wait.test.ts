import { runCLI, assertFailure } from '../../lib/test-runner.js';

export async function testSuiteWaitRequiresBothArgs() {
  const result = await runCLI(['suite', 'wait', 'suite-id-xyz']);
  assertFailure(result, 'obs suite wait without executionId should fail');
}
