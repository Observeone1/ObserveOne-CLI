import { runCLI, assertSuccess, assertContains, assertJSON } from '../../lib/test-runner.js';

export async function testSuiteRegenerateHelp() {
  const result = await runCLI(['suite', 'regenerate', '--help']);
  assertSuccess(result, 'obs suite regenerate --help should succeed');
  assertContains(result.stdout, '--dry-run', 'Help should show --dry-run option');
  assertContains(result.stdout, '--all', 'Help should show --all option');
}

export async function testSuiteRegenerateUnknownIdFails() {
  const result = await runCLI(['suite', 'regenerate', 'nonexistent-suite-id-xyz', '--dry-run']);
  if (result.exitCode === 0) {
    throw new Error('obs suite regenerate with unknown ID should fail');
  }
}

/**
 * v1.36 parity regression: `regenerate --dry-run` must report what it would
 * regenerate WITHOUT creating any generation run or mutating scripts.
 *
 * Only runs when OBS_TEST_SUITE_ID points at a real, already-generated
 * suite. `--all` is used alongside `--dry-run` so the command has a
 * non-empty target to report even when nothing is stale/missing — `--all`
 * only expands what dry-run *lists*, the dry-run check itself still happens
 * before any API call that would queue generation (see
 * src/commands/suite/regenerate.ts), so this remains a read-only probe.
 * Verified manually before writing this test: active_generations and
 * test_count on the fixture suite were unchanged after the dry run.
 */
export async function testSuiteRegenerateDryRunDoesNotMutate() {
  const suiteId = process.env.OBS_TEST_SUITE_ID;
  if (!suiteId) return;

  // Snapshot suite state before the dry run.
  const beforeResult = await runCLI(['suite', 'get', suiteId, '--json']);
  assertSuccess(beforeResult, 'obs suite get should succeed before dry run');
  const before = JSON.parse(beforeResult.stdout);
  const beforeSuite = before.suite ?? before.data?.suite;
  if (!beforeSuite) throw new Error('Could not read suite state before dry run');

  // Dry-run with --all so the report is non-empty even when nothing is stale/missing.
  const dryRunResult = await runCLI([
    'suite',
    'regenerate',
    suiteId,
    '--dry-run',
    '--all',
    '--json',
  ]);
  assertSuccess(dryRunResult, 'obs suite regenerate --dry-run should succeed');
  assertJSON(dryRunResult.stdout, 'regenerate --dry-run --json output should be JSON');
  const dryRun = JSON.parse(dryRunResult.stdout);
  const dryRunData = dryRun.data ?? dryRun;
  if (dryRunData.dry_run !== true) {
    throw new Error('regenerate --dry-run output should report dry_run: true');
  }
  if (!Array.isArray(dryRunData.targets)) {
    throw new Error('regenerate --dry-run output should list targets');
  }

  // Snapshot suite state after the dry run — nothing should have changed.
  const afterResult = await runCLI(['suite', 'get', suiteId, '--json']);
  assertSuccess(afterResult, 'obs suite get should succeed after dry run');
  const after = JSON.parse(afterResult.stdout);
  const afterSuite = after.suite ?? after.data?.suite;
  if (!afterSuite) throw new Error('Could not read suite state after dry run');

  if (afterSuite.test_count !== beforeSuite.test_count) {
    throw new Error(
      `Dry run must not change test_count: was ${beforeSuite.test_count}, now ${afterSuite.test_count}`
    );
  }
  if (afterSuite.active_generations !== beforeSuite.active_generations) {
    throw new Error(
      `Dry run must not start a generation run: active_generations was ` +
        `${beforeSuite.active_generations}, now ${afterSuite.active_generations}`
    );
  }
}
