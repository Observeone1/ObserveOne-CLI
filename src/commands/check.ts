import inquirer from 'inquirer';
import { OptionValues } from 'commander';
import { ApiCheck } from '../types/index.js';
import { IConfigService } from '../interfaces/config.interface.js';
import { IApiClient } from '../interfaces/api-client.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';
import {
  createResourceCommand,
  ResourceConfig,
  ResourcePayload,
} from './resource-command.factory.js';

export function createCheckCommand(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService
) {
  const prompts = {
    ensureCreatePayload: async (options: OptionValues): Promise<ResourcePayload> => {
      let { name, url, method } = options;

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
        name = name || answers.name;
        url = url || answers.url;
        method = method || answers.method;
      }

      return {
        name,
        url,
        method: (method || 'GET').toUpperCase(),
        timeout_ms: 30000,
        alert_on_failure: true,
      };
    },
    ensureUpdatePayload: async (
      options: OptionValues
    ): Promise<{ id: number; payload: ResourcePayload }> => {
      const checkId = Number(options.id || options.i);
      if (Number.isNaN(checkId)) {
        outputService.error('Invalid check ID.');
        process.exit(1);
      }

      const { name, url, method } = options;
      if (!name && !url && !method) {
        outputService.error(
          'Please provide at least one field to update (--name, --url, or --method).'
        );
        process.exit(1);
      }

      const existing = await apiClient.getApiCheck(checkId);
      return {
        id: checkId,
        payload: {
          name: name || existing.name,
          url: url || existing.url,
          method: method ? method.toUpperCase() : existing.method || 'GET',
          timeout_ms: existing.timeout_ms || 30000,
          alert_on_failure: existing.alert_on_failure ?? true,
        },
      };
    },
  };

  const formatters = {
    list: (items: ApiCheck[], verbose: boolean) => outputService.formatApiCheckList(items, verbose),
  };

  const actions = {
    list: () => apiClient.getApiChecks(),
    get: (id: number) => apiClient.getApiCheck(id),
    create: (payload: ResourcePayload) => apiClient.createApiCheck(payload),
    update: (id: number, payload: ResourcePayload) => apiClient.updateApiCheck(id, payload),
    remove: (id: number) => apiClient.deleteApiCheck(id),
    toggle: (id: number) => apiClient.toggleApiCheck(id),
  };

  const config: ResourceConfig<ApiCheck> = {
    name: 'check',
    description: 'Manage API checks',
    prompts,
    formatters,
    actions,
  };

  return createResourceCommand(config, { configService, outputService });
}
