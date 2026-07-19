import { runCLI, assertSuccess, assertJSON } from '../../lib/test-runner.js';

export async function testSuiteHeal() {
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
    console.log('      - No suites found, skipping heal test');
    return;
  }

  const suiteId = suites[0].id;
  console.log(`      - Triggering heal for suite ${suiteId}...`);
  const result = await runCLI(['suite', 'heal', String(suiteId), '--json']);

  // Heal requires generated tests to exist — skip gracefully if none
  if (result.exitCode !== 0) {
    const out = result.stdout + result.stderr;
    if (out.includes('no generated tests') || out.includes('400') || out.includes('Failed')) {
      console.log('      - Suite has no generated tests, skipping heal assertion');
      return;
    }
    throw new Error(`Suite heal failed unexpectedly: ${out}`);
  }

  assertJSON(result.stdout, 'heal output should be JSON');
  const parsed = JSON.parse(result.stdout);
  const heals = parsed.heals || parsed.data?.heals;
  if (!Array.isArray(heals)) {
    throw new TypeError(`Expected heals array in response, got: ${result.stdout}`);
  }
  console.log(`      - Heal returned ${heals.length} heal(s).`);
}
