import { describe, it, expect } from 'vitest';
import { parseIdList, parseKeyValuePairs } from '../../utils/cli-input.js';

describe('parseIdList', () => {
  it('returns undefined for empty input', () => {
    expect(parseIdList(undefined, 'alert-channel-id')).toBeUndefined();
    expect(parseIdList([], 'alert-channel-id')).toBeUndefined();
  });

  it('passes UUID strings through unchanged', () => {
    const uuid = '3f1a9c2e-1b4d-4e8a-9c7f-2a6b5d0e1f23';
    expect(parseIdList(uuid, 'alert-channel-id')).toEqual([uuid]);
    expect(parseIdList([uuid, 'another-uuid'], 'alert-channel-id')).toEqual([uuid, 'another-uuid']);
  });

  it('trims surrounding whitespace', () => {
    expect(parseIdList('  abc  ', 'alert-channel-id')).toEqual(['abc']);
  });

  it('does not coerce numeric-looking ids to numbers', () => {
    const result = parseIdList('42', 'alert-channel-id');
    expect(result).toEqual(['42']);
    expect(typeof result?.[0]).toBe('string');
  });

  it('rejects empty/blank values', () => {
    expect(() => parseIdList('   ', 'alert-channel-id')).toThrow(/cannot be empty/);
    expect(() => parseIdList(['ok', ''], 'alert-channel-id')).toThrow(/cannot be empty/);
  });
});

describe('parseKeyValuePairs', () => {
  it('returns undefined for empty input', () => {
    expect(parseKeyValuePairs(undefined, 'var')).toBeUndefined();
    expect(parseKeyValuePairs([], 'var')).toBeUndefined();
  });

  it('parses KEY=VALUE pairs and trims whitespace', () => {
    expect(parseKeyValuePairs('REGION=us-east', 'var')).toEqual({ REGION: 'us-east' });
    expect(parseKeyValuePairs([' TIER = paid ', 'A=b'], 'var')).toEqual({ TIER: 'paid', A: 'b' });
  });

  it('preserves an empty value (KEY=) — this is the secret-deletion sentinel', () => {
    // `obs environment secrets <id> --secret OLD_KEY=` relies on '' meaning "delete".
    expect(parseKeyValuePairs('OLD_KEY=', 'secret')).toEqual({ OLD_KEY: '' });
    expect(parseKeyValuePairs(['KEEP=1', 'DROP='], 'secret')).toEqual({ KEEP: '1', DROP: '' });
  });

  it('keeps only the first = as the separator (values may contain =)', () => {
    expect(parseKeyValuePairs('URL=https://x/?a=1', 'var')).toEqual({ URL: 'https://x/?a=1' });
  });

  it('throws on a missing separator', () => {
    expect(() => parseKeyValuePairs('NOEQUALS', 'secret')).toThrow(/Expected KEY=VALUE/);
  });

  it('throws on an empty key (leading =)', () => {
    expect(() => parseKeyValuePairs('=value', 'secret')).toThrow(/Expected KEY=VALUE/);
    expect(() => parseKeyValuePairs('  =value', 'var')).toThrow(/KEY=VALUE|cannot be empty/);
  });
});
