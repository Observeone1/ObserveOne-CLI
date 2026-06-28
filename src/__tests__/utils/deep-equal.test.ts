import { describe, it, expect } from 'vitest';
import { deepEqual, normalizeResource, fieldChanged } from '../../utils/deep-equal.js';

describe('deepEqual', () => {
  describe('primitives', () => {
    it('should return true for equal strings', () => {
      expect(deepEqual('test', 'test')).toBe(true);
    });

    it('should return true for equal numbers', () => {
      expect(deepEqual(42, 42)).toBe(true);
    });

    it('should return true for equal booleans', () => {
      expect(deepEqual(true, true)).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(deepEqual('test', 'different')).toBe(false);
    });

    it('should return false for different numbers', () => {
      expect(deepEqual(42, 100)).toBe(false);
    });
  });

  describe('null and undefined', () => {
    it('should return true for equal null values', () => {
      expect(deepEqual(null, null)).toBe(true);
    });

    it('should return true for equal undefined values', () => {
      expect(deepEqual(undefined, undefined)).toBe(true);
    });

    it('should return false for null vs undefined', () => {
      expect(deepEqual(null, undefined)).toBe(false);
    });

    it('should return false for null vs object', () => {
      expect(deepEqual(null, {})).toBe(false);
    });
  });

  describe('arrays', () => {
    it('should return true for equal arrays', () => {
      expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    });

    it('should return false for arrays with different lengths', () => {
      expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
    });

    it('should return false for arrays with different values', () => {
      expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false);
    });

    it('should handle nested arrays', () => {
      expect(
        deepEqual(
          [
            [1, 2],
            [3, 4],
          ],
          [
            [1, 2],
            [3, 4],
          ]
        )
      ).toBe(true);
    });
  });

  describe('objects', () => {
    it('should return true for equal objects', () => {
      expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
    });

    it('should return false for objects with different keys', () => {
      expect(deepEqual({ a: 1 }, { b: 1 })).toBe(false);
    });

    it('should return false for objects with different values', () => {
      expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
    });

    it('should handle nested objects', () => {
      expect(deepEqual({ a: { b: { c: 1 } } }, { a: { b: { c: 1 } } })).toBe(true);
    });

    it('should handle objects with different key orders', () => {
      expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    });
  });

  describe('mixed structures', () => {
    it('should handle objects with arrays', () => {
      expect(
        deepEqual({ name: 'test', values: [1, 2, 3] }, { name: 'test', values: [1, 2, 3] })
      ).toBe(true);
    });

    it('should handle arrays of objects', () => {
      expect(
        deepEqual(
          [
            { id: 1, name: 'a' },
            { id: 2, name: 'b' },
          ],
          [
            { id: 1, name: 'a' },
            { id: 2, name: 'b' },
          ]
        )
      ).toBe(true);
    });
  });

  describe('type mismatches', () => {
    it('should return false for different types', () => {
      expect(deepEqual(1, '1')).toBe(false);
    });

    it('should return false for string vs number object', () => {
      expect(deepEqual('test', { value: 'test' })).toBe(false);
    });
  });
});

describe('normalizeResource', () => {
  it('should apply default values', () => {
    const result = normalizeResource(
      { name: 'test' },
      { timeout_ms: 30000, alert_on_failure: true }
    );

    expect(result).toEqual({
      name: 'test',
      timeout_ms: 30000,
      alert_on_failure: true,
    });
  });

  it('should not override existing values', () => {
    const result = normalizeResource({ name: 'test', timeout_ms: 5000 }, { timeout_ms: 30000 });

    expect(result.timeout_ms).toBe(5000);
  });

  it('should sort keys alphabetically', () => {
    const result = normalizeResource({ z: 1, a: 2, m: 3 });

    const keys = Object.keys(result);
    expect(keys).toEqual(['a', 'm', 'z']);
  });

  it('should handle empty defaults', () => {
    const result = normalizeResource({ b: 2, a: 1 });

    expect(result).toEqual({ a: 1, b: 2 });
  });

  it('should handle monitor-like objects', () => {
    const result = normalizeResource(
      {
        name: 'My Monitor',
        url: 'https://example.com',
        alert_on_failure: true,
      },
      { timeout_ms: 30000, alert_on_failure: true }
    );

    expect(result).toEqual({
      alert_on_failure: true,
      name: 'My Monitor',
      timeout_ms: 30000,
      url: 'https://example.com',
    });
  });
});

describe('fieldChanged', () => {
  it('returns false when the desired value is omitted (undefined)', () => {
    // Omitted field = "don't care": must never produce a spurious update,
    // even when the remote holds a non-default value.
    expect(fieldChanged(undefined, true)).toBe(false);
    expect(fieldChanged(undefined, false)).toBe(false);
    expect(fieldChanged(undefined, 300)).toBe(false);
  });

  it('returns true when an explicit value differs from remote', () => {
    expect(fieldChanged(false, true)).toBe(true);
    expect(fieldChanged(60, 300)).toBe(true);
  });

  it('returns false when an explicit value equals remote', () => {
    // Explicitly-set-but-unchanged must NOT update (no spurious diff).
    expect(fieldChanged(true, true)).toBe(false);
    expect(fieldChanged(300, 300)).toBe(false);
  });

  it('treats null as an explicit value (distinct from undefined)', () => {
    expect(fieldChanged(null, undefined)).toBe(true);
    expect(fieldChanged(null, null)).toBe(false);
  });
});
