import { runCLI, assertContains } from '../lib/test-runner.js';

export async function testAiCheckWithoutAuthentication() {
  const result = await runCLI(['ai-check', 'list']);

  const output = (result.stderr || result.stdout).toLowerCase();
  if (result.exitCode === 0) {
    // Listing without auth should not succeed; treat as failure
    throw new Error(`Expected authentication failure, got exit 0 with output: ${result.stdout}`);
  }

  assertContains(output, 'obs login', 'ai-check list without auth should prompt user to log in');
}
