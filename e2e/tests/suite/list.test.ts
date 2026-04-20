import { runCLI, assertStrictJSON } from '../../lib/test-runner.js';

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
  if (result.stdout.trim()) {
    assertStrictJSON(result.stdout, 'suite list --json must output valid JSON envelope');
    const parsed = JSON.parse(result.stdout.trim()) as { status?: string };
    if (parsed.status !== 'SUCCESS' && parsed.status !== 'ERROR') {
      throw new Error(`JSON envelope status must be SUCCESS or ERROR, got: ${parsed.status}`);
    }
  }
}
