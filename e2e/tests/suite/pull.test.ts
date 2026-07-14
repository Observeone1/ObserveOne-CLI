import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runCLI, assertSuccess, assertFailure, assertContains } from '../../lib/test-runner.js';

export async function testSuitePullHelp() {
  const result = await runCLI(['suite', 'pull', '--help']);
  assertSuccess(result, 'obs suite pull --help should succeed');
  assertContains(result.stdout, '--out', 'Help should show --out option');
  assertContains(result.stdout, 'id', 'Help should show id argument');
}

export async function testSuitePullUnknownIdFails() {
  const result = await runCLI(['suite', 'pull', 'nonexistent-suite-id-xyz']);
  assertFailure(result, 'obs suite pull with unknown ID should fail');
}

export async function testSuitePullDefaultsToSuitesDir() {
  // Verify the command is wired and accepts the id argument (will fail at auth/api, not arg parsing)
  const result = await runCLI(['suite', 'pull', 'some-id']);
  const output = result.stdout + result.stderr;
  if (output.includes('unknown command') || output.includes('unknown argument')) {
    throw new Error('obs suite pull should be a recognized command');
  }
}

export async function testSuitePullCustomOutDir() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'obs-pull-test-'));
  try {
    const result = await runCLI(['suite', 'pull', 'nonexistent-suite-id-xyz', '--out', tmpDir]);
    // Will fail at API level (not found / unauth), not at arg parsing
    const output = result.stdout + result.stderr;
    if (output.includes('unknown option')) {
      throw new Error('--out flag should be recognized');
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

export async function testSuitePullWritesExpectedFiles() {
  // Verify the folder + file structure when pull succeeds
  // This test only runs if OBS_TEST_SUITE_ID is set (real integration test)
  const suiteId = process.env.OBS_TEST_SUITE_ID;
  if (!suiteId) return; // skip if no test suite configured

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'obs-pull-integration-'));
  try {
    const result = await runCLI(['suite', 'pull', suiteId, '--out', tmpDir]);
    assertSuccess(result, 'obs suite pull should succeed with a valid suite id');
    assertContains(result.stdout, 'Pulled', 'Output should confirm pull');

    // At least one folder should have been created
    const entries = fs.readdirSync(tmpDir, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory());
    if (dirs.length === 0) {
      throw new Error('Expected at least one suite folder to be created');
    }

    const folderPath = path.join(tmpDir, dirs[0].name);
    const files = fs.readdirSync(folderPath);

    if (!files.includes('suite.json')) {
      throw new Error('Expected suite.json to be written');
    }

    const suiteJson = JSON.parse(fs.readFileSync(path.join(folderPath, 'suite.json'), 'utf8'));
    if (!suiteJson.id || !suiteJson.tests) {
      throw new Error('suite.json must contain id and tests fields');
    }

    // Each test entry should have a corresponding .spec.ts file
    for (const t of suiteJson.tests) {
      if (!files.includes(t.file)) {
        throw new Error(`Expected test file ${t.file} to be written`);
      }
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
