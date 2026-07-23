import { describe, it, expect } from 'vitest';
import {
  parseIdList,
  parseKeyValuePairs,
  parseIdsFromText,
  collectOptionValues,
  parseJsonArrayOption,
} from '../../utils/cli-input.js';

describe('collectOptionValues', () => {
  it('accumulates repeated flag values into an array, preserving order', () => {
    let acc = collectOptionValues('a', []);
    acc = collectOptionValues('b', acc);
    expect(acc).toEqual(['a', 'b']);
  });

  it('defaults to a fresh array when no previous value is passed', () => {
    expect(collectOptionValues('only')).toEqual(['only']);
  });
});

describe('parseJsonArrayOption', () => {
  it('returns undefined for empty input', () => {
    expect(parseJsonArrayOption(undefined, 'assertions')).toBeUndefined();
    expect(parseJsonArrayOption([], 'assertions')).toBeUndefined();
  });

  it('parses each entry as JSON and returns the array', () => {
    const result = parseJsonArrayOption<{ type: string }>(
      ['{"type":"status"}', '{"type":"body"}'],
      'assertions'
    );
    expect(result).toEqual([{ type: 'status' }, { type: 'body' }]);
  });

  it('accepts a single non-array string input', () => {
    expect(parseJsonArrayOption('{"a":1}', 'assertions')).toEqual([{ a: 1 }]);
  });

  it('throws with the offending entry on invalid JSON', () => {
    expect(() => parseJsonArrayOption(['not json'], 'assertions')).toThrow(
      /Invalid --assertions JSON: "not json"/
    );
  });
});

describe('parseIdsFromText', () => {
  it('returns [] for empty/whitespace input', () => {
    expect(parseIdsFromText('')).toEqual([]);
    expect(parseIdsFromText('   \n  ')).toEqual([]);
  });

  it('splits whitespace- and newline-separated tokens', () => {
    expect(parseIdsFromText('a b\nc\t d')).toEqual(['a', 'b', 'c', 'd']);
  });

  it('parses a JSON array of strings', () => {
    expect(parseIdsFromText('["a", "b", "c"]')).toEqual(['a', 'b', 'c']);
  });

  it('parses a JSON array of objects with an id field', () => {
    expect(parseIdsFromText('[{"id":"a"},{"id":"b"}]')).toEqual(['a', 'b']);
  });

  it('deduplicates while preserving first-seen order', () => {
    expect(parseIdsFromText('a b a c b')).toEqual(['a', 'b', 'c']);
  });

  it('falls back to whitespace splitting on malformed JSON', () => {
    expect(parseIdsFromText('[a b')).toEqual(['[a', 'b']);
  });
});

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

describe('parseIdsFromText with id-less JSON entries', () => {
  it('drops array entries that are neither strings nor objects carrying an id', () => {
    expect(parseIdsFromText('[{"name":"no-id"}, null, 42, {"id":"keep-me"}, "plain"]')).toEqual([
      'keep-me',
      'plain',
    ]);
  });
});
