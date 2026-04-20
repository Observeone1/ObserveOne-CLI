import {
  runCLI,
  assertSuccess,
  assertFailure,
  assertContains,
  assertStrictJSON,
} from '../lib/test-runner.js';

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
  assertContains(result.stdout, '--wait', 'Help should show --wait option');
}

export async function testSuiteListRequiresAuth() {
  const result = await runCLI(['suite', 'list']);
  if (result.exitCode !== 0) {
    const output = result.stderr || result.stdout;
    const isExpected =
      output.includes('auth') ||
      output.includes('login') ||
      output.includes('401') ||
      output.includes('Authentication');
    if (!isExpected) {
      throw new Error(`Unexpected error listing suites: ${output}`);
    }
  }
}

export async function testSuiteListJsonEnvelope() {
  const result = await runCLI(['suite', 'list', '--json']);
  // May fail with auth error in CI, but output must always be valid JSON
  if (result.stdout.trim()) {
    const parsed = assertStrictJSON(result, 'suite list --json must output valid JSON envelope');
    if (parsed && typeof parsed === 'object' && 'status' in parsed) {
      const status = (parsed as { status: string }).status;
      if (status !== 'SUCCESS' && status !== 'ERROR') {
        throw new Error(`JSON envelope status must be SUCCESS or ERROR, got: ${status}`);
      }
    }
  }
}

export async function testSuiteGetMissingIdFails() {
  const result = await runCLI(['suite', 'get', 'nonexistent-suite-id-xyz']);
  assertFailure(result, 'obs suite get with bad ID should fail');
}

export async function testSuiteRunMissingIdFails() {
  const result = await runCLI(['suite', 'run', 'nonexistent-suite-id-xyz']);
  assertFailure(result, 'obs suite run with bad ID should fail');
}

export async function testSuiteGenerateInvalidUrl() {
  const result = await runCLI(['suite', 'generate', 'not-a-valid-url-%%%']);
  // Should fail gracefully, not crash
  if (result.exitCode !== 0) {
    const output = result.stderr || result.stdout;
    if (!output) throw new Error('Should output an error message for invalid URL');
  }
}

export async function testSuiteGenerateVarParsing() {
  // Should fail at auth, not at var parsing -- confirms --var is parsed correctly
  const result = await runCLI([
    'suite', 'generate', 'https://example.com',
    '--var', 'USERNAME=testuser',
    '--var', 'password=secret123',
  ]);
  if (result.exitCode !== 0) {
    const output = result.stderr || result.stdout;
    // Var parsing error would say "Invalid --var format"
    if (output.includes('Invalid --var format')) {
      throw new Error('Valid KEY=VALUE flags should not fail var parsing');
    }
  }
}

export async function testSuiteWaitRequiresBothArgs() {
  const result = await runCLI(['suite', 'wait', 'suite-id-xyz']);
  // Missing executionId arg -- Commander should show error
  assertFailure(result, 'obs suite wait without executionId should fail');
}

export async function testSuiteStatusJsonEnvelope() {
  const result = await runCLI(['suite', 'status', 'nonexistent-suite-xyz', '--json']);
  if (result.stdout.trim()) {
    const parsed = assertStrictJSON(result, 'suite status --json must output valid JSON');
    if (parsed && typeof parsed === 'object' && 'status' in parsed) {
      const status = (parsed as { status: string }).status;
      if (status !== 'SUCCESS' && status !== 'ERROR') {
        throw new Error(`JSON envelope status must be SUCCESS or ERROR, got: ${status}`);
      }
    }
  }
}
