import { Command } from 'commander';
import chalk from 'chalk';
import { IOutputService } from '../interfaces/output.interface.js';
import { HeartbeatPing, ResourceRun } from '../types/index.js';
import { brand as c } from '../utils/theme.js';

interface RunsCommandOptions<T> {
  title: string;
  emptyMessage: string;
  description: string;
  fetchRuns: (id: number, limit: number) => Promise<T[]>;
  formatRuns: (runs: T[]) => void;
  outputService: IOutputService;
}

export function attachRunsCommand<T>(cmd: Command, options: RunsCommandOptions<T>): void {
  cmd
    .command('runs <id>')
    .description(options.description)
    .option('-l, --limit <n>', 'Maximum runs to fetch', '20')
    .action(async (id: string, commandOptions: { limit?: string }) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';

      try {
        const resourceId = parseNumericId(id, 'resource');
        const limit = parsePositiveInteger(commandOptions.limit, 'limit');
        const runs = await options.fetchRuns(resourceId, limit);

        if (isJson) {
          options.outputService.formatJsonOutput({ runs });
          return;
        }

        if (runs.length === 0) {
          options.outputService.info(options.emptyMessage);
          return;
        }

        console.log(chalk.bold(`\n${options.title}`));
        console.log(c.muted('─'.repeat(80)));
        options.formatRuns(runs);
        console.log('');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch runs';
        if (isJson) {
          options.outputService.error(message);
        } else {
          console.error(chalk.red(`\n${message}\n`));
        }
        process.exit(1);
      }
    });
}

export function printExecutionRuns(runs: ResourceRun[]): void {
  runs.forEach((run, index) => {
    const status = formatStatus(run.status);
    console.log(chalk.bold(`${index + 1}. #${run.id} [${status}]`));
    if (run.region) console.log(c.muted(`   Region: ${run.region}`));
    if (run.start_time)
      console.log(c.muted(`   Started: ${new Date(run.start_time).toLocaleString()}`));
    if (run.end_time) console.log(c.muted(`   Ended: ${new Date(run.end_time).toLocaleString()}`));
    if (run.response_status !== undefined && run.response_status !== null) {
      console.log(c.muted(`   HTTP: ${run.response_status}`));
    }
    if (run.response_time_ms !== undefined && run.response_time_ms !== null) {
      console.log(c.muted(`   Duration: ${run.response_time_ms}ms`));
    }
    if (run.error_message) console.log(c.error(`   Error: ${run.error_message}`));
    console.log('');
  });
}

export function printHeartbeatRuns(runs: HeartbeatPing[]): void {
  runs.forEach((run, index) => {
    const status = run.is_late ? c.warning('LATE') : c.success('ON_TIME');
    console.log(chalk.bold(`${index + 1}. #${run.id} [${status}]`));
    console.log(c.muted(`   Pinged: ${new Date(run.pinged_at).toLocaleString()}`));
    if (run.duration !== undefined && run.duration !== null) {
      console.log(c.muted(`   Duration: ${run.duration}ms`));
    }
    console.log('');
  });
}

function parseNumericId(value: string, label: string): number {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid ${label} ID`);
  }
  return parsed;
}

function parsePositiveInteger(value: string | undefined, label: string): number {
  const parsed = parseInt(value || '20', 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}

function formatStatus(status: string): string {
  const normalized = status.toUpperCase();
  if (normalized === 'SUCCESS' || normalized === 'UP') return c.success(normalized);
  if (normalized === 'FAILED' || normalized === 'DOWN') return c.error(normalized);
  if (normalized === 'PENDING' || normalized === 'RUNNING') return c.warning(normalized);
  return c.accent(normalized);
}
