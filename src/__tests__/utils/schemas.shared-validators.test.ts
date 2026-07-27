import { describe, it, expect } from 'vitest';
import { resolveSchema, buildJsonSchema } from '../../utils/schemas.js';

/**
 * The shared validator/transformer factories are reached through the schema
 * objects that use them, so each case picks a resource that wires the factory
 * to a real field and asserts the message or coerced value a CLI user sees.
 */
describe('trimNonEmpty name/slug validators', () => {
  it.each([
    ['project', 'name', 'Name'],
    ['api-collection', 'name', 'Name'],
    ['status-page', 'slug', 'Slug'],
  ])('%s.%s rejects blank input and accepts a real value', (resource, field, label) => {
    const validate = resolveSchema(resource)!.fieldMetadata![field]!.validate!;

    expect(validate(undefined)).toBe(`${label} is required`);
    expect(validate('')).toBe(`${label} is required`);
    expect(validate('   ')).toBe(`${label} is required`);
    expect(validate('real value')).toBe(true);
  });
});

describe('case transformers leave non-strings untouched', () => {
  it('the check method transformer uppercases strings but passes numbers through', () => {
    const transformer = resolveSchema('check')!.fieldMetadata!.method!.transformer!;
    expect(transformer('post')).toBe('POST');
    expect(transformer(42)).toBe(42);
  });

  it('the db-monitor protocol transformer lowercases strings but passes numbers through', () => {
    const transformer = resolveSchema('db-monitor')!.fieldMetadata!.protocol!.transformer!;
    expect(transformer('POSTGRES')).toBe('postgres');
    expect(transformer(42)).toBe(42);
  });
});

describe('channel_ids transformers default to an empty list', () => {
  it.each(['check', 'ssl-monitor', 'tcp-monitor'])(
    '%s returns [] when no --alert-channel-id is passed',
    (resource) => {
      const transformer = resolveSchema(resource)!.fieldMetadata!.channel_ids!.transformer!;
      expect(transformer(undefined)).toEqual([]);
      expect(transformer([' id-1 ', 'id-2'])).toEqual(['id-1', 'id-2']);
    }
  );
});

describe('api-collection headers transformer', () => {
  it('parses repeatable --header KEY=VALUE flags into a map', () => {
    const transformer = resolveSchema('api-collection')!.fieldMetadata!.headers!.transformer!;
    expect(transformer(['Authorization=Bearer abc', 'X-Env=prod'])).toEqual({
      Authorization: 'Bearer abc',
      'X-Env': 'prod',
    });
  });
});

describe('resolveSchema / buildJsonSchema misses', () => {
  it('returns undefined for a resource that does not exist', () => {
    expect(resolveSchema('does-not-exist')).toBeUndefined();
    expect(buildJsonSchema('does-not-exist')).toBeUndefined();
  });
});
