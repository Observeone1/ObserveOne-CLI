import { describe, it, expect } from 'vitest';
import { mapSuiteCiIntegration } from '../../utils/suite-ci-mapper.js';

describe('mapSuiteCiIntegration', () => {
  it('returns null for null input', () => {
    expect(mapSuiteCiIntegration(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(mapSuiteCiIntegration(undefined)).toBeNull();
  });

  it('returns null for non-object input (string, number, array)', () => {
    expect(mapSuiteCiIntegration('not an object')).toBeNull();
    expect(mapSuiteCiIntegration(42)).toBeNull();
  });

  it('returns null for empty string (backend returns null when no integration)', () => {
    expect(mapSuiteCiIntegration('')).toBeNull();
  });

  it('strips backend-only sensitive fields (access_token, webhook_secret, user_id)', () => {
    const raw = {
      id: 1,
      suite_id: 'suite-123',
      user_id: 'user-secret-id',
      access_token: 'gho_supersecrettoken',
      webhook_secret: 'whsec_supersecret',
      provider: 'github',
      repo_identifier: 'acme/site',
      branch: 'main',
      comment_on_pr: true,
      set_status_check: true,
      check_name: 'observeone',
      wait_for_ci: false,
      inbound_webhook_token: 'whsec_abcdef0123456789',
      github_installation_id: 12345,
      github_hook_id: 999,
      last_triggered_at: '2026-04-25T14:32:11Z',
      created_at: '2026-04-01T00:00:00Z',
      updated_at: '2026-04-25T14:32:11Z',
    };
    const mapped = mapSuiteCiIntegration(raw);
    expect(mapped).not.toBeNull();
    // Sensitive fields must NOT appear on the mapped object
    expect(mapped).not.toHaveProperty('access_token');
    expect(mapped).not.toHaveProperty('webhook_secret');
    expect(mapped).not.toHaveProperty('user_id');
    expect(mapped).not.toHaveProperty('inbound_webhook_token');
    expect(mapped).not.toHaveProperty('github_hook_id');
  });

  it('reduces inbound_webhook_token to its last 4 chars', () => {
    const raw = {
      id: 1,
      suite_id: 'suite-123',
      inbound_webhook_token: 'whsec_abcdef0123456789a3f1',
    };
    const mapped = mapSuiteCiIntegration(raw);
    expect(mapped?.inbound_webhook_token_last4).toBe('a3f1');
  });

  it('handles short tokens (returns the whole thing if <=4 chars)', () => {
    const raw = { id: 1, suite_id: 'x', inbound_webhook_token: 'ab' };
    const mapped = mapSuiteCiIntegration(raw);
    expect(mapped?.inbound_webhook_token_last4).toBe('ab');
  });

  it('returns null for inbound_webhook_token_last4 when token is missing', () => {
    const raw = { id: 1, suite_id: 'x' };
    const mapped = mapSuiteCiIntegration(raw);
    expect(mapped?.inbound_webhook_token_last4).toBeNull();
  });

  it('returns null for inbound_webhook_token_last4 when token is null', () => {
    const raw = { id: 1, suite_id: 'x', inbound_webhook_token: null };
    const mapped = mapSuiteCiIntegration(raw);
    expect(mapped?.inbound_webhook_token_last4).toBeNull();
  });

  it('coerces missing string fields to empty strings (defensive)', () => {
    const raw = { id: 1, suite_id: 'x' };
    const mapped = mapSuiteCiIntegration(raw);
    expect(mapped?.provider).toBe('');
    expect(mapped?.repo_identifier).toBe('');
    expect(mapped?.branch).toBe('');
    expect(mapped?.check_name).toBe('');
  });

  it('coerces missing booleans to false', () => {
    const raw = { id: 1, suite_id: 'x' };
    const mapped = mapSuiteCiIntegration(raw);
    expect(mapped?.comment_on_pr).toBe(false);
    expect(mapped?.set_status_check).toBe(false);
    expect(mapped?.wait_for_ci).toBe(false);
  });

  it('returns null for github_installation_id when not a number', () => {
    expect(
      mapSuiteCiIntegration({ id: 1, suite_id: 'x', github_installation_id: null })
        ?.github_installation_id
    ).toBeNull();
    expect(
      mapSuiteCiIntegration({ id: 1, suite_id: 'x', github_installation_id: 'oops' })
        ?.github_installation_id
    ).toBeNull();
    expect(mapSuiteCiIntegration({ id: 1, suite_id: 'x' })?.github_installation_id).toBeNull();
  });

  it('preserves a valid github_installation_id number', () => {
    const mapped = mapSuiteCiIntegration({
      id: 1,
      suite_id: 'x',
      github_installation_id: 98765,
    });
    expect(mapped?.github_installation_id).toBe(98765);
  });

  it('preserves last_triggered_at string and nulls non-string', () => {
    expect(
      mapSuiteCiIntegration({
        id: 1,
        suite_id: 'x',
        last_triggered_at: '2026-04-25T14:32:11Z',
      })?.last_triggered_at
    ).toBe('2026-04-25T14:32:11Z');
    expect(
      mapSuiteCiIntegration({ id: 1, suite_id: 'x', last_triggered_at: null })?.last_triggered_at
    ).toBeNull();
    expect(mapSuiteCiIntegration({ id: 1, suite_id: 'x' })?.last_triggered_at).toBeNull();
  });

  it('round-trips a realistic full backend response correctly', () => {
    const raw = {
      id: 42,
      suite_id: 'suite-abc',
      user_id: 'user-xyz',
      provider: 'github',
      repo_identifier: 'acme/marketing-site',
      access_token: 'gho_DROP_ME',
      webhook_secret: 'DROP_ME',
      comment_on_pr: true,
      set_status_check: true,
      check_name: 'observeone/playwright',
      branch: 'main',
      wait_for_ci: true,
      inbound_webhook_token: 'whsec_a1b2c3d4e5f6g7h8i9j0',
      github_installation_id: 123456,
      github_hook_id: 7890,
      last_triggered_at: '2026-04-25T14:32:11.000Z',
      created_at: '2026-03-15T09:00:00.000Z',
      updated_at: '2026-04-25T14:32:11.000Z',
    };
    expect(mapSuiteCiIntegration(raw)).toEqual({
      id: 42,
      suite_id: 'suite-abc',
      provider: 'github',
      repo_identifier: 'acme/marketing-site',
      branch: 'main',
      comment_on_pr: true,
      set_status_check: true,
      check_name: 'observeone/playwright',
      wait_for_ci: true,
      inbound_webhook_token_last4: 'i9j0',
      github_installation_id: 123456,
      last_triggered_at: '2026-04-25T14:32:11.000Z',
      created_at: '2026-03-15T09:00:00.000Z',
      updated_at: '2026-04-25T14:32:11.000Z',
    });
  });
});
