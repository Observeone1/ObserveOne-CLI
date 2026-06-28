import { describe, it, expect } from 'vitest';
import { parseDisplayOrder } from '../../commands/status-page.js';

describe('parseDisplayOrder', () => {
  it('parses a numeric string into an integer', () => {
    expect(parseDisplayOrder('12')).toBe(12);
  });

  it('rejects a non-numeric value with a clear error and no NaN', () => {
    expect(() => parseDisplayOrder('abc')).toThrow('Invalid --order value (must be an integer)');
    expect(() => parseDisplayOrder('')).toThrow('Invalid --order value (must be an integer)');
  });
});
