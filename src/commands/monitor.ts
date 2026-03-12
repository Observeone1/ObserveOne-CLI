import { UrlMonitor } from '../types/index.js';
import { OptionValues } from 'commander';
import { IConfigService } from '../interfaces/config.interface.js';
import { IApiClient } from '../interfaces/api-client.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';
import {
  ResourceConfig,
  createResourceCommand,
  ResourcePayload,
} from './resource-command.factory.js';
import inquirer from 'inquirer';

export function createMonitorCommand(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService
) {
  const prompts = {
    ensureCreatePayload: async (options: OptionValues): Promise<ResourcePayload> => {
      let { name, url, interval, alerts } = options;

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
        name = name || answers.name;
        url = url || answers.url;
        interval = interval || answers.interval;
      }

      return {
        name,
        url,
        cron_expression: interval || '*/5 * * * *',
        alert_on_failure: alerts !== false,
        timeout_ms: 30000,
      };
    },
    ensureUpdatePayload: async (
      options: OptionValues
    ): Promise<{ id: number; payload: ResourcePayload }> => {
      const monitorId = Number(options.id || options.i);
      if (Number.isNaN(monitorId)) {
        outputService.error('Invalid monitor ID.');
        process.exit(1);
      }

      const { name, url, interval } = options;
      if (!name && !url && !interval) {
        outputService.error(
          'Please provide at least one field to update (--name, --url, or --interval).'
        );
        process.exit(1);
      }

      const existing = await apiClient.getUrlMonitor(monitorId);
      return {
        id: monitorId,
        payload: {
          name: name || existing.name,
          url: url || existing.url,
          timeout_ms: existing.timeout_ms || 30000,
          cron_expression: interval || (existing as any).interval || existing.cron_expression,
          alert_on_failure: existing.alert_on_failure ?? true,
        },
      };
    },
  };

  const formatters = {
    list: (items: UrlMonitor[], verbose: boolean) =>
      outputService.formatMonitorList(items, verbose),
  };

  const actions = {
    list: () => apiClient.getUrlMonitors(),
    get: (id: number) => apiClient.getUrlMonitor(id),
    create: (payload: ResourcePayload) => apiClient.createUrlMonitor(payload),
    update: (id: number, payload: ResourcePayload) => apiClient.updateUrlMonitor(id, payload),
    remove: (id: number) => apiClient.deleteUrlMonitor(id),
    toggle: (id: number) => apiClient.toggleUrlMonitor(id),
  };

  const config: ResourceConfig<UrlMonitor> = {
    name: 'monitor',
    description: 'Manage URL monitors',
    prompts,
    formatters,
    actions,
  };

  return createResourceCommand(config, { configService, outputService });
}
