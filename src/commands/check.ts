import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync } from 'node:fs';
import { IConfigService } from '../interfaces/config.interface.js';
import { IApiClient } from '../interfaces/api-client.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';
import { ApiClient } from '../services/api-client.service.js';
import { createResourceCommand } from './resource-command.factory.js';
import { attachRunsCommand, printExecutionRuns } from './runs-command.js';
import { ApiCheck } from '../types/index.js';
import { collectOptionValues, parseJsonArrayOption } from '../utils/cli-input.js';
import { schemas } from '../utils/schemas.js';
import { buildDefaultCreatePrompts, buildDefaultUpdatePrompts } from '../utils/schema-prompts.js';

/**
 * Option set shared verbatim by `check create` and `check update`, as
 * [flags, description, repeatable?] rows. Rows marked repeatable are
 * registered with the collectOptionValues collector and an empty default,
 * exactly as the previous hand-written chains did. Registration order is
 * the help order — do not reorder.
 */
const CHECK_OPTIONS: ReadonlyArray<readonly [string, string, true?]> = [
  ['-n, --name <name>', 'Check name'],
  ['-d, --description <description>', 'Check description'],
  ['-u, --url <url>', 'API URL'],
  ['-m, --method <method>', 'HTTP Method'],
  ['-i, --interval <interval>', 'Cron expression interval'],
  ['--header <KEY=VALUE>', 'HTTP header to send with the request (repeatable)', true],
  ['--assertion <json>', 'Assertion JSON object (repeatable)', true],
  ['--assertion-file <path>', 'File containing assertions JSON array'],
  ['--status-code <value>', 'Assert status code equals value'],
  ['--status-code-not <value>', 'Assert status code not equals value'],
  ['--response-time-under <ms>', 'Assert response time less than value (ms)'],
  ['--response-time-over <ms>', 'Assert response time greater than value (ms)'],
  ['--json-path <path>', 'JSON path to assert (use with --json-path-value)'],
  ['--json-path-value <value>', 'Expected value for --json-path'],
  ['--text-contains <text>', 'Assert response contains text'],
  ['--text-not-contains <text>', 'Assert response does not contain text'],
  ['--header-exists <name>', 'Assert header exists'],
  ['--regex-match <pattern>', 'Assert response matches regex'],
  ['--body <text>', 'Request body for POST/PUT/PATCH'],
  ['--regions <region>', 'Regions to run in (repeatable)', true],
  ['--retry-count <count>', 'Number of retry attempts on failure'],
  ['--retry-interval <ms>', 'Retry interval in milliseconds'],
  ['--alert-channel-id <id>', 'Attach an alert channel to this check (repeatable)', true],
  ['--no-alerts', 'Disable alerts'],
];

function addCheckOptions(cmd: Command): void {
  for (const [flags, description, repeatable] of CHECK_OPTIONS) {
    if (repeatable) {
      cmd.option(flags, description, collectOptionValues, []);
    } else {
      cmd.option(flags, description);
    }
  }
}

/**
 * Build assertions from short flags, --assertion-file, and --assertion
 */
function buildAssertions(
  options: Record<string, unknown>
): NonNullable<ApiCheck['assertions']> | undefined {
  const assertions: NonNullable<ApiCheck['assertions']> = [];

  // From --assertion-file
  const assertionFile = options['assertion-file'] as string | undefined;
  if (assertionFile) {
    try {
      const fileContent = readFileSync(assertionFile, 'utf-8');
      const fileAssertions = JSON.parse(fileContent);
      if (Array.isArray(fileAssertions)) {
        assertions.push(...fileAssertions);
      }
    } catch (err) {
      throw new Error(`Failed to read assertion-file: ${err}`);
    }
  }

  // From --assertion (raw JSON)
  const rawAssertions = parseJsonArrayOption<NonNullable<ApiCheck['assertions']>[number]>(
    options.assertion as string[] | string | undefined,
    'assertion'
  );
  if (rawAssertions) assertions.push(...rawAssertions);

  // From short flags
  const statusCode = options['status-code'] as string | undefined;
  if (statusCode) {
    assertions.push({ type: 'status_code', operator: 'equals', value: statusCode });
  }

  const statusCodeNot = options['status-code-not'] as string | undefined;
  if (statusCodeNot) {
    assertions.push({ type: 'status_code', operator: 'not_equals', value: statusCodeNot });
  }

  const responseTimeUnder = options['response-time-under'] as string | undefined;
  if (responseTimeUnder) {
    assertions.push({
      type: 'response_time',
      operator: 'less_than',
      value: String(Number.parseInt(responseTimeUnder)),
    });
  }

  const responseTimeOver = options['response-time-over'] as string | undefined;
  if (responseTimeOver) {
    assertions.push({
      type: 'response_time',
      operator: 'greater_than',
      value: String(Number.parseInt(responseTimeOver)),
    });
  }

  const jsonPath = options['json-path'] as string | undefined;
  const jsonPathValue = options['json-path-value'] as string | undefined;
  if (jsonPath && jsonPathValue) {
    assertions.push({
      type: 'json_path',
      operator: 'equals',
      path: jsonPath,
      value: jsonPathValue,
    });
  } else if (jsonPath) {
    assertions.push({ type: 'json_path', operator: 'exists', path: jsonPath, value: '' });
  }

  const textContains = options['text-contains'] as string | undefined;
  if (textContains) {
    assertions.push({ type: 'text_contains', operator: 'contains', value: textContains });
  }

  const textNotContains = options['text-not-contains'] as string | undefined;
  if (textNotContains) {
    assertions.push({ type: 'text_contains', operator: 'not_contains', value: textNotContains });
  }

  const headerExists = options['header-exists'] as string | undefined;
  if (headerExists) {
    assertions.push({ type: 'header', operator: 'exists', path: headerExists, value: '' });
  }

  const regexMatch = options['regex-match'] as string | undefined;
  if (regexMatch) {
    assertions.push({ type: 'text_contains', operator: 'regex_match', value: regexMatch });
  }

  return assertions.length > 0 ? assertions : undefined;
}

