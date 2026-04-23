import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
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
} from '../utils/cli-input.js';

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
        .option('-u, --url <url>', 'API URL')
        .option('-m, --method <method>', 'HTTP Method')
        .option(
          '--header <KEY=VALUE>',
          'HTTP header to send with the request (repeatable)',
          collectOptionValues,
          []
        )
        .option(
          '--assertion <json>',
          'Assertion JSON object (repeatable)',
          collectOptionValues,
          []
        );
    },
    updateCommandSetup: (cmd) => {
      cmd
        .option('-n, --name <name>', 'Check name')
        .option('-u, --url <url>', 'API URL')
        .option('-m, --method <method>', 'HTTP Method')
        .option(
          '--header <KEY=VALUE>',
          'HTTP header to send with the request (repeatable)',
          collectOptionValues,
          []
        )
        .option(
          '--assertion <json>',
          'Assertion JSON object (repeatable)',
          collectOptionValues,
          []
        );
    },
    createPrompts: async (options) => {
      let name = options.name as string | undefined;
      let url = options.url as string | undefined;
      let method = options.method as string | undefined;
      const headers = parseKeyValuePairs(options.header as string[] | string | undefined, 'header');
      const assertions = parseJsonArrayOption<NonNullable<ApiCheck['assertions']>[number]>(
        options.assertion as string[] | string | undefined,
        'assertion'
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
        url,
        method: (method || 'GET').toUpperCase(),
        headers,
        assertions,
        timeout_ms: 30000,
        alert_on_failure: true,
      };
    },
    updatePrompts: async (id, options, existing) => {
      const name = options.name as string | undefined;
      const url = options.url as string | undefined;
      const method = options.method as string | undefined;
      const headerInput = options.header as string[] | string | undefined;
      const headers = (Array.isArray(headerInput) ? headerInput.length > 0 : Boolean(headerInput))
        ? parseKeyValuePairs(headerInput, 'header')
        : undefined;
      const assertionInput = options.assertion as string[] | string | undefined;
      const assertions = (
        Array.isArray(assertionInput) ? assertionInput.length > 0 : Boolean(assertionInput)
      )
        ? parseJsonArrayOption<NonNullable<ApiCheck['assertions']>[number]>(
            assertionInput,
            'assertion'
          )
        : undefined;

      if (!name && !url && !method && headers === undefined && assertions === undefined) {
        outputService.error(
          'Please provide at least one field to update (--name, --url, --method, --header, or --assertion).'
        );
        process.exit(1);
      }

      return {
        name: name || existing.name,
        url: url || existing.url,
        method: method ? method.toUpperCase() : existing.method || 'GET',
        headers: headers ?? existing.headers,
        assertions: assertions ?? existing.assertions,
        timeout_ms: existing.timeout_ms || 30000,
        alert_on_failure: existing.alert_on_failure ?? true,
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

  return cmd;
}
