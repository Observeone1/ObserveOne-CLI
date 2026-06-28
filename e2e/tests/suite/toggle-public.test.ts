import { runCLI, assertSuccess, assertJSON } from '../../lib/test-runner.js';

export async function testSuiteTogglePublic() {
  console.log('      - Listing suites to find first suite...');
  const listResult = await runCLI(['suite', 'list', '--json']);
  assertSuccess(listResult, 'Suite list failed');

  let suites: Array<{ id: string }> = [];
  try {
    const parsed = JSON.parse(listResult.stdout);
    suites = parsed.suites || parsed.data?.suites || [];
  } catch {
    // Skip if no JSON
  }

  if (suites.length === 0) {
    console.log('      - No suites found, skipping toggle-public test');
    return;
  }

  const suiteId = suites[0].id;
  console.log(`      - Toggling public visibility for suite ${suiteId}...`);
  const result = await runCLI(['suite', 'toggle-public', String(suiteId), '-y', '--json']);
  assertSuccess(result, 'Suite toggle-public failed');
  assertJSON(result.stdout, 'toggle-public output should be JSON');

  // Toggle back to restore original state
  console.log(`      - Toggling back suite ${suiteId}...`);
  await runCLI(['suite', 'toggle-public', String(suiteId), '-y', '--json']);
}
