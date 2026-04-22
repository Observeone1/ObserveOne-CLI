import { Command } from 'commander';
import { ListQueryOptions, PaginationMeta } from '../types/index.js';

const parsePositiveInt = (value: string, flagName: string): number => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${flagName} must be a positive integer`);
  }
  return parsed;
};

const parseBoolean = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  throw new Error('--is-active must be true or false');
};

export const addListQueryOptions = (cmd: Command): Command =>
  cmd
    .option('-s, --search <query>', 'Filter by search text')
    .option('-S, --status <status>', 'Filter by resource status')
    .option('--is-active <true|false>', 'Filter by active lifecycle state', parseBoolean)
    .option('-l, --limit <limit>', 'Max results per page', (value) =>
      parsePositiveInt(value, '--limit')
    )
    .option('-p, --page <page>', 'Page number (1-based)', (value) =>
      parsePositiveInt(value, '--page')
    );

export const resolveListQueryOptions = (options: Record<string, unknown>): ListQueryOptions => ({
  search:
    typeof options.search === 'string' && options.search.trim() ? options.search.trim() : undefined,
  status:
    typeof options.status === 'string' && options.status.trim()
      ? options.status.trim().toLowerCase()
      : undefined,
  is_active: typeof options.isActive === 'boolean' ? options.isActive : undefined,
  limit: typeof options.limit === 'number' ? options.limit : undefined,
  page: typeof options.page === 'number' ? options.page : undefined,
});

export const formatPaginationSummary = (pagination: PaginationMeta, shownCount: number): string =>
  `Page ${pagination.page}/${pagination.totalPages || 0} • ${shownCount}/${pagination.total} shown • limit ${pagination.limit}`;
