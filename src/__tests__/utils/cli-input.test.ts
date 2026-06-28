import { describe, it, expect } from 'vitest';
import { parseIdList } from '../../utils/cli-input.js';

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
