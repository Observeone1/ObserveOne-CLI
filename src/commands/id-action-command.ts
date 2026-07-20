import { Command } from 'commander';
import chalk from 'chalk';
import { IOutputService } from '../interfaces/output.interface.js';

interface ActionErrorOptions {
  isJson: boolean;
  failureMessage: string;
  outputService: IOutputService;
  /**
   * What sits between the leading newline and the message on the text path.
   * Most commands print a bare space; the incident, api-key and suite command
   * groups print `❌ `. Kept as a parameter so extracting this tail could not
   * change any command's output — unifying the two is a separate call.
   */
  errorPrefix?: string;
}

interface IdActionCommandOptions<T> {
  command: string;
  description: string;
  invalidIdMessage: string;
  failureMessage: string;
  outputService: IOutputService;
  action: (id: string) => Promise<T>;
  formatJson: (result: T, id: string) => unknown;
  printResult: (result: T, id: string) => void;
}

interface ToggleMutedCommandOptions {
  description: string;
  invalidIdMessage: string;
  outputService: IOutputService;
  toggle: (id: string) => Promise<{ alert_on_failure: boolean; message: string }>;
}

interface TriggerRunCommandOptions {
  description: string;
  invalidIdMessage: string;
  failureMessage: string;
  outputService: IOutputService;
  trigger: (id: string) => Promise<TriggeredRunResult>;
}

interface TriggeredRunResult {
  executions: { execution_id: number; region: string; status: string }[];
  message: string;
}

/**
 * Attaches a `<verb> <id>` command whose body is the shape shared by run /
 * toggle-muted / reset on every resource: trim and validate the id, call the
 * API, then emit either the JSON payload or the human output, behind a common
 * error tail.
 */
export function attachIdActionCommand<T>(cmd: Command, options: IdActionCommandOptions<T>): void {
  cmd
    .command(options.command)
    .description(options.description)
    .action(async (id: string) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const resourceId = id.trim();
        if (!resourceId) throw new Error(options.invalidIdMessage);

        const result = await options.action(resourceId);

        if (isJson) {
          options.outputService.formatJsonOutput(options.formatJson(result, resourceId));
          return;
        }

        options.printResult(result, resourceId);
      } catch (err: unknown) {
        reportActionError(err, { ...options, isJson });
      }
    });
}

/** `toggle-muted <id>`, identical on url monitors, API checks, protocol monitors and heartbeats. */
export function attachToggleMutedCommand(cmd: Command, options: ToggleMutedCommandOptions): void {
  attachIdActionCommand(cmd, {
    command: 'toggle-muted <id>',
    description: options.description,
    invalidIdMessage: options.invalidIdMessage,
    failureMessage: 'Failed to toggle mute',
    outputService: options.outputService,
    action: options.toggle,
    formatJson: (result, id) => ({
      id,
      alert_on_failure: result.alert_on_failure,
      message: result.message,
    }),
    printResult: (result) => {
      console.log(chalk.green(`\n ${result.message}\n`));
    },
  });
}

/** `run <id>`, identical on url monitors, API checks and protocol monitors. */
export function attachTriggerRunCommand(cmd: Command, options: TriggerRunCommandOptions): void {
  attachIdActionCommand(cmd, {
    command: 'run <id>',
    description: options.description,
    invalidIdMessage: options.invalidIdMessage,
    failureMessage: options.failureMessage,
    outputService: options.outputService,
    action: options.trigger,
    formatJson: (result) => ({
      executions: result.executions,
      message: result.message,
    }),
    printResult: (result) => {
      console.log(chalk.bold(`\n ${result.message}`));
      for (const ex of result.executions) {
        console.log(
          chalk.gray(` Region: ${ex.region}  execution: ${ex.execution_id}  status: ${ex.status}`)
        );
      }
      console.log('');
    },
  });
}

/**
 * The error tail every id-scoped command action shares: the message goes out as
 * a JSON envelope under `--json` and as red text otherwise, then the process
 * exits non-zero.
 */
export function reportActionError(err: unknown, options: ActionErrorOptions): void {
  const msg = (err as Error).message || options.failureMessage;
  if (options.isJson) {
    options.outputService.formatJsonOutput({ status: 'ERROR', error: { message: msg } });
  } else {
    console.error(chalk.red(`\n${options.errorPrefix ?? ' '}${msg}\n`));
  }
  process.exit(1);
}
