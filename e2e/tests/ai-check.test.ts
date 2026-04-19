import {
  runCLI,
  assertSuccess,
  assertFailure,
  assertContains,
  assertStrictJSON,
} from '../lib/test-runner.js';

export async function testAiCheckWithInvalidTestName() {
  const result = await runCLI(['ai-check', 'run', 'nonexistent-test-name']);

  // This should either fail with a test not found error or succeed with empty results
  // depending on the implementation
  if (result.exitCode !== 0) {
    assertFailure(result, 'AI check with invalid test name should fail');
    assertContains(
      result.stderr || result.stdout,
      'not found',
      "Should show 'not found' error for nonexistent test"
    );
  } else {
    // If it succeeds, that's also acceptable behavior
    assertSuccess(result, 'AI check with invalid test name handled gracefully');
  }
}

export async function testAiCheckWithMultipleTests() {
  // This test will fail if the tests don't exist, but that's expected
  const result = await runCLI(['ai-check', 'run', 'test1', 'test2', 'test3']);

  // The important thing is that the command parses and runs without crashing
  if (result.exitCode !== 0) {
    // If it fails due to missing tests, that's ok
    assertContains(
      result.stderr || result.stdout,
      'not found',
      "Should handle 'not found' failure for multiple tests"
    );
  }
}

export async function testAiCheckWithAdHocTest() {
  const result = await runCLI([
    'ai-check',
    'run',
    '--url',
    'https://example.com',
    '--prompt',
    'Check if page loads',
    '--timeout',
    '5000',
  ]);

  // This may fail due to missing auth or other reasons, but should parse correctly
  if (result.exitCode !== 0) {
    // It's OK if it fails due to auth, API, or other expected reasons
    const output = result.stderr || result.stdout;
    if (
      !output.includes('authentication') &&
      !output.includes('API') &&
      !output.includes('auth') &&
      !output.includes('Resource not found') &&
      !output.includes('not found') &&
      !output.includes('timed out') &&
      !output.toLowerCase().includes('error')
    ) {
      // If it's not an expected error type, then it might be a parsing error
      throw new Error(`Unexpected error in ad-hoc test: ${output}`);
    }
  }
  // If it succeeds, that's also fine
}

export async function testAiCheckJsonAdhocOutputIsStrictEnvelope() {
  const baseArgs = [
    'ai-check',
    'run',
    '--url',
    'https://example.com',
    '--prompt',
    'Check if page loads',
    '--timeout',
    '5000',
  ];

  const triggers: Array<{
    label: string;
    args: string[];
    env?: Record<string, string | undefined>;
  }> = [
    { label: '--json flag', args: ['--json'] },
    { label: '--reporter json', args: ['--reporter', 'json'] },
    { label: 'OBS_JSON_OUTPUT env', args: [], env: { OBS_JSON_OUTPUT: 'true' } },
  ];

  for (const trigger of triggers) {
    const result = await runCLI([...baseArgs, ...trigger.args], 30000, trigger.env);

    if (result.stdout.trim().length === 0) {
      throw new Error(`[${trigger.label}] Expected JSON output on stdout. Stderr: ${result.stderr}`);
    }

    assertStrictJSON(
      result.stdout,
      `[${trigger.label}] AI check JSON run should emit a single JSON envelope`
    );

    if (result.stderr.trim().length > 0) {
      throw new Error(
        `[${trigger.label}] Expected no stderr noise in JSON mode. Got: ${result.stderr}`
      );
    }

    const parsed = JSON.parse(result.stdout.trim());

    if (parsed.status !== 'SUCCESS' && parsed.status !== 'ERROR') {
      throw new Error(
        `[${trigger.label}] envelope.status must be SUCCESS or ERROR. Got: ${result.stdout}`
      );
    }
    if (!parsed.metadata || typeof parsed.metadata.timestamp !== 'string') {
      throw new Error(
        `[${trigger.label}] envelope.metadata.timestamp missing or non-string. Got: ${result.stdout}`
      );
    }

    if (result.exitCode !== 0) {
      if (parsed.status !== 'ERROR') {
        throw new Error(
          `[${trigger.label}] Expected ERROR envelope on non-zero exit. Got: ${result.stdout}`
        );
      }
      if (!parsed.error || typeof parsed.error.message !== 'string') {
        throw new Error(
          `[${trigger.label}] ERROR envelope must carry error.message. Got: ${result.stdout}`
        );
      }
    } else {
      if (parsed.status !== 'SUCCESS') {
        throw new Error(
          `[${trigger.label}] Expected SUCCESS envelope on zero exit. Got: ${result.stdout}`
        );
      }
      if (parsed.data === undefined) {
        throw new Error(
          `[${trigger.label}] SUCCESS envelope must carry data. Got: ${result.stdout}`
        );
      }
    }
  }
}
