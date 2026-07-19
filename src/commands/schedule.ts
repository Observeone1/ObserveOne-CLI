import { Command } from 'commander';
import chalk from 'chalk';
import { IConfigService } from '../interfaces/config.interface.js';
import { IApiClient } from '../interfaces/api-client.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';
import { CreateSchedulePayload, Schedule } from '../types/index.js';
import { collectOptionValues, parseIdsFromText } from '../utils/cli-input.js';

type Options = Record<string, unknown>;

const BULK_ACTIONS = ['stop', 'resume'] as const;
type BulkAction = (typeof BULK_ACTIONS)[number];

/** Read all of stdin as a string. Resolves '' immediately when stdin is a TTY. */
function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(data));
  });
}

const toInt = (val: unknown): number | undefined => {
  if (typeof val !== 'string' && typeof val !== 'number') return undefined;
  const n = Number.parseInt(String(val), 10);
  return Number.isNaN(n) ? undefined : n;
};

/** Commander string flags arrive as strings; guard before stringifying so objects never leak "[object Object]". */
const asFlagString = (val: unknown): string => {
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  return '';
};

/**
 * `obs schedule` — manage autopilot test schedules (cron schedules that run a
 * specific autopilot test). Includes a chainable `bulk` action so a list of
 * schedule IDs can be piped in:
 *   obs schedule list --json | jq -r '.data[].id' | obs schedule bulk stop --stdin
 */
