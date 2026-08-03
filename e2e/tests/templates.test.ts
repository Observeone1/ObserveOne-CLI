import { runCLI, assertSuccess, assertStrictJSON } from '../lib/test-runner.js';

export async function testTemplatesListSucceeds() {
  const result = await runCLI(['templates', 'list']);
  assertSuccess(result, 'obs templates list should succeed');
  if (!result.stdout.includes('monitor') || !result.stdout.includes('heartbeat')) {
    throw new Error('templates list output missing expected resources');
  }
}

export async function testTemplatesListJsonEnvelope() {
  const result = await runCLI(['templates', 'list', '--json']);
  assertStrictJSON(result.stdout, 'templates list --json must output valid JSON envelope');
  const parsed = JSON.parse(result.stdout.trim()) as { status?: string; data?: unknown };
  if (parsed.status !== 'SUCCESS') {
    throw new Error(`Expected SUCCESS envelope, got: ${parsed.status}`);
  }
  const data = parsed.data as { templates?: Array<{ name: string }> };
  if (data?.templates?.length !== 6) {
    throw new Error(`Expected 6 templates, got ${data?.templates?.length}`);
  }
}
