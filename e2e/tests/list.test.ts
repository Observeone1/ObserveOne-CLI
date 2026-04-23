import { runCLI, assertSuccess } from '../lib/test-runner.js';

export async function testListCommand() {
  const result = await runCLI(['monitor', 'list']);
  assertSuccess(result, 'Monitor list should succeed');
}