export function createScheduleCommand(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService
): Command {
  const cmd = new Command('schedule').description('Manage autopilot test schedules').alias('sched');

  const isJsonMode = (opts: Options): boolean =>
    process.env.OBS_JSON_OUTPUT === 'true' || opts.json === true || opts.output === 'json';

  const requireAuth = (isJson: boolean): void => {
    if (isJson) outputService.enableJsonMode();
    if (!configService.getApiKey()) {
      outputService.error(
        'Not authenticated. Run "obs login", or set OBS_API_KEY (get a key at https://app.observeone.com/settings/api).'
      );
      process.exit(1);
    }
  };

  const fail = (isJson: boolean, msg: string): never => {
    if (isJson) {
      outputService.formatJsonOutput({ status: 'ERROR', error: { message: msg } });
    } else {
      console.error(chalk.red(`\n ${msg}\n`));
    }
    process.exit(1);
  };

  // LIST
  cmd
    .command('list')
    .description('List schedules (optionally for a single test)')
    .option('--test-id <id>', 'Only list schedules for this autopilot test')
    .option('-o, --output <format>', 'Output format (table, json)', 'table')
    .option('-j, --json', 'Output in JSON format')
    .action(async (opts: Options) => {
      const isJson = isJsonMode(opts);
      requireAuth(isJson);
      try {
        outputService.progress('Fetching schedules...');
        const schedules = opts.testId
          ? await apiClient.getTestSchedules(asFlagString(opts.testId))
          : await apiClient.getSchedules();
        if (isJson) outputService.formatJsonOutput(schedules);
        else outputService.formatScheduleList(schedules, process.env.OBS_VERBOSE === 'true');
      } catch (error: unknown) {
        fail(isJson, outputService.formatError(error));
      }
    });

  // GET
  cmd
    .command('get <id>')
    .description('Get details of a schedule')
    .option('-j, --json', 'Output in JSON format')
    .action(async (id: string, opts: Options) => {
      const isJson = isJsonMode(opts);
      requireAuth(isJson);
      try {
        const schedule = await apiClient.getSchedule(id.trim());
        if (isJson) outputService.formatJsonOutput(schedule);
        else outputService.formatScheduleList([schedule], true);
      } catch (error: unknown) {
        fail(isJson, outputService.formatError(error));
      }
    });

  // CREATE
  cmd
    .command('create')
    .description('Create a schedule for an autopilot test')
    .requiredOption('--test-id <id>', 'Autopilot test ID to schedule')
    .requiredOption('-i, --interval <cron>', 'Cron expression schedule')
    .option('--retry-count <n>', 'Number of retries on failure')
    .option('--retry-interval <seconds>', 'Seconds between retries')
    .option('--no-alerts', 'Disable alerts on failure')
    .option('-j, --json', 'Output in JSON format')
    .action(async (opts: Options) => {
      const isJson = isJsonMode(opts);
      requireAuth(isJson);
      try {
        const payload: CreateSchedulePayload = {
          testId: String(opts.testId),
          cronExpression: String(opts.interval),
          alertOnFailure: opts.alerts !== false,
        };
        const retryCount = toInt(opts.retryCount);
        if (retryCount !== undefined) payload.retryCount = retryCount;
        const retryInterval = toInt(opts.retryInterval);
        if (retryInterval !== undefined) payload.retryInterval = retryInterval;

        const schedule = await apiClient.createSchedule(payload);
        if (isJson) outputService.formatJsonOutput(schedule);
        else outputService.success(`Schedule created (ID: ${schedule.id}).`);
      } catch (error: unknown) {
        fail(isJson, outputService.formatError(error));
      }
    });

  // UPDATE
  cmd
    .command('update <id>')
    .description('Update a schedule (use stop/resume to pause/activate)')
    .option('-i, --interval <cron>', 'Cron expression schedule')
    .option('--retry-count <n>', 'Number of retries on failure')
    .option('--retry-interval <seconds>', 'Seconds between retries')
    .option('--enable-alerts', 'Enable alerts on failure')
    .option('--disable-alerts', 'Disable alerts on failure')
    .option('-j, --json', 'Output in JSON format')
    .action(async (id: string, opts: Options) => {
      const isJson = isJsonMode(opts);
      requireAuth(isJson);
      try {
        if (opts.enableAlerts && opts.disableAlerts) {
          throw new Error('Pass only one of --enable-alerts / --disable-alerts.');
        }
        const updates: Partial<Schedule> = {};
        if (opts.interval !== undefined) updates.cron_expression = asFlagString(opts.interval);
        const retryCount = toInt(opts.retryCount);
        if (retryCount !== undefined) updates.retry_count = retryCount;
        const retryInterval = toInt(opts.retryInterval);
        if (retryInterval !== undefined) updates.retry_interval = retryInterval;
        if (opts.enableAlerts) updates.alert_on_failure = true;
        if (opts.disableAlerts) updates.alert_on_failure = false;

        if (Object.keys(updates).length === 0) {
          throw new Error(
            'Provide at least one field to update (--interval, --retry-count, --retry-interval, --enable-alerts, --disable-alerts).'
          );
        }

        const schedule = await apiClient.updateSchedule(id.trim(), updates);
        if (isJson) outputService.formatJsonOutput(schedule);
        else outputService.success(`Schedule ${id.trim()} updated.`);
      } catch (error: unknown) {
        fail(isJson, outputService.formatError(error));
      }
    });

  // DELETE
  cmd
    .command('delete <id>')
    .description('Delete a schedule')
    .option('-j, --json', 'Output in JSON format')
    .action(async (id: string, opts: Options) => {
      const isJson = isJsonMode(opts);
      requireAuth(isJson);
      try {
        await apiClient.deleteSchedule(id.trim());
        if (isJson) outputService.formatJsonOutput({ success: true, id: id.trim() });
        else outputService.success(`Schedule ${id.trim()} deleted.`);
      } catch (error: unknown) {
        fail(isJson, outputService.formatError(error));
      }
    });

  // STOP / RESUME (single)
  const singleAction = (name: BulkAction) => {
    cmd
      .command(`${name} <id>`)
      .description(`${name === 'stop' ? 'Pause' : 'Activate'} a schedule`)
      .option('-j, --json', 'Output in JSON format')
      .action(async (id: string, opts: Options) => {
        const isJson = isJsonMode(opts);
        requireAuth(isJson);
        try {
          const result =
            name === 'stop'
              ? await apiClient.stopSchedule(id.trim())
              : await apiClient.resumeSchedule(id.trim());
          if (isJson) outputService.formatJsonOutput({ id: id.trim(), ...result });
          else outputService.success(result.message || `Schedule ${id.trim()} ${name}ped.`);
        } catch (error: unknown) {
          fail(isJson, outputService.formatError(error));
        }
      });
  };
  singleAction('stop');
  singleAction('resume');

  // STOP-ALL / RESUME-ALL
  cmd
    .command('stop-all')
    .description('Pause all of your schedules')
    .option('-j, --json', 'Output in JSON format')
    .action(async (opts: Options) => {
      const isJson = isJsonMode(opts);
      requireAuth(isJson);
      try {
        const result = await apiClient.stopAllSchedules();
        if (isJson) outputService.formatJsonOutput(result);
        else outputService.success(result.message || 'All schedules stopped.');
      } catch (error: unknown) {
        fail(isJson, outputService.formatError(error));
      }
    });

  cmd
    .command('resume-all')
    .description('Activate all of your schedules')
    .option('-j, --json', 'Output in JSON format')
    .action(async (opts: Options) => {
      const isJson = isJsonMode(opts);
      requireAuth(isJson);
      try {
        const result = await apiClient.resumeAllSchedules();
        if (isJson) outputService.formatJsonOutput(result);
        else outputService.success(result.message || 'All schedules resumed.');
      } catch (error: unknown) {
        fail(isJson, outputService.formatError(error));
      }
    });

  // BULK <stop|resume> — chainable over a list of IDs from --id and/or stdin
  cmd
    .command('bulk <action>')
    .description('Apply stop|resume to many schedules by ID (from --id and/or piped stdin)')
    .option('--id <id>', 'Schedule ID to act on (repeatable)', collectOptionValues, [])
    .option('--stdin', 'Read whitespace- or JSON-array-separated IDs from stdin')
    .option('-j, --json', 'Output in JSON format')
    .action(async (action: string, opts: Options) => {
      const isJson = isJsonMode(opts);
      requireAuth(isJson);
      try {
        if (!BULK_ACTIONS.includes(action as BulkAction)) {
          throw new Error(
            `Invalid bulk action "${action}". Expected one of: ${BULK_ACTIONS.join(', ')}`
          );
        }
        const flagIds = (opts.id as string[]) ?? [];
        // Read stdin only when explicitly requested. Auto-reading on a non-TTY
        // would hang whenever stdin is an open pipe with no data (CI, spawn
        // without a closed stdin), so piping must opt in with --stdin.
        const stdinIds = opts.stdin === true ? parseIdsFromText(await readStdin()) : [];

        const seen = new Set<string>();
        const ids: string[] = [];
        for (const raw of [...flagIds, ...stdinIds]) {
          const id = raw.trim();
          if (id && !seen.has(id)) {
            seen.add(id);
            ids.push(id);
          }
        }

        if (ids.length === 0) {
          throw new Error(
            'No schedule IDs provided. Use --id <id> (repeatable) or pipe IDs via --stdin.'
          );
        }

        const act = (id: string) =>
          action === 'stop' ? apiClient.stopSchedule(id) : apiClient.resumeSchedule(id);

        const results: { id: string; success: boolean; error?: string }[] = [];
        for (const id of ids) {
          try {
            await act(id);
            results.push({ id, success: true });
            if (!isJson) outputService.success(`${action}ped ${id}`);
          } catch (error: unknown) {
            const message = outputService.formatError(error);
            results.push({ id, success: false, error: message });
            if (!isJson) console.error(chalk.red(`  ✗ ${id}: ${message}`));
          }
        }

        const succeeded = results.filter((r) => r.success).length;
        const failed = results.length - succeeded;

        if (isJson) {
          outputService.formatJsonOutput({ action, succeeded, failed, results });
        } else {
          console.log(chalk.bold(`\n Bulk ${action}: ${succeeded} succeeded, ${failed} failed.\n`));
        }
        // Non-zero exit if any failed, so pipelines can detect partial failure.
        if (failed > 0) process.exit(1);
      } catch (error: unknown) {
        fail(isJson, outputService.formatError(error));
      }
    });

  cmd.commands
    .find((c) => c.name() === 'bulk')
    ?.addHelpText(
      'after',
      `
Examples:
  $ obs schedule bulk stop --id abc --id def
  $ obs schedule list --json | jq -r '.data[].id' | obs schedule bulk stop --stdin
  $ obs schedule list --test-id <t> --json | jq -r '.data[].id' | obs schedule bulk resume --stdin
`
    );

  return cmd;
}
