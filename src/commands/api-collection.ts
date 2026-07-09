import { Command } from 'commander';
import { IConfigService } from '../interfaces/config.interface.js';
import { IApiClient } from '../interfaces/api-client.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';
import { createResourceCommand } from './resource-command.factory.js';
import { ApiCollection } from '../types/index.js';
import { collectOptionValues } from '../utils/cli-input.js';

/**
 * Factory for the `obs api-collection` command. API collections are reusable
 * base URL + default-headers groups shared by API checks. Simple CRUD (no
 * toggle), so this wraps the generic resource factory.
 */
export function createApiCollectionCommand(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService
): Command {
  const cmd = createResourceCommand<ApiCollection>(configService, apiClient, outputService, {
    resourceName: 'api-collection',
    pluralName: 'API collections',
    description: 'Manage API collections (reusable base URL + default headers for API checks)',
    apiMethods: {
      list: () => apiClient.getApiCollections(),
      get: (id) => apiClient.getApiCollection(id),
      create: (data) => apiClient.createApiCollection(data),
      update: (id, data) => apiClient.updateApiCollection(id, data),
      delete: (id) => apiClient.deleteApiCollection(id),
    },
    formatters: {
      list: (items, verbose) => outputService.formatApiCollectionList(items, verbose),
    },
    createCommandSetup: (createCmd) => {
      createCmd
        .option('-n, --name <name>', 'Collection name')
        .option('--base-url <url>', 'Base URL (may contain {{KEY}} references)')
        .option(
          '--header <KEY=VALUE>',
          'Default header sent by checks in this collection (repeatable)',
          collectOptionValues,
          []
        );
    },
    updateCommandSetup: (updateCmd) => {
      updateCmd
        .option('-n, --name <name>', 'Collection name')
        .option('--base-url <url>', 'Base URL (may contain {{KEY}} references)')
        .option(
          '--header <KEY=VALUE>',
          'Replace the default headers (repeatable). Omit to leave unchanged.',
          collectOptionValues,
          []
        );
    },
  });

  cmd.name('api-collection').alias('collection');

  cmd.commands
    .find((c) => c.name() === 'create')
    ?.addHelpText(
      'after',
      `
Examples:
  $ obs api-collection create --name "Payments API" --base-url https://api.example.com --header "Authorization=Bearer {{TOKEN}}"
  $ obs api-collection create --file collection.json
`
    );

  return cmd;
}