/**
 * Factory function to create check command (API Checks)
 */
export function createCheckCommand(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService
): Command {
  const cmd = createResourceCommand<ApiCheck>(configService, apiClient, outputService, {
    resourceName: 'check',
    pluralName: 'API checks',
    description: 'Manage API checks',
    apiMethods: {
      list: () => apiClient.getApiChecks(),
      listWithFilters: (query) => apiClient.listApiChecks(query),
      get: (id) => apiClient.getApiCheck(id),
      create: (data) => apiClient.createApiCheck(data),
      update: (id, data) => apiClient.updateApiCheck(id, data),
      delete: (id) => apiClient.deleteApiCheck(id),
      toggle: (id) => apiClient.toggleApiCheck(id),
    },
    formatters: {
      list: (items, verbose) => outputService.formatApiCheckList(items, verbose),
    },
    createCommandSetup: addCheckOptions,
    updateCommandSetup: addCheckOptions,
    // Most fields are schema-driven; assertions need a composer because they
    // are aggregated from 11 different flags (--assertion, --assertion-file,
    // --status-code, --json-path, etc.) via buildAssertions().
    createPrompts: async (options) => {
      const base = await buildDefaultCreatePrompts<ApiCheck>(schemas.check!)(options);
      const assertions = buildAssertions(options);
      return assertions ? { ...base, assertions } : base;
    },
    updatePrompts: async (id, options, existing) => {
      const base = await buildDefaultUpdatePrompts<ApiCheck>(schemas.check!, outputService)(
        id,
        options,
        existing
      );
      const assertions = buildAssertions(options);
      // Schema default falls through to existing.assertions when no flag is
      // passed; composer only overrides when buildAssertions returns a value.
      return assertions ? { ...base, assertions } : base;
    },
  });

  cmd
    .command('run <id>')
    .description('Trigger a manual run for an API check')
    .action(async (id: string) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const checkId = id.trim();
        if (!checkId) throw new Error('Invalid check ID');

        const result = await (apiClient as ApiClient).runApiCheck(checkId);

        if (isJson) {
          outputService.formatJsonOutput({
            executions: result.executions,
            message: result.message,
          });
          return;
        }

        console.log(chalk.bold(`\n ${result.message}`));
        for (const ex of result.executions) {
          console.log(
            chalk.gray(` Region: ${ex.region}  execution: ${ex.execution_id}  status: ${ex.status}`)
          );
        }
        console.log('');
      } catch (err: unknown) {
        const msg = (err as Error).message || 'Failed to run check';
        if (isJson) {
          outputService.formatJsonOutput({ status: 'ERROR', error: { message: msg } });
        } else {
          console.error(chalk.red(`\n ${msg}\n`));
        }
        process.exit(1);
      }
    });

  attachRunsCommand(cmd, {
    title: 'API Check Runs',
    emptyMessage: 'No API check runs found.',
    description: 'List recent API check executions',
    fetchRuns: (id, limit) => apiClient.getApiCheckRuns(id, limit),
    formatRuns: printExecutionRuns,
    outputService,
  });

  cmd
    .command('toggle-muted <id>')
    .description('Toggle the muted state of an API check')
    .action(async (id: string) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const checkId = id.trim();
        if (!checkId) throw new Error('Invalid check ID');
        const result = await (apiClient as ApiClient).toggleMuteApiCheck(checkId);
        if (isJson) {
          outputService.formatJsonOutput({
            id: checkId,
            alert_on_failure: result.alert_on_failure,
            message: result.message,
          });
          return;
        }
        console.log(chalk.green(`\n ${result.message}\n`));
      } catch (err: unknown) {
        const msg = (err as Error).message || 'Failed to toggle mute';
        if (isJson) {
          outputService.formatJsonOutput({ status: 'ERROR', error: { message: msg } });
        } else {
          console.error(chalk.red(`\n ${msg}\n`));
        }
        process.exit(1);
      }
    });

  cmd.commands
    .find((c) => c.name() === 'create')
    ?.addHelpText(
      'after',
      `
Examples:
  $ obs check create --name "Health API" --url https://api.example.com/health --method GET
  $ obs check create --file check.json
`
    );

  cmd.commands
    .find((c) => c.name() === 'update')
    ?.addHelpText(
      'after',
      `
Examples:
  $ obs check update 42 --method POST --interval "*/10 * * * *"
  $ obs check update 42 --name "Health API v2"
`
    );

  return cmd;
}
