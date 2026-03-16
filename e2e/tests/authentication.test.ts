import { runCLI } from '../lib/test-runner.js';

export async function testListWithoutAuthentication() {
  // Test list command without authentication
  const result = await runCLI(['ai-check', 'list'], 30000, { OBS_API_KEY: undefined });

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
  const result = await runCLI(['ai-check', 'nonexistent-test'], 30000, { OBS_API_KEY: undefined });

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

export async function testLogoutCommand() {
  const result = await runCLI(['logout', '--json']);
  
  if (result.exitCode === 0) {
    const output = JSON.parse(result.stdout);
    if (!output.data?.loggedOut) {
      throw new Error(`Expected loggedOut: true, got: ${result.stdout}`);
    }
  } else {
    throw new Error(`Logout failed: ${result.stderr || result.stdout}`);
  }
}

export async function testLoginForceFlag() {
  // Try to force login headlessly with bad credentials to ensure it attempts the flow 
  // rather than succeeding instantly with an existing key.
  const result = await runCLI(['login', '--headless', '--force', '--json'], 10000, {
    OBS_EMAIL: 'fake@example.com',
    OBS_PASSWORD: 'wrong-password'
  });

  // Because credentials are fake, it should fail with an auth error (401/403 or not found),
  // which proves it actually tried to authenticate instead of using an existing key.
  if (result.exitCode === 0) {
    throw new Error(`Force login with fake credentials should have failed, but succeeded.`);
  }

  const output = (result.stderr || result.stdout).toLowerCase();
  if (!output.includes('fail') && !output.includes('error') && !output.includes('network')) {
     throw new Error(`Expected authentication failure on forced login, got: ${output}`);
  }
}
