/**
 * E2E tests for `obs suite ci` subcommands (v1.19.0).
 *
 * The status / token-rotation / disconnect commands wrap existing backend
 * routes that the web UI uses for CI integration. Install + repo selection
 * still requires the GitHub App OAuth flow (browser only), so these tests
 * cover the surface a headless CI agent would exercise: help output, TTY
 * guards on destructive operations, and clean error envelopes when called
 * against a non-existent suite.
 */
import { runCLI, assertSuccess, assertContains, assertFailure } from '../../lib/test-runner.js';

export async function testSuiteCiHelp() {
  const result = await runCLI(['suite', 'ci', '--help']);
  assertSuccess(result, 'obs suite ci --help should succeed');
  assertContains(result.stdout, 'status', 'Help should list status subcommand');
  assertContains(result.stdout, 'webhook-token', 'Help should list webhook-token subcommand');
  assertContains(result.stdout, 'disconnect', 'Help should list disconnect subcommand');
  assertContains(result.stdout, 'Examples:', 'Help should include examples');
}

export async function testSuiteCiStatusInvalidSuite() {
  // Using an obviously fake suite ID — backend should return 4xx, CLI should
  // surface a clean ERROR envelope rather than crashing.
  const result = await runCLI(['suite', 'ci', 'status', 'fake-suite-id-99999', '--json']);
  // exit code may be 0 (returns null for unbound) or 1 (error from backend);
  // either is acceptable, what matters is the output is a parseable envelope
  const combined = result.stdout + result.stderr;
  if (
    !combined.includes('"ci_integration"') &&
    !combined.includes('"status"') &&
    !combined.toLowerCase().includes('error')
  ) {
    throw new Error(`Expected JSON envelope or error message, got: ${combined}`);
  }
}

export async function testSuiteCiWebhookTokenRequiresYesInNonTTY() {
  const result = await runCLI(['suite', 'ci', 'webhook-token', '42']);
  assertFailure(result, 'webhook-token without -y in non-TTY should fail');
  const combined = result.stdout + result.stderr;
  if (
    !combined.toLowerCase().includes('confirmation required') &&
    !combined.toLowerCase().includes('error')
  ) {
    throw new Error(`Expected TTY guard error, got: ${combined}`);
  }
}

export async function testSuiteCiDisconnectRequiresYesInNonTTY() {
  const result = await runCLI(['suite', 'ci', 'disconnect', '42']);
  assertFailure(result, 'disconnect without -y in non-TTY should fail');
  const combined = result.stdout + result.stderr;
  if (
    !combined.toLowerCase().includes('confirmation required') &&
    !combined.toLowerCase().includes('error')
  ) {
    throw new Error(`Expected TTY guard error, got: ${combined}`);
  }
}

export async function testSuiteCiStatusHelp() {
  const result = await runCLI(['suite', 'ci', 'status', '--help']);
  assertSuccess(result, 'obs suite ci status --help should succeed');
  assertContains(result.stdout, 'CI integration', 'Help should describe what status shows');
}
