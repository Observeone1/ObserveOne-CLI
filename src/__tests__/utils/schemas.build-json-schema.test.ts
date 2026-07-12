import { describe, it, expect } from 'vitest';
import { resolveSchema, buildJsonSchema, resourceNames } from '../../utils/schemas.js';

describe('resolveSchema', () => {
  it('resolves the api-check / url-monitor aliases to their canonical schemas', () => {
    expect(resolveSchema('api-check')).toBe(resolveSchema('check'));
    expect(resolveSchema('url-monitor')).toBe(resolveSchema('monitor'));
  });

  it('returns undefined for an unknown resource type', () => {
    expect(resolveSchema('not-a-real-resource')).toBeUndefined();
  });
});

describe('resourceNames', () => {
  it('lists every canonical (non-alias) schema key', () => {
    expect(resourceNames).toContain('monitor');
    expect(resourceNames).toContain('check');
    expect(resourceNames).toContain('ssl-monitor');
    expect(resourceNames).not.toContain('api-check');
  });
});

describe('buildJsonSchema', () => {
  it('returns undefined for an unresolvable resource', () => {
    expect(buildJsonSchema('does-not-exist')).toBeUndefined();
  });

  it('titles the schema by canonical key even when called via an alias', () => {
    const schema = buildJsonSchema('api-check') as { title: string; required: string[] };
    expect(schema.title).toBe('check');
    expect(schema.required).toEqual(['name', 'url', 'method']);
  });

  it('infers scalar, array, and nested-object property types from the template', () => {
    const schema = buildJsonSchema('check') as {
      properties: Record<string, { type: string; properties?: Record<string, unknown> }>;
    };

    expect(schema.properties.name!.type).toBe('string');
    expect(schema.properties.timeout_ms!.type).toBe('integer');
    expect(schema.properties.alert_on_failure!.type).toBe('boolean');
    expect(schema.properties.assertions!.type).toBe('array');
    expect(schema.properties.headers!.type).toBe('object');
    expect(schema.properties.headers!.properties).toEqual({});
  });

  it('marks the schema as a draft-07 object with additionalProperties disabled', () => {
    const schema = buildJsonSchema('project') as Record<string, unknown>;
    expect(schema.$schema).toBe('http://json-schema.org/draft-07/schema#');
    expect(schema.type).toBe('object');
    expect(schema.additionalProperties).toBe(false);
  });

  it('recurses into a nested object template (alert-channel config)', () => {
    const schema = buildJsonSchema('alert-channel') as {
      properties: Record<string, { type: string; properties?: Record<string, { type: string }> }>;
    };
    expect(schema.properties.config!.type).toBe('object');
    expect(schema.properties.config!.properties!.email!.type).toBe('string');
  });

  it('types a null template value (environment.project_id) as null', () => {
    const schema = buildJsonSchema('environment') as {
      properties: Record<string, { type: string }>;
    };
    expect(schema.properties.project_id!.type).toBe('null');
  });
});
