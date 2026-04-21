import { runCLI, assertSuccess, assertContains } from '../../lib/test-runner.js';

export async function testSuiteHelp() {
  const result = await runCLI(['suite', '--help']);
  assertSuccess(result, 'obs suite --help should succeed');
  assertContains(result.stdout, 'suite', 'Help should mention suite');
}

export async function testSuiteGenerateHelp() {
  const result = await runCLI(['suite', 'generate', '--help']);
  assertSuccess(result, 'obs suite generate --help should succeed');
  assertContains(result.stdout, 'url', 'Help should show url argument');
  assertContains(result.stdout, '--var', 'Help should show --var option');
  assertContains(result.stdout, '--plan-only', 'Help should show --plan-only option');
}
