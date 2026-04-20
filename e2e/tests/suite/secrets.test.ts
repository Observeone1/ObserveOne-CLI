import { runCLI, assertFailure, assertStrictJSON } from '../../lib/test-runner.js';

export async function testSuiteSecretsNoVarFails() {
  const result = await runCLI(['suite', 'secrets', 'nonexistent-suite-id-xyz']);
  assertFailure(result, 'obs suite secrets with no --var should fail');
}

export async function testSuiteSecretsMissingIdFails() {
  const result = await runCLI([
    'suite',
    'secrets',
    'nonexistent-suite-id-xyz',
    '--var',
    'KEY=VALUE',
  ]);
  assertFailure(result, 'obs suite secrets with bad ID should fail');
}

export async function testSuiteSecretsJsonEnvelope() {
  const result = await runCLI([
    'suite',
    'secrets',
    'nonexistent-suite-id-xyz',
    '--var',
    'KEY=VALUE',
    '--json',
  ]);
  if (result.stdout.trim()) {
    assertStrictJSON(result.stdout, 'suite secrets --json must output valid JSON envelope');
    const parsed = JSON.parse(result.stdout.trim()) as { status?: string };
    if (parsed.status !== 'SUCCESS' && parsed.status !== 'ERROR') {
      throw new Error(`JSON envelope status must be SUCCESS or ERROR, got: ${parsed.status}`);
    }
  }
}
