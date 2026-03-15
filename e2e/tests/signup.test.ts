import { runCLI, assertSuccess, assertContains } from '../lib/test-runner.js';

/**
 * Helper to generate random email for signup
 */
function generateTestEmail(): string {
  return `agent_e2e_${Date.now()}_${Math.floor(Math.random() * 1000)}@example.com`;
}

/**
 * Test signup command with explicit flags
 */
export async function testSignupWithFlags() {
  const email = generateTestEmail();
  const password = 'testPassword123!';

  const result = await runCLI(['signup', '--email', email, '--password', password]);

  assertSuccess(result, 'Signup with flags should succeed');
  assertContains(
    result.stdout,
    'Successfully created account and provisioned API key!',
    'Should show exact success message'
  );
}

/**
 * Test signup command with headless flag and environment variables
 */
export async function testSignupHeadless() {
  const email = generateTestEmail();
  const password = 'testPassword123!';

  // Set env vars for child process spawn to inherit via process.env
  process.env.OBS_EMAIL = email;
  process.env.OBS_PASSWORD = password;

  const result = await runCLI(['signup', '--headless']);

  assertSuccess(result, 'Signup with headless mode should succeed');
  assertContains(
    result.stdout,
    'Successfully created account and provisioned API key!',
    'Should show exact success message for headless mode'
  );

  // Clean up
  delete process.env.OBS_EMAIL;
  delete process.env.OBS_PASSWORD;
}
