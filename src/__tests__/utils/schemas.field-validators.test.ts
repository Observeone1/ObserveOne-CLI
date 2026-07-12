import { describe, it, expect } from 'vitest';
import { resolveSchema } from '../../utils/schemas.js';

describe('monitor schema field validators/transformers', () => {
  const schema = resolveSchema('monitor')!;

  it('validateUrl rejects non-string and malformed URLs, accepts a valid one', () => {
    const validate = schema.fieldMetadata!.url!.validate!;
    expect(validate(123)).toBe('Please enter a valid URL (e.g. https://example.com)');
    expect(validate('not a url')).toBe('Please enter a valid URL (e.g. https://example.com)');
    expect(validate('https://example.com')).toBe(true);
  });

  it('channel_ids transformer trims each repeatable --alert-channel-id value', () => {
    const transformer = schema.fieldMetadata!.channel_ids!.transformer!;
    expect(transformer(['id-1', ' id-2 '])).toEqual(['id-1', 'id-2']);
    expect(transformer(undefined)).toEqual([]);
  });
});

describe('check schema field validators/transformers', () => {
  const schema = resolveSchema('check')!;

  it('method transformer uppercases the flag value', () => {
    expect(schema.fieldMetadata!.method!.transformer!('post')).toBe('POST');
  });

  it('headers transformer parses key=value pairs into a map', () => {
    const headers = schema.fieldMetadata!.headers!.transformer!(['Authorization=Bearer abc']);
    expect(headers).toEqual({ Authorization: 'Bearer abc' });
  });

  it('retry_count/retry_interval transformers coerce strings to ints', () => {
    expect(schema.fieldMetadata!.retry_count!.transformer!('3')).toBe(3);
    expect(schema.fieldMetadata!.retry_interval!.transformer!('30')).toBe(30);
  });
});

describe('incident schema field validators/transformers', () => {
  const schema = resolveSchema('incident')!;

  it('title validator enforces a 3-char minimum', () => {
    const validate = schema.fieldMetadata!.title!.validate!;
    expect(validate('ab')).toBe('Title is required');
    expect(validate('  ')).toBe('Title is required');
    expect(validate('Outage')).toBe(true);
  });

  it('priority transformer uppercases the choice', () => {
    expect(schema.fieldMetadata!.priority!.transformer!('high')).toBe('HIGH');
  });
});

describe('ssl-monitor schema field validators', () => {
  const schema = resolveSchema('ssl-monitor')!;

  it('validateHostname rejects a scheme/path and accepts a bare hostname', () => {
    const validate = schema.fieldMetadata!.hostname!.validate!;
    expect(validate('')).toBe('Hostname is required');
    expect(validate('https://example.com')).toBe(
      'Enter a bare hostname without scheme or path (e.g. example.com)'
    );
    expect(validate('example.com/health')).toBe(
      'Enter a bare hostname without scheme or path (e.g. example.com)'
    );
    expect(validate('example.com')).toBe(true);
  });
});

describe('status-page schema field transformers', () => {
  const schema = resolveSchema('status-page')!;

  it('is_public/show_incident_history/show_uptime_percentage negate the CLI flag', () => {
    expect(schema.fieldMetadata!.is_public!.transformer!(true)).toBe(false);
    expect(schema.fieldMetadata!.is_public!.transformer!(false)).toBe(true);
    expect(schema.fieldMetadata!.show_incident_history!.transformer!(true)).toBe(false);
    expect(schema.fieldMetadata!.show_uptime_percentage!.transformer!(true)).toBe(false);
  });
});

describe('tcp/udp/db-monitor channel_ids transformers', () => {
  it('each parses the repeatable --alert-channel-id flag into an id list', () => {
    expect(
      resolveSchema('tcp-monitor')!.fieldMetadata!.channel_ids!.transformer!(['a', 'b'])
    ).toEqual(['a', 'b']);
    expect(
      resolveSchema('udp-monitor')!.fieldMetadata!.channel_ids!.transformer!(['a', 'b'])
    ).toEqual(['a', 'b']);
    expect(
      resolveSchema('db-monitor')!.fieldMetadata!.channel_ids!.transformer!(['a', 'b'])
    ).toEqual(['a', 'b']);
  });
});

describe('check/ssl-monitor channel_ids transformers', () => {
  it('check.channel_ids parses the repeatable flag, and falls back to [] for undefined', () => {
    const transformer = resolveSchema('check')!.fieldMetadata!.channel_ids!.transformer!;
    expect(transformer(['a', 'b'])).toEqual(['a', 'b']);
    expect(transformer(undefined)).toEqual([]);
  });

  it('ssl-monitor.channel_ids parses the repeatable flag, and falls back to [] for undefined', () => {
    const transformer = resolveSchema('ssl-monitor')!.fieldMetadata!.channel_ids!.transformer!;
    expect(transformer(['a', 'b'])).toEqual(['a', 'b']);
    expect(transformer(undefined)).toEqual([]);
  });
});

describe('api-collection headers transformer', () => {
  it('parses key=value pairs into a map', () => {
    const transformer = resolveSchema('api-collection')!.fieldMetadata!.headers!.transformer!;
    expect(transformer(['X-Env=prod'])).toEqual({ 'X-Env': 'prod' });
  });
});

describe('trimNonEmpty validator (shared by several "Name"/"Slug" fields)', () => {
  it('rejects blank/whitespace-only values and accepts a non-empty string', () => {
    const validate = resolveSchema('api-collection')!.fieldMetadata!.name!.validate!;
    expect(validate('')).toBe('Name is required');
    expect(validate('   ')).toBe('Name is required');
    expect(validate(123)).toBe('Name is required');
    expect(validate('My Collection')).toBe(true);
  });
});
