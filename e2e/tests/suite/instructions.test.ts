import { runCLI, assertSuccess, assertContains } from '../../lib/test-runner.js';

export async function testSuiteUpdateInstructionsHelpMentionsFlag() {
  const result = await runCLI(['suite', 'update', '--help']);
  assertSuccess(result, 'obs suite update --help should succeed');
  assertContains(result.stdout, '--instructions', 'Help should show --instructions option');
}

/**
 * v1.36 parity regression: `--instructions` persists planner guidance on the
 * suite. Set it via `suite update`, then GET the suite again and assert it
 * persisted. Only runs when OBS_TEST_SUITE_ID points at a real suite.
 * Restores the suite's original planner_instructions in a finally block so
 * the fixture suite is left exactly as found.
 */
export async function testSuiteInstructionsPersist() {
  const suiteId = process.env.OBS_TEST_SUITE_ID;
  if (!suiteId) return;

  const beforeResult = await runCLI(['suite', 'get', suiteId, '--json']);
  assertSuccess(beforeResult, 'obs suite get should succeed before instructions test');
  const before = JSON.parse(beforeResult.stdout);
  const beforeSuite = before.suite ?? before.data?.suite;
  if (!beforeSuite) throw new Error('Could not read suite state before instructions test');
  const originalInstructions: string | null = beforeSuite.planner_instructions ?? null;

  const newInstructions = `E2E instructions persistence check ${Date.now()}`;

  try {
    const updateResult = await runCLI([
      'suite',
      'update',
      suiteId,
      '--instructions',
      newInstructions,
      '--json',
    ]);
    assertSuccess(updateResult, 'obs suite update --instructions should succeed');

    // GET/pull and assert the instructions persisted.
    const getResult = await runCLI(['suite', 'get', suiteId, '--json']);
    assertSuccess(getResult, 'obs suite get should succeed after instructions update');
    const fetched = JSON.parse(getResult.stdout);
    const suite = fetched.suite ?? fetched.data?.suite;
    if (!suite || suite.planner_instructions !== newInstructions) {
      throw new Error(
        `Instructions did not persist: expected "${newInstructions}", got ` +
          `"${suite?.planner_instructions}"`
      );
    }
  } finally {
    // Restore the original instructions (empty string clears the field per --help).
    await runCLI([
      'suite',
      'update',
      suiteId,
      '--instructions',
      originalInstructions ?? '',
      '--json',
    ]);
  }
}
