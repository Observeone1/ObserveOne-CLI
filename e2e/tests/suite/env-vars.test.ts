import { runCLI, assertSuccess, assertContains, assertJSON } from '../../lib/test-runner.js';

export async function testSuiteEnvVarsHelp() {
  const result = await runCLI(['suite', 'env-vars', '--help']);
  assertSuccess(result, 'obs suite env-vars --help should succeed');
  assertContains(result.stdout, 'id', 'Help should show id argument');
}

export async function testSuiteEnvVarsUnknownIdFails() {
  const result = await runCLI(['suite', 'env-vars', 'nonexistent-suite-id-xyz']);
  if (result.exitCode === 0) {
    throw new Error('obs suite env-vars with unknown ID should fail');
  }
}

/**
 * v1.36 parity regression: `env-vars` surfaces the variable/credential keys
 * configured for a suite (never the values). Read-only — no suite mutation.
 * Only runs when OBS_TEST_SUITE_ID points at a real suite.
 */
export async function testSuiteEnvVarsDiscovery() {
  const suiteId = process.env.OBS_TEST_SUITE_ID;
  if (!suiteId) return;

  const result = await runCLI(['suite', 'env-vars', suiteId, '--json']);
  assertSuccess(result, 'obs suite env-vars should succeed for a real suite');
  assertJSON(result.stdout, 'env-vars --json output should be JSON');
  const parsed = JSON.parse(result.stdout);
  const data = parsed.data ?? parsed;
  if (!Array.isArray(data.secret_keys)) {
    throw new Error('env-vars output should include a secret_keys array');
  }

  // Cross-check against the suite's own secret_keys field for consistency.
  const getResult = await runCLI(['suite', 'get', suiteId, '--json']);
  assertSuccess(getResult, 'obs suite get should succeed');
  const fetched = JSON.parse(getResult.stdout);
  const suite = fetched.suite ?? fetched.data?.suite;
  if (!suite) throw new Error('Could not read suite from get response');

  const expected = [...(suite.secret_keys ?? [])].sort();
  const actual = [...data.secret_keys].sort();
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    throw new Error(
      `env-vars secret_keys (${JSON.stringify(actual)}) should match suite.secret_keys ` +
        `(${JSON.stringify(expected)})`
    );
  }

  // Never returns values — only key names, and never the literal word "value".
  if (/"value"\s*:/.test(result.stdout)) {
    throw new Error('env-vars output must never include a "value" field');
  }
}
