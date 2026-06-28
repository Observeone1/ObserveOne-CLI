import { describe, it, expect } from 'vitest';
import { likelyRenameWarning } from '../../commands/apply.js';

describe('likelyRenameWarning', () => {
  it('returns null when there are no existing resources of the type', () => {
    expect(likelyRenameWarning('monitor', 'New Monitor', [])).toBeNull();
  });

  it('warns and lists existing names when a create has no name match', () => {
    const msg = likelyRenameWarning('monitor', 'Renamed Monitor', [
      'Old Monitor',
      'Another Monitor',
    ]);
    expect(msg).not.toBeNull();
    expect(msg).toContain('Renamed Monitor');
    expect(msg).toContain('Old Monitor');
    expect(msg).toContain('Another Monitor');
    // Flags the rename/orphan risk so the operator can react.
    expect(msg!.toLowerCase()).toContain('rename');
  });

  it('uses the supplied resource kind label in the message', () => {
    const msg = likelyRenameWarning('status page', 'new-slug', ['old-slug']);
    expect(msg).toContain('status page');
    expect(msg).toContain('new-slug');
    expect(msg).toContain('old-slug');
  });
});
