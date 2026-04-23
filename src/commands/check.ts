import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { readFileSync } from 'fs';
import { IConfigService } from '../interfaces/config.interface.js';
import { IApiClient } from '../interfaces/api-client.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';
import { ApiClient } from '../services/api-client.service.js';
import { createResourceCommand } from './resource-command.factory.js';
import { attachRunsCommand, printExecutionRuns } from './runs-command.js';
import { ApiCheck } from '../types/index.js';
import {
  collectOptionValues,
  parseJsonArrayOption,
  parseKeyValuePairs,
  parseNumericIds,
} from '../utils/cli-input.js';

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
      value: String(parseInt(responseTimeUnder)),
    });
  }

  const responseTimeOver = options['response-time-over'] as string | undefined;
  if (responseTimeOver) {
    assertions.push({
      type: 'response_time',
      operator: 'greater_than',
      value: String(parseInt(responseTimeOver)),
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
    createCommandSetup: (cmd) => {
      cmd
        .option('-n, --name <name>', 'Check name')
        .option('-d, --description <description>', 'Check description')
        .option('-u, --url <url>', 'API URL')
        .option('-m, --method <method>', 'HTTP Method')
        .option('-i, --interval <interval>', 'Cron expression interval')
        .option(
          '--header <KEY=VALUE>',
          'HTTP header to send with the request (repeatable)',
          collectOptionValues,
          []
        )
        .option('--assertion <json>', 'Assertion JSON object (repeatable)', collectOptionValues, [])
        .option('--assertion-file <path>', 'File containing assertions JSON array')
        .option('--status-code <value>', 'Assert status code equals value')
        .option('--status-code-not <value>', 'Assert status code not equals value')
        .option('--response-time-under <ms>', 'Assert response time less than value (ms)')
        .option('--response-time-over <ms>', 'Assert response time greater than value (ms)')
        .option('--json-path <path>', 'JSON path to assert (use with --json-path-value)')
        .option('--json-path-value <value>', 'Expected value for --json-path')
        .option('--text-contains <text>', 'Assert response contains text')
        .option('--text-not-contains <text>', 'Assert response does not contain text')
        .option('--header-exists <name>', 'Assert header exists')
        .option('--regex-match <pattern>', 'Assert response matches regex')
        .option('--body <text>', 'Request body for POST/PUT/PATCH')
        .option('--regions <region>', 'Regions to run in (repeatable)', collectOptionValues, [])
        .option('--retry-count <count>', 'Number of retry attempts on failure')
        .option('--retry-interval <ms>', 'Retry interval in milliseconds')
        .option(
          '--alert-channel-id <id>',
          'Attach an alert channel to this check (repeatable)',
          collectOptionValues,
          []
        )
        .option('--no-alerts', 'Disable alerts');
    },
    updateCommandSetup: (cmd) => {
      cmd
        .option('-n, --name <name>', 'Check name')
        .option('-d, --description <description>', 'Check description')
        .option('-u, --url <url>', 'API URL')
        .option('-m, --method <method>', 'HTTP Method')
        .option('-i, --interval <interval>', 'Cron expression interval')
        .option(
          '--header <KEY=VALUE>',
          'HTTP header to send with the request (repeatable)',
          collectOptionValues,
          []
        )
        .option('--assertion <json>', 'Assertion JSON object (repeatable)', collectOptionValues, [])
        .option('--assertion-file <path>', 'File containing assertions JSON array')
        .option('--status-code <value>', 'Assert status code equals value')
        .option('--status-code-not <value>', 'Assert status code not equals value')
        .option('--response-time-under <ms>', 'Assert response time less than value (ms)')
        .option('--response-time-over <ms>', 'Assert response time greater than value (ms)')
        .option('--json-path <path>', 'JSON path to assert (use with --json-path-value)')
        .option('--json-path-value <value>', 'Expected value for --json-path')
        .option('--text-contains <text>', 'Assert response contains text')
        .option('--text-not-contains <text>', 'Assert response does not contain text')
        .option('--header-exists <name>', 'Assert header exists')
        .option('--regex-match <pattern>', 'Assert response matches regex')
        .option('--body <text>', 'Request body for POST/PUT/PATCH')
        .option('--regions <region>', 'Regions to run in (repeatable)', collectOptionValues, [])
        .option('--retry-count <count>', 'Number of retry attempts on failure')
        .option('--retry-interval <ms>', 'Retry interval in milliseconds')
        .option(
          '--alert-channel-id <id>',
          'Attach an alert channel to this check (repeatable)',
          collectOptionValues,
          []
        )
        .option('--no-alerts', 'Disable alerts');
    },
    createPrompts: async (options) => {
      let name = options.name as string | undefined;
      const description = options.description as string | undefined;
      let url = options.url as string | undefined;
      let method = options.method as string | undefined;
      const interval = options.interval as string | undefined;
      const alerts = options.alerts as boolean | undefined;
      const headers = parseKeyValuePairs(options.header as string[] | string | undefined, 'header');
      const assertions = buildAssertions(options);
      const channelIds = parseNumericIds(
        options.alertChannelId as string[] | string | undefined,
        'alert-channel-id'
      );

      if (!name || !url) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Check name:',
            when: !name,
            validate: (val: string) => (val.trim() ? true : 'Name is required'),
          },
          {
            type: 'input',
            name: 'url',
            message: 'API URL:',
            when: !url,
            validate: (val: string) => (val.trim() ? true : 'URL is required'),
          },
          {
            type: 'list',
            name: 'method',
            message: 'HTTP Method:',
            choices: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
            when: !method || method === 'GET',
            default: 'GET',
          },
        ]);
        name = name || (answers.name as string);
        url = url || (answers.url as string);
        method = method || (answers.method as string);
      }

      return {
        name,
        description,
        url,
        method: (method || 'GET').toUpperCase(),
        headers,
        body: options.body as string | undefined,
        regions: options.regions as string[] | undefined,
        retry_count: options['retry-count']
          ? parseInt(options['retry-count'] as string)
          : undefined,
        retry_interval: options['retry-interval']
          ? parseInt(options['retry-interval'] as string)
          : undefined,
        assertions,
        cron_expression: interval,
        channel_ids: channelIds,
        timeout_ms: 30000,
        alert_on_failure: alerts !== false,
      };
    },
    updatePrompts: async (id, options, existing) => {
      const name = options.name as string | undefined;
      const description = options.description as string | undefined;
      const url = options.url as string | undefined;
      const method = options.method as string | undefined;
      const interval = options.interval as string | undefined;
      const headerInput = options.header as string[] | string | undefined;
      const headers = (Array.isArray(headerInput) ? headerInput.length > 0 : Boolean(headerInput))
        ? parseKeyValuePairs(headerInput, 'header')
        : undefined;
      const assertions = buildAssertions(options);
      const alertChannelInput = options.alertChannelId as string[] | string | undefined;
      const channelIds = (
        Array.isArray(alertChannelInput) ? alertChannelInput.length > 0 : Boolean(alertChannelInput)
      )
        ? parseNumericIds(alertChannelInput, 'alert-channel-id')
        : undefined;

      if (
        !name &&
        description === undefined &&
        !url &&
        !method &&
        !interval &&
        headers === undefined &&
        assertions === undefined &&
        channelIds === undefined &&
        options.body === undefined &&
        options.regions === undefined &&
        options['retry-count'] === undefined &&
        options['retry-interval'] === undefined
      ) {
        outputService.error(
          'Please provide at least one field to update (--name, --description, --url, --method, --interval, --header, --assertion, or --alert-channel-id).'
        );
        process.exit(1);
      }

      return {
        name: name || existing.name,
        description: description ?? existing.description,
        url: url || existing.url,
        method: method ? method.toUpperCase() : existing.method || 'GET',
        cron_sequence: interval || existing.cron_expression,
        headers: headers ?? existing.headers,
        body: options.body as string | undefined,
        regions: options.regions as string[] | undefined,
        retry_count: options['retry-count']
          ? parseInt(options['retry-count'] as string)
          : undefined,
        retry_interval: options['retry-interval']
          ? parseInt(options['retry-interval'] as string)
          : undefined,
        assertions: assertions ?? existing.assertions,
        timeout_ms: existing.timeout_ms || 30000,
        alert_on_failure: existing.alert_on_failure ?? true,
        ...(channelIds !== undefined && { channel_ids: channelIds }),
      };
    },
  });

  cmd
    .command('run <id>')
    .description('Trigger a manual run for an API check')
    .action(async (id: string) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const checkId = parseInt(id);
        if (isNaN(checkId)) throw new Error('Invalid check ID');

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
        const checkId = parseInt(id);
        if (isNaN(checkId)) throw new Error('Invalid check ID');
        const isMuted = await (apiClient as ApiClient).toggleMuteApiCheck(checkId);
        if (isJson) {
          outputService.formatJsonOutput({ id: checkId, is_muted: isMuted });
          return;
        }
        console.log(chalk.green(`\n Check ${checkId} is now ${isMuted ? 'muted' : 'unmuted'}.\n`));
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

  return cmd;
}
