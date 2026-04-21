import fs from 'fs';
import path from 'path';
import os from 'os';
import { runCLI, assertSuccess, assertFailure, assertContains } from '../../lib/test-runner.js';

export async function testSuitePushHelp() {
  const result = await runCLI(['suite', 'push', '--help']);
  assertSuccess(result, 'obs suite push --help should succeed');
  assertContains(result.stdout, '--from', 'Help should show --from option');
  assertContains(result.stdout, 'id', 'Help should show id argument');
}

export async function testSuitePushMissingDirFails() {
  const result = await runCLI([
    'suite',
    'push',
    'some-id',
    '--from',
    '/tmp/obs-nonexistent-dir-xyz',
  ]);
  assertFailure(result, 'obs suite push with missing dir should fail');
  assertContains(
    result.stdout + result.stderr,
    'not found',
    'Error should mention directory not found'
  );
}

export async function testSuitePushNoSuiteJsonFails() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'obs-push-test-'));
  try {
    const result = await runCLI(['suite', 'push', 'nonexistent-suite-id-xyz', '--from', tmpDir]);
    assertFailure(result, 'obs suite push with no matching suite.json should fail');
    assertContains(
      result.stdout + result.stderr,
      'obs suite pull',
      'Error should suggest running pull first'
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

export async function testSuitePushRecognizedCommand() {
  // Verify the command is wired and accepts the id argument
  const result = await runCLI(['suite', 'push', 'some-id']);
  const output = result.stdout + result.stderr;
  if (output.includes('unknown command') || output.includes('unknown argument')) {
    throw new Error('obs suite push should be a recognized command');
  }
}

export async function testSuitePushEndToEnd() {
  // Full pull → edit → push cycle — only runs if OBS_TEST_SUITE_ID is set
  const suiteId = process.env.OBS_TEST_SUITE_ID;
  if (!suiteId) return;

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'obs-push-integration-'));
  try {
    // Pull first
    const pullResult = await runCLI(['suite', 'pull', suiteId, '--out', tmpDir]);
    assertSuccess(pullResult, 'Pull should succeed before push test');

    // Find the suite folder
    const dirs = fs.readdirSync(tmpDir, { withFileTypes: true }).filter((e) => e.isDirectory());
    if (dirs.length === 0) throw new Error('No suite folder created by pull');
    const folderPath = path.join(tmpDir, dirs[0].name);

    const suiteJson = JSON.parse(fs.readFileSync(path.join(folderPath, 'suite.json'), 'utf8'));
    if (!suiteJson.tests?.length) return; // no tests to push

    // Append a comment to the first test file (non-breaking change)
    const firstTest = suiteJson.tests[0];
    const filePath = path.join(folderPath, firstTest.file);
    const original = fs.readFileSync(filePath, 'utf8');
    fs.writeFileSync(filePath, original + '\n// obs-push-test\n', 'utf8');

    // Push back
    const pushResult = await runCLI(['suite', 'push', suiteId, '--from', tmpDir]);
    assertSuccess(pushResult, 'obs suite push should succeed');
    assertContains(pushResult.stdout, 'Pushed', 'Output should confirm push');
    assertContains(pushResult.stdout, 'updated', 'Output should report tests updated');

    // Restore original content
    fs.writeFileSync(filePath, original, 'utf8');
    await runCLI(['suite', 'push', suiteId, '--from', tmpDir]);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
