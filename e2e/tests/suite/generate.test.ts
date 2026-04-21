import { runCLI } from '../../lib/test-runner.js';

export async function testSuiteGenerateInvalidUrl() {
  const result = await runCLI(['suite', 'generate', 'not-a-valid-url-%%%']);
  if (result.exitCode !== 0) {
    const output = result.stderr || result.stdout;
    if (!output) throw new Error('Should output an error message for invalid URL');
  }
}

export async function testSuiteGeneratePlanOnlyFlag() {
  // Should fail at auth, not at --plan-only flag parsing
  const result = await runCLI(['suite', 'generate', 'https://example.com', '--plan-only']);
  if (result.exitCode !== 0) {
    const output = result.stderr || result.stdout;
    if (output.includes('unknown option')) {
      throw new Error('--plan-only flag should be recognized by the CLI');
    }
  }
}

export async function testSuiteGenerateDeprecatedWaitFlag() {
  // --wait should be accepted (hidden, deprecated) without error
  const result = await runCLI(['suite', 'generate', 'https://example.com', '--wait']);
  if (result.exitCode !== 0) {
    const output = result.stderr || result.stdout;
    if (output.includes('unknown option')) {
      throw new Error('--wait flag should still be accepted (deprecated no-op)');
    }
  }
}

export async function testSuiteGenerateVarParsing() {
  // Should fail at auth, not at --var parsing
  const result = await runCLI([
    'suite',
    'generate',
    'https://example.com',
    '--var',
    'USERNAME=testuser',
    '--var',
    'password=secret123',
  ]);
  if (result.exitCode !== 0) {
    const output = result.stderr || result.stdout;
    if (output.includes('Invalid --var format')) {
      throw new Error('Valid KEY=VALUE flags should not fail var parsing');
    }
  }
}
