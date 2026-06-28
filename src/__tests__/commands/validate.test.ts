import { describe, it, expect } from 'vitest';
import { validateAgainstSchema } from '../../commands/validate.js';

describe('validateAgainstSchema', () => {
  it('rejects a field whose type differs from the template', () => {
    // monitor.timeout_ms template is a number; a string must be rejected.
    const errors = validateAgainstSchema('monitor', {
      name: 'My Monitor',
      url: 'https://example.com',
      timeout_ms: '30000',
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('timeout_ms');
    expect(errors[0]).toContain('number');
  });

  it('rejects a boolean field given a non-boolean', () => {
    const errors = validateAgainstSchema('monitor', {
      name: 'My Monitor',
      url: 'https://example.com',
      alert_on_failure: 'yes',
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('alert_on_failure');
    expect(errors[0]).toContain('boolean');
  });

  it('rejects an array field given a non-array', () => {
    const errors = validateAgainstSchema('monitor', {
      name: 'My Monitor',
      url: 'https://example.com',
      channel_ids: 'abc',
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('channel_ids');
    expect(errors[0]).toContain('array');
  });

  it('rejects an enum value not in the declared choices', () => {
    const errors = validateAgainstSchema('check', {
      name: 'My Check',
      url: 'https://api.example.com',
      method: 'FETCH',
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('method');
    expect(errors[0]).toContain('GET');
  });

  it('accepts a valid enum value', () => {
    const errors = validateAgainstSchema('check', {
      name: 'My Check',
      url: 'https://api.example.com',
      method: 'POST',
    });
    expect(errors).toEqual([]);
  });

  it('accepts an integer where the template is a number (no float/int split)', () => {
    const errors = validateAgainstSchema('heartbeat', {
      name: 'My Heartbeat',
      period: 120,
      grace_period: 30,
    });
    expect(errors).toEqual([]);
  });

  it('passes unknown keys not present in the template or choices', () => {
    // `id` / `created_at` are exported by other commands but not in the
    // template; `regions` has metadata but no template entry. All pass.
    const errors = validateAgainstSchema('check', {
      name: 'My Check',
      url: 'https://api.example.com',
      method: 'GET',
      id: 'abc-123',
      created_at: '2026-01-01T00:00:00Z',
      regions: ['us-east'],
    });
    expect(errors).toEqual([]);
  });

  it('ignores null values (a null clears rather than mistypes)', () => {
    const errors = validateAgainstSchema('monitor', {
      name: 'My Monitor',
      url: 'https://example.com',
      description: null,
    });
    expect(errors).toEqual([]);
  });

  it('passes a fully valid object', () => {
    const errors = validateAgainstSchema('monitor', {
      name: 'My Monitor',
      url: 'https://example.com',
      interval: '*/5 * * * *',
      timeout_ms: 30000,
      alert_on_failure: true,
      description: '',
      channel_ids: [],
    });
    expect(errors).toEqual([]);
  });

  it('returns no errors for an unknown resource type', () => {
    expect(validateAgainstSchema('nope', { foo: 1 })).toEqual([]);
  });
});
