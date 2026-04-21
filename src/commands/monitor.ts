import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { IConfigService } from '../interfaces/config.interface.js';
import { IApiClient } from '../interfaces/api-client.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';
import { ApiClient } from '../services/api-client.service.js';
import { createResourceCommand } from './resource-command.factory.js';
import { UrlMonitor } from '../types/index.js';

/**
 * Factory function to create monitor command using the generic resource factory
 */
export function createMonitorCommand(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService
): Command {
  const cmd = createResourceCommand<UrlMonitor>(configService, apiClient, outputService, {
    resourceName: 'monitor',
    pluralName: 'URL monitors',
    description: 'Manage URL monitors',
    apiMethods: {
      list: () => apiClient.getUrlMonitors(),
      get: (id) => apiClient.getUrlMonitor(id),
      create: (data) => apiClient.createUrlMonitor(data),
      update: (id, data) => apiClient.updateUrlMonitor(id, data),
      delete: (id) => apiClient.deleteUrlMonitor(id),
      toggle: (id) => apiClient.toggleUrlMonitor(id),
    },
    formatters: {
      list: (items, verbose) => outputService.formatMonitorList(items, verbose),
    },
    createCommandSetup: (cmd) => {
      cmd
        .option('-n, --name <name>', 'Monitor name')
        .option('-u, --url <url>', 'URL to monitor')
        .option('-i, --interval <interval>', 'Cron expression interval')
        .option('--no-alerts', 'Disable alerts');
    },
    updateCommandSetup: (cmd) => {
      cmd
        .option('-n, --name <name>', 'Monitor name')
        .option('-u, --url <url>', 'URL to monitor')
        .option('-i, --interval <interval>', 'Cron expression interval');
    },
    createPrompts: async (options) => {
      let name = options.name as string | undefined;
      let url = options.url as string | undefined;
      let interval = options.interval as string | undefined;
      const alerts = options.alerts as boolean | undefined;

      if (!name || !url) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Monitor name:',
            when: !name,
            validate: (val: string) => (val.trim() ? true : 'Name is required'),
          },
          {
            type: 'input',
            name: 'url',
            message: 'URL to monitor:',
            when: !url,
            validate: (val: string) => {
              try {
                new URL(val);
                return true;
              } catch {
                return 'Please enter a valid URL (e.g. https://example.com)';
              }
            },
          },
          {
            type: 'input',
            name: 'interval',
            message: 'Cron interval (default: Every 5 mins):',
            when: !interval,
            default: '*/5 * * * *',
          },
        ]);
        name = name || (answers.name as string);
        url = url || (answers.url as string);
        interval = interval || (answers.interval as string);
      }

      return {
        name,
        url,
        interval: interval || '*/5 * * * *',
        alert_on_failure: alerts !== false,
        timeout_ms: 30000,
      };
    },
    updatePrompts: async (id, options, existing) => {
      const name = options.name as string | undefined;
      const url = options.url as string | undefined;
      const interval = options.interval as string | undefined;

      if (!name && !url && !interval) {
        outputService.error(
          'Please provide at least one field to update (--name, --url, or --interval).'
        );
        process.exit(1);
      }

      return {
        name: name || existing.name,
        url: url || existing.url,
        timeout_ms: existing.timeout_ms || 30000,
        interval: interval || existing.interval,
        alert_on_failure: existing.alert_on_failure ?? true,
      };
    },
  });

  cmd
    .command('run <id>')
    .description('Trigger a manual check for a monitor')
    .action(async (id: string) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const monitorId = parseInt(id);
        if (isNaN(monitorId)) throw new Error('Invalid monitor ID');

        const result = await (apiClient as ApiClient).runUrlMonitor(monitorId);

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
        const msg = (err as Error).message || 'Failed to run monitor';
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
