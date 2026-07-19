import { describe, it, expect } from 'vitest';
import { planPushDecision } from '../../../commands/suite/push.js';

describe('planPushDecision', () => {
  it('does not push when there is no local PLAN.md', () => {
    expect(planPushDecision(null, 'remote plan')).toEqual({
      shouldPush: false,
      reason: 'missing',
    });
  });

  it('does not push when the local PLAN.md is blank', () => {
    expect(planPushDecision('   \n  ', 'remote plan')).toEqual({
      shouldPush: false,
      reason: 'blank',
    });
  });

  it('does not push when local and remote are identical', () => {
    expect(planPushDecision('# Plan\nSame content', '# Plan\nSame content')).toEqual({
      shouldPush: false,
      reason: 'unchanged',
    });
  });

  it('ignores a trailing-newline-only difference (editor artifact, not a real edit)', () => {
    expect(planPushDecision('# Plan\nSame content\n', '# Plan\nSame content')).toEqual({
      shouldPush: false,
      reason: 'unchanged',
    });
  });

  it('ignores leading/trailing whitespace differences on both sides', () => {
    expect(planPushDecision('  # Plan\nSame  ', '# Plan\nSame')).toEqual({
      shouldPush: false,
      reason: 'unchanged',
    });
  });

  it('pushes when local content differs from remote', () => {
    expect(planPushDecision('# Plan\nEdited content', '# Plan\nOriginal content')).toEqual({
      shouldPush: true,
      reason: 'changed',
    });
  });

  it('pushes when remote has no plan yet but local does', () => {
    expect(planPushDecision('# Plan\nNew content', null)).toEqual({
      shouldPush: true,
      reason: 'changed',
    });
  });
});
