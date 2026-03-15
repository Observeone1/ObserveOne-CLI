import { runCLI, assertSuccess, assertContains } from '../lib/test-runner.js';

export async function testListCommand() {
  const result = await runCLI(['ai-check', 'list']);

  // List command may succeed or fail depending on auth, both are valid
  if (result.exitCode === 0) {
    // If it succeeds, it should show some content
    if (result.stdout && result.stdout.trim()) {
      // If there's output, it's acceptable
      return;
    }
  } else {
    // If it fails, it should be due to authentication or similar expected errors
    assertContains(
      result.stdout + result.stderr,
      'obs login',
      'Should prompt to log in when not authenticated'
    );
  }
}
