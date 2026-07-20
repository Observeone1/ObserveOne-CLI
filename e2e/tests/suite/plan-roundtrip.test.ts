import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runCLI, assertSuccess, assertContains, getSuiteJson } from '../../lib/test-runner.js';

/**
 * v1.36 parity regression: PLAN.md round-trip.
 *
 * Pull a fixture suite, edit its PLAN.md locally, push it back, then fetch
 * the suite again and assert the pushed content is what comes back. Only
 * runs when OBS_TEST_SUITE_ID points at a real, already-generated suite
 * (same gating convention as testSuitePushEndToEnd) — never generates a
 * suite itself, since `suite generate` fires real AI planning/generation.
 * Restores the original PLAN.md in a finally block so the fixture suite is
 * left exactly as found.
 */
export async function testSuitePlanMarkdownRoundTrip() {
  const suiteId = process.env.OBS_TEST_SUITE_ID;
  if (!suiteId) return;

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'obs-plan-roundtrip-'));
  let originalPlan: string | undefined;
  let planPath: string | undefined;

  try {
    // Pull first so we have a local PLAN.md to compare against later.
    const pullResult = await runCLI(['suite', 'pull', suiteId, '--out', tmpDir]);
    assertSuccess(pullResult, 'Pull should succeed before plan round-trip test');

    const dirs = fs.readdirSync(tmpDir, { withFileTypes: true }).filter((e) => e.isDirectory());
    if (dirs.length === 0) throw new Error('No suite folder created by pull');
    const folderPath = path.join(tmpDir, dirs[0].name);
    planPath = path.join(folderPath, 'PLAN.md');

    if (!fs.existsSync(planPath)) return; // fixture suite has no plan yet, nothing to round-trip

    originalPlan = fs.readFileSync(planPath, 'utf8');
    const marker = `<!-- obs-e2e-plan-roundtrip ${Date.now()} -->`;
    fs.writeFileSync(planPath, `${originalPlan}\n${marker}\n`, 'utf8');

    // Push the edited plan back.
    const pushResult = await runCLI(['suite', 'push', suiteId, '--from', tmpDir]);
    assertSuccess(pushResult, 'obs suite push should succeed');
    assertContains(
      pushResult.stdout,
      'PLAN.md pushed',
      'Output should confirm the plan was pushed'
    );

    // GET the suite again — the pushed content must be what comes back.
    const fetched = await getSuiteJson(suiteId, 'obs suite get should succeed after push');
    const fetchedPlan = fetched.plan_markdown as string | undefined;
    if (!fetchedPlan?.includes(marker)) {
      throw new Error('Pushed PLAN.md content was not reflected by a subsequent GET');
    }
  } finally {
    // Restore the original plan so the fixture suite is left unchanged.
    if (planPath && originalPlan !== undefined) {
      fs.writeFileSync(planPath, originalPlan, 'utf8');
      await runCLI(['suite', 'push', suiteId, '--from', tmpDir]);
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
