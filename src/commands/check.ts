import { Command } from 'commander';
import inquirer from 'inquirer';
import { IConfigService } from '../interfaces/config.interface.js';
import { IApiClient } from '../interfaces/api-client.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';
import { createResourceCommand } from './resource-command.factory.js';
import { ApiCheck } from '../types/index.js';

/**
 * Factory function to create check command (API Checks)
 */
export function createCheckCommand(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService
): Command {
  return createResourceCommand<ApiCheck>(configService, apiClient, outputService, {
    resourceName: 'check',
    pluralName: 'API checks',
    description: 'Manage API checks',
    apiMethods: {
      list: () => apiClient.getApiChecks(),
      get: (id) => apiClient.getApiCheck(id),
      create: (data) => apiClient.createApiCheck(data),
      update: (id, data) => apiClient.updateApiCheck(id, data),
      delete: (id) => apiClient.deleteApiCheck(id),
      toggle: (id) => apiClient.toggleApiCheck(id),
    },
    formatters: {
      list: (items, verbose) => outputService.formatApiCheckList(items, verbose),
    },
    createPrompts: async (options) => {
      let name = options.name as string | undefined;
      let url = options.url as string | undefined;
      let method = options.method as string | undefined;

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
        timeout_ms: 30000,
        alert_on_failure: true,
      };
    },
    updatePrompts: async (id, options, existing) => {
      const name = options.name as string | undefined;
      const url = options.url as string | undefined;
      const method = options.method as string | undefined;

      if (!name && !url && !method) {
        outputService.error(
          'Please provide at least one field to update (--name, --url, or --method).'
        );
        process.exit(1);
      }

      return {
        name: name || existing.name,
        url: url || existing.url,
        method: method ? method.toUpperCase() : existing.method || 'GET',
        timeout_ms: existing.timeout_ms || 30000,
        alert_on_failure: existing.alert_on_failure ?? true,
      };
    },
  });
}
