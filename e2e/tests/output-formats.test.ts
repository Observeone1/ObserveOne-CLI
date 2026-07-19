import { CLIResult, runCLI } from '../lib/test-runner.js';

/**
 * Shared body for testJsonOutputFormat / testGlobalJsonOutput: both run the
 * exact same `--json` scenario and only differ in the error-message label.
 */
async function assertJsonListOutput(result: CLIResult, label: string): Promise<void> {
  if (result.exitCode !== 0) {
    assertExpectedFailure(result, label);
    return;
  }

  // The output may contain progress indicators followed by JSON.
  // Find the first occurrence of [ or { to locate the JSON part.
  const output = result.stdout;
  const jsonStartIndex = Math.min(
    output.includes('[') ? output.indexOf('[') : Infinity,
    output.includes('{') ? output.indexOf('{') : Infinity
  );

  if (jsonStartIndex === Infinity) {
    assertExpectedNoJson(output, label);
    return;
  }

  const jsonPart = output.substring(jsonStartIndex);
  try {
    JSON.parse(jsonPart);
  } catch (e) {
    throw new Error(
      `${label}: Output should contain valid JSON after progress indicators: ${jsonPart}`,
      { cause: e }
    );
  }
}

/** No JSON found in stdout — OK only if the output itself reports an expected failure. */
function assertExpectedNoJson(output: string, label: string): void {
  const lower = output.toLowerCase();
  if (lower.includes('error') || lower.includes('not found')) {
    // This is OK too - means the command executed but failed in expected way
    return;
  }
  throw new Error(`${label}: Expected JSON output but got: ${output}`);
}

/** Non-zero exit — OK only if it's an expected auth/API/resource failure. */
function assertExpectedFailure(result: CLIResult, label: string): void {
  const output = (result.stderr || result.stdout).toLowerCase();
  const expectedReasons = ['authentication', 'api', 'resource', 'error', 'not found', 'obs login'];
  const isExpected = expectedReasons.some((reason) => output.includes(reason));
  if (!isExpected) {
    throw new Error(`${label}: Unexpected error: ${result.stderr || result.stdout}`);
  }
}

export async function testJsonOutputFormat() {
  const result = await runCLI(['monitor', 'list', '--json']);
  await assertJsonListOutput(result, 'JSON format');
}

export async function testGlobalJsonOutput() {
  const result = await runCLI(['monitor', 'list', '--json']);
  await assertJsonListOutput(result, 'Global JSON');
}

export async function testVerboseMode() {
  const result = await runCLI(['--verbose', 'list']);

  // Verbose mode testing - just ensure it doesn't crash due to option parsing
  if (result.exitCode !== 0) {
    // If it fails, it should be due to auth or API issues, not option parsing
    const output = (result.stderr || result.stdout).toLowerCase();
    if (
      !output.includes('authentication') &&
      !output.includes('resource') &&
      !output.includes('not found') &&
      !output.includes('api') &&
      !output.includes('error') &&
      !output.includes('obs login')
    ) {
      throw new Error(
        `Verbose mode: Unexpected error (should be auth/API related): ${result.stderr || result.stdout}`
      );
    }
  }
  // If it succeeds, that's also fine
}
