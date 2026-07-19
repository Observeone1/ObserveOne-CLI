import { describe, it, expect } from 'vitest';
import { planPushDecision } from '../../../commands/suite/push.js';

describe('planPushDecision', () => {
  it.each<{
    label: string;
    local: string | null;
    remote: string | null;
    shouldPush: boolean;
    reason: 'missing' | 'blank' | 'unchanged' | 'changed';
  }>([
    {
      label: 'does not push when there is no local PLAN.md',
      local: null,
      remote: 'remote plan',
      shouldPush: false,
      reason: 'missing',
    },
    {
      label: 'does not push when the local PLAN.md is blank',
      local: '   \n  ',
      remote: 'remote plan',
      shouldPush: false,
      reason: 'blank',
    },
    {
      label: 'does not push when local and remote are identical',
      local: '# Plan\nSame content',
      remote: '# Plan\nSame content',
      shouldPush: false,
      reason: 'unchanged',
    },
    {
      label: 'ignores a trailing-newline-only difference (editor artifact, not a real edit)',
      local: '# Plan\nSame content\n',
      remote: '# Plan\nSame content',
      shouldPush: false,
      reason: 'unchanged',
    },
    {
      label: 'ignores leading/trailing whitespace differences on both sides',
      local: '  # Plan\nSame  ',
      remote: '# Plan\nSame',
      shouldPush: false,
      reason: 'unchanged',
    },
    {
      label: 'pushes when local content differs from remote',
      local: '# Plan\nEdited content',
      remote: '# Plan\nOriginal content',
      shouldPush: true,
      reason: 'changed',
    },
    {
      label: 'pushes when remote has no plan yet but local does',
      local: '# Plan\nNew content',
      remote: null,
      shouldPush: true,
      reason: 'changed',
    },
  ])('$label', ({ local, remote, shouldPush, reason }) => {
    expect(planPushDecision(local, remote)).toEqual({ shouldPush, reason });
  });
});
