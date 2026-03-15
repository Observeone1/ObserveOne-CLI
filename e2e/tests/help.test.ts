import { runCLI, assertSuccess, assertContains } from '../lib/test-runner.js';

export async function testHelpCommand() {
  const result = await runCLI(['--help']);
  assertSuccess(result, 'Help command should succeed');
  assertContains(result.stdout, 'obs', 'Should show program name');
  assertContains(result.stdout, 'login', 'Should list login command');
  assertContains(result.stdout, 'signup', 'Should list signup command');
  assertContains(result.stdout, 'ai-check', 'Should list ai-check command');
}

export async function testShortHelpCommand() {
  const result = await runCLI(['-h']);
  assertSuccess(result, 'Short help command should succeed');
  assertContains(result.stdout, 'obs', 'Should show program name');
  assertContains(result.stdout, 'Usage:', 'Should show usage info');
}

export async function testCommandHelp() {
  const result = await runCLI(['login', '--help']);
  assertSuccess(result, 'Command help should succeed');
  assertContains(result.stdout, 'login', 'Should show login command help');
  assertContains(result.stdout, 'Authenticate', 'Should show login description');
  assertContains(result.stdout, '--api-key', 'Should show api-key option');
}
