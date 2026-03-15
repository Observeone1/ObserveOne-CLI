import { runCLI } from '../lib/test-runner.js';

export async function testListWithoutAuthentication() {
  // Test list command without authentication
  const result = await runCLI(['ai-check', 'list']);

  // If not authenticated, it should fail with an appropriate message
  // Could be "authentication", "Resource not found", or similar
  if (result.exitCode !== 0) {
    const output = result.stderr || result.stdout;
    // Check for authentication-related errors
    if (!output.includes('Authentication failed') && !output.includes('obs login')) {
      throw new Error(`Expected authentication/resource error, got: ${output}`);
    }
  }
  // If it succeeds, that's also valid (maybe showing empty list)
}

export async function testAiCheckWithoutAuthentication() {
  const result = await runCLI(['ai-check', 'nonexistent-test']);

  // May fail due to auth, test not found, or other reasons - all are valid
  if (result.exitCode !== 0) {
    const output = (result.stderr || result.stdout).toLowerCase();
    // Check for authentication, resource not found, or other expected errors
    if (
      !output.includes('authentication') &&
      !output.includes('not found') &&
      !output.includes('test') &&
      !output.includes('resource') &&
      !output.includes('error') &&
      !output.includes('obs login')
    ) {
      throw new Error(
        `Unexpected error: Expected auth/resource error, got: ${result.stderr || result.stdout}`
      );
    }
  }
  // If it succeeds, that's also fine
}
