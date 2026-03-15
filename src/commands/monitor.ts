import { Command } from 'commander';
import inquirer from 'inquirer';
import { IConfigService } from '../interfaces/config.interface.js';
import { IApiClient } from '../interfaces/api-client.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';
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
  return createResourceCommand<UrlMonitor>(configService, apiClient, outputService, {
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
        cron_expression: interval || '*/5 * * * *',
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
        cron_expression: (interval || existing.cron_expression) as string | undefined,
        alert_on_failure: existing.alert_on_failure ?? true,
      };
    },
  });
}
