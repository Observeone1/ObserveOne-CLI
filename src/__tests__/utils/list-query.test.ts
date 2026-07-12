import { describe, it, expect } from 'vitest';
import { Command } from 'commander';
import {
  addListQueryOptions,
  resolveListQueryOptions,
  formatPaginationSummary,
} from '../../utils/list-query.js';

describe('addListQueryOptions', () => {
  it('registers the search/status/is-active/limit/page flags on the command', () => {
    const cmd = addListQueryOptions(new Command('list'));
    const flagNames = cmd.options.map((o) => o.long);

    expect(flagNames).toEqual(
      expect.arrayContaining(['--search', '--status', '--is-active', '--limit', '--page'])
    );
  });

  it('parses --is-active true/false via the boolean coercer', () => {
    const cmd = addListQueryOptions(new Command('list')).action(() => {});
    cmd.parse(['node', 'list', '--is-active', 'true'], { from: 'user' });
    expect(cmd.opts().isActive).toBe(true);

    const cmd2 = addListQueryOptions(new Command('list')).action(() => {});
    cmd2.parse(['node', 'list', '--is-active', 'FALSE'], { from: 'user' });
    expect(cmd2.opts().isActive).toBe(false);
  });

  it('rejects an invalid --is-active value', () => {
    const cmd = addListQueryOptions(new Command('list'))
      .exitOverride()
      .action(() => {});
    expect(() => cmd.parse(['node', 'list', '--is-active', 'maybe'], { from: 'user' })).toThrow();
  });

  it('rejects a non-positive --limit value', () => {
    const cmd = addListQueryOptions(new Command('list'))
      .exitOverride()
      .action(() => {});
    expect(() => cmd.parse(['node', 'list', '--limit', '0'], { from: 'user' })).toThrow();
  });

  it('parses a valid --page value to a number', () => {
    const cmd = addListQueryOptions(new Command('list')).action(() => {});
    cmd.parse(['node', 'list', '--page', '3'], { from: 'user' });
    expect(cmd.opts().page).toBe(3);
  });
});

describe('resolveListQueryOptions', () => {
  it('trims and lowercases search/status, leaves other fields alone', () => {
    const result = resolveListQueryOptions({
      search: '  my query  ',
      status: '  UP  ',
      isActive: true,
      limit: 10,
      page: 2,
    });

    expect(result).toEqual({
      search: 'my query',
      status: 'up',
      is_active: true,
      limit: 10,
      page: 2,
    });
  });

  it('treats blank-string search/status as absent', () => {
    const result = resolveListQueryOptions({ search: '   ', status: '' });
    expect(result.search).toBeUndefined();
    expect(result.status).toBeUndefined();
  });

  it('leaves fields undefined when omitted or wrong-typed', () => {
    const result = resolveListQueryOptions({});
    expect(result).toEqual({
      search: undefined,
      status: undefined,
      is_active: undefined,
      limit: undefined,
      page: undefined,
    });
  });

  it('ignores a non-boolean isActive and non-number limit/page', () => {
    const result = resolveListQueryOptions({ isActive: 'true', limit: '10', page: '2' });
    expect(result.is_active).toBeUndefined();
    expect(result.limit).toBeUndefined();
    expect(result.page).toBeUndefined();
  });
});

describe('formatPaginationSummary', () => {
  it('renders page/total/shown/limit', () => {
    const summary = formatPaginationSummary({ page: 2, totalPages: 5, total: 42, limit: 10 }, 10);
    expect(summary).toBe('Page 2/5 • 10/42 shown • limit 10');
  });

  it('falls back to 0 total pages when missing/zero', () => {
    const summary = formatPaginationSummary({ page: 1, totalPages: 0, total: 0, limit: 10 }, 0);
    expect(summary).toBe('Page 1/0 • 0/0 shown • limit 10');
  });
});
