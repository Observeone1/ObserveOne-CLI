import { describe, it, expect } from 'vitest';
import { partitionVarFlags } from '../../../commands/suite/vars.js';

describe('partitionVarFlags', () => {
  it('resolves inline KEY=VALUE flags', () => {
    const { resolved, needsPrompt } = partitionVarFlags(['REGION=us-east', 'TIER=pro']);
    expect(resolved).toEqual({ REGION: 'us-east', TIER: 'pro' });
    expect(needsPrompt).toEqual([]);
  });

  it('routes bare KEY (no =value) to needsPrompt instead of resolving it', () => {
    const { resolved, needsPrompt } = partitionVarFlags(['API_TOKEN']);
    expect(resolved).toEqual({});
    expect(needsPrompt).toEqual(['API_TOKEN']);
  });

  it('distinguishes bare KEY from KEY= (explicit empty value)', () => {
    const { resolved, needsPrompt } = partitionVarFlags(['BARE', 'EMPTY=']);
    // KEY= is an explicit empty value, NOT a prompt request
    expect(resolved).toEqual({ EMPTY: '' });
    expect(needsPrompt).toEqual(['BARE']);
  });

  it('normalizes keys (uppercase, spaces -> underscore) for both branches', () => {
    const { resolved, needsPrompt } = partitionVarFlags(['db host=localhost', 'api token']);
    expect(resolved).toEqual({ DB_HOST: 'localhost' });
    expect(needsPrompt).toEqual(['API_TOKEN']);
  });

  it('preserves = and whitespace inside the value', () => {
    const { resolved } = partitionVarFlags(['CONN=user=admin;pwd= secret ']);
    expect(resolved).toEqual({ CONN: 'user=admin;pwd= secret ' });
  });

  it('de-duplicates repeated bare keys', () => {
    const { needsPrompt } = partitionVarFlags(['TOKEN', 'token']);
    expect(needsPrompt).toEqual(['TOKEN']);
  });

  it('throws when a key is empty', () => {
    expect(() => partitionVarFlags([''])).toThrow(/Key cannot be empty/);
    expect(() => partitionVarFlags(['=value'])).toThrow(/Key cannot be empty/);
  });

  it('returns empty partitions for no flags', () => {
    expect(partitionVarFlags([])).toEqual({ resolved: {}, needsPrompt: [] });
  });
});
