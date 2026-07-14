import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  runCLI,
  assertSuccess,
  assertFailure,
  assertContains,
  assertJSON,
} from '../../lib/test-runner.js';

export async function testFileWorkflow() {
  const tmpDir = join(tmpdir(), `obs-e2e-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });

  let monitorId: number | undefined;

  try {
    // --- obs init monitor (default output) ---
    console.log('      - Scaffolding monitor template to default path...');
    const defaultOut = join(tmpDir, 'obs-monitor.json');
    const initResult = await runCLI(['init', 'monitor', '--out', defaultOut]);
    assertSuccess(initResult, 'obs init monitor failed');
    if (!existsSync(defaultOut)) throw new Error(`Template file not created at ${defaultOut}`);
    const template = JSON.parse(readFileSync(defaultOut, 'utf-8'));
    if (!template.name || !template.url) throw new Error('Template missing expected fields');

    // --- obs init monitor --out with nested directory ---
    console.log('      - Scaffolding monitor template to nested path...');
    const nestedOut = join(tmpDir, 'nested', 'deep', 'monitor.json');
    const initNestedResult = await runCLI(['init', 'monitor', '--out', nestedOut]);
    assertSuccess(initNestedResult, 'obs init monitor --out nested failed');
    if (!existsSync(nestedOut)) throw new Error(`Nested template file not created at ${nestedOut}`);

    // --- obs init with unknown resource ---
    console.log('      - Testing obs init with unknown resource...');
    const initBadResult = await runCLI(['init', 'fakeresource']);
    assertFailure(initBadResult, 'obs init with unknown resource should fail');

    // --- obs validate valid file ---
    console.log('      - Validating valid monitor template...');
    const validateResult = await runCLI(['validate', '-r', 'monitor', '-f', defaultOut, '--json']);
    assertSuccess(validateResult, 'Validate of valid file failed');
    assertJSON(validateResult.stdout, 'Validate output should be JSON');
    const validateData = JSON.parse(validateResult.stdout);
    const valid = validateData.valid ?? validateData.data?.valid;
    if (!valid) throw new Error('Validate reported invalid for a valid file');

    // --- obs validate invalid file (missing required fields) ---
    console.log('      - Validating invalid file (missing required fields)...');
    const badFile = join(tmpDir, 'bad-monitor.json');
    writeFileSync(badFile, JSON.stringify({ description: 'missing name and url' }, null, 2));
    const validateBadResult = await runCLI(['validate', '-r', 'monitor', '-f', badFile, '--json']);
    assertFailure(validateBadResult, 'Validate of invalid file should fail');
    assertContains(validateBadResult.stdout, 'name', 'Missing field name should appear in output');

    // --- obs monitor create --file ---
    console.log('      - Creating monitor from file...');
    const monitorFile = join(tmpDir, 'create-monitor.json');
    const timestamp = Date.now();
    writeFileSync(
      monitorFile,
      JSON.stringify(
        {
          name: `E2E-File-Monitor-${timestamp}`,
          url: 'https://example.com/e2e-file-test',
          cron_expression: '*/10 * * * *',
          timeout_ms: 30000,
          alert_on_failure: true,
        },
        null,
        2
      )
    );
    const createResult = await runCLI(['monitor', 'create', '--file', monitorFile, '--json']);
    assertSuccess(createResult, 'monitor create --file failed');
    assertJSON(createResult.stdout, 'Create output should be JSON');
    const created = JSON.parse(createResult.stdout);
    monitorId = created.id ?? created.data?.id;
    if (!monitorId) throw new Error('Could not extract monitor ID from create --file response');

    // --- obs validate with missing file ---
    console.log('      - Validating with missing file path...');
    const validateMissingResult = await runCLI([
      'validate',
      '-r',
      'monitor',
      '-f',
      join(tmpDir, 'does-not-exist.json'),
    ]);
    assertFailure(validateMissingResult, 'Validate with missing file should fail');
  } finally {
    if (monitorId) {
      console.log(`      - [Cleanup] Deleting monitor ${monitorId}...`);
      await runCLI(['monitor', 'delete', monitorId.toString(), '-y', '--json']);
    }
    rmSync(tmpDir, { recursive: true, force: true });
  }
}
