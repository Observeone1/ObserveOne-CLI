import { runCLI, assertSuccess, assertContains } from '../lib/test-runner.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export async function testVersionCommand() {
  const packagePath = join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
  const expectedVersion = packageJson.version;

  const result = await runCLI(['--version']);
  assertSuccess(result, 'Version command should succeed');
  assertContains(result.stdout, expectedVersion, 'Should show correct version');
}

export async function testShortVersionCommand() {
  const packagePath = join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
  const expectedVersion = packageJson.version;

  const result = await runCLI(['-V']);
  assertSuccess(result, 'Short version command should succeed');
  assertContains(result.stdout, expectedVersion, 'Should show correct version');
}
