import { runCLI, assertSuccess, assertFailure, assertStrictJSON } from '../lib/test-runner.js';

export async function testSchemaValidResource() {
  const result = await runCLI(['schema', 'monitor']);
  assertSuccess(result, 'obs schema monitor should succeed');
  const parsed = JSON.parse(result.stdout.trim()) as Record<string, unknown>;
  if (parsed.$schema !== 'http://json-schema.org/draft-07/schema#') {
    throw new Error('Schema output missing Draft-07 $schema header');
  }
  if (parsed.title !== 'monitor') {
    throw new Error(`Expected title "monitor", got ${String(parsed.title)}`);
  }
  const required = parsed.required as string[];
  if (!Array.isArray(required) || !required.includes('name') || !required.includes('url')) {
    throw new Error('monitor schema missing required name/url fields');
  }
}

export async function testSchemaResolvesAliases() {
  const result = await runCLI(['schema', 'api-check']);
  assertSuccess(result, 'obs schema api-check should resolve to check');
  const parsed = JSON.parse(result.stdout.trim()) as Record<string, unknown>;
  if (parsed.title !== 'check') {
    throw new Error(`Expected alias api-check → check, got ${String(parsed.title)}`);
  }
}

export async function testSchemaInvalidResourceFails() {
  const result = await runCLI(['schema', 'bogus-resource-xyz']);
  assertFailure(result, 'obs schema with invalid resource should fail');
}

export async function testSchemaJsonEnvelope() {
  const result = await runCLI(['schema', 'monitor', '--json']);
  assertStrictJSON(result.stdout, 'schema --json must output valid JSON envelope');
  const parsed = JSON.parse(result.stdout.trim()) as { status?: string };
  if (parsed.status !== 'SUCCESS' && parsed.status !== 'ERROR') {
    throw new Error(`JSON envelope status must be SUCCESS or ERROR, got: ${parsed.status}`);
  }
}
