import { runCLI, assertSuccess, assertContains } from '../../lib/test-runner.js';

// These suite operations need deep, pre-existing autopilot state (planned files,
// heal ids) that e2e cannot provision deterministically. We assert the commands
// are wired and parse correctly — a registered command yields proper --help,
// not commander's "unknown command".

export async function testSuiteAdvancedCommandsRegistered() {
  const result = await runCLI(['suite', '--help']);
  assertSuccess(result, 'obs suite --help should succeed');
  for (const sub of ['generate-test', 'dismiss-planned', 'restore-planned', 'heal-history']) {
    assertContains(result.stdout, sub, `suite --help should list "${sub}"`);
  }
}

export async function testSuiteGenerateTestHelp() {
  const result = await runCLI(['suite', 'generate-test', '--help']);
  assertSuccess(result, 'suite generate-test --help should succeed');
  assertContains(result.stdout, '--planned-file', 'should show --planned-file option');
  assertContains(result.stdout, 'suite-id', 'should show suite-id argument');
}

export async function testSuiteDismissPlannedHelp() {
  const result = await runCLI(['suite', 'dismiss-planned', '--help']);
  assertSuccess(result, 'suite dismiss-planned --help should succeed');
  assertContains(result.stdout, '--planned-file', 'should show --planned-file option');
}

export async function testSuiteRestorePlannedHelp() {
  const result = await runCLI(['suite', 'restore-planned', '--help']);
  assertSuccess(result, 'suite restore-planned --help should succeed');
  assertContains(result.stdout, '--planned-file', 'should show --planned-file option');
}

export async function testSuiteHealHistoryHelp() {
  const result = await runCLI(['suite', 'heal-history', '--help']);
  assertSuccess(result, 'suite heal-history --help should succeed');
  assertContains(result.stdout, '--heal-id', 'should show --heal-id option');
  assertContains(result.stdout, 'test-id', 'should show test-id argument');
}
