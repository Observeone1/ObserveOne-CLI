import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { IConfigService } from '../interfaces/config.interface.js';
import { IApiClient } from '../interfaces/api-client.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';
import { ApiClient } from '../services/api-client.service.js';
import { createResourceCommand } from './resource-command.factory.js';
import { attachRunsCommand, printExecutionRuns } from './runs-command.js';
import { UrlMonitor } from '../types/index.js';
import { collectOptionValues, parseNumericIds } from '../utils/cli-input.js';

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
      listWithFilters: (query) => apiClient.listUrlMonitors(query),
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
        .option('-d, --description <description>', 'Monitor description')
        .option('-u, --url <url>', 'URL to monitor')
        .option('-i, --interval <interval>', 'Cron expression interval')
        .option(
          '--alert-channel-id <id>',
          'Attach an alert channel to this monitor (repeatable)',
          collectOptionValues,
          []
        )
        .option('--no-alerts', 'Disable alerts');
    },
    updateCommandSetup: (cmd) => {
      cmd
        .option('-n, --name <name>', 'Monitor name')
        .option('-d, --description <description>', 'Monitor description')
        .option('-u, --url <url>', 'URL to monitor')
        .option('-i, --interval <interval>', 'Cron expression interval')
        .option(
          '--alert-channel-id <id>',
          'Attach an alert channel to this monitor (repeatable)',
          collectOptionValues,
          []
        );
    },
    createPrompts: async (options) => {
      let name = options.name as string | undefined;
      const description = options.description as string | undefined;
      let url = options.url as string | undefined;
      let interval = options.interval as string | undefined;
      const alerts = options.alerts as boolean | undefined;
      const channelIds = parseNumericIds(
        options.alertChannelId as string[] | string | undefined,
        'alert-channel-id'
      );

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
        description,
        url,
        interval: interval || '*/5 * * * *',
        alert_on_failure: alerts !== false,
        channel_ids: channelIds,
        timeout_ms: 30000,
      };
    },
    updatePrompts: async (id, options, existing) => {
      const name = options.name as string | undefined;
      const description = options.description as string | undefined;
      const url = options.url as string | undefined;
      const interval = options.interval as string | undefined;
      const alertChannelInput = options.alertChannelId as string[] | string | undefined;
      const channelIds = (
        Array.isArray(alertChannelInput) ? alertChannelInput.length > 0 : Boolean(alertChannelInput)
      )
        ? parseNumericIds(alertChannelInput, 'alert-channel-id')
        : undefined;

      if (!name && description === undefined && !url && !interval && channelIds === undefined) {
        outputService.error(
          'Please provide at least one field to update (--name, --description, --url, --interval, or --alert-channel-id).'
        );
        process.exit(1);
      }

      return {
        name: name || existing.name,
        description: description ?? existing.description ?? '',
        url: url || existing.url,
        timeout_ms: existing.timeout_ms || 30000,
        interval: interval || existing.interval,
        alert_on_failure: existing.alert_on_failure ?? true,
        ...(channelIds !== undefined && { channel_ids: channelIds }),
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

  attachRunsCommand(cmd, {
    title: 'Monitor Runs',
    emptyMessage: 'No monitor runs found.',
    description: 'List recent monitor executions',
    fetchRuns: (id, limit) => apiClient.getUrlMonitorRuns(id, limit),
    formatRuns: printExecutionRuns,
    outputService,
  });

  cmd
    .command('toggle-muted <id>')
    .description('Toggle the muted state of a URL monitor')
    .action(async (id: string) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const monitorId = parseInt(id);
        if (isNaN(monitorId)) throw new Error('Invalid monitor ID');
        const result = await (apiClient as ApiClient).toggleMuteUrlMonitor(monitorId);
        if (isJson) {
          outputService.formatJsonOutput({
            id: monitorId,
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

  cmd.name('url-monitor').alias('monitor');

  return cmd;
}
