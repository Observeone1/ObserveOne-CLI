import { Command } from 'commander';
import inquirer from 'inquirer';
import { IConfigService } from '../interfaces/config.interface.js';
import { IApiClient } from '../interfaces/api-client.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';
import { createResourceCommand } from './resource-command.factory.js';
import { StatusPage } from '../types/index.js';

export function createStatusPageCommand(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService
): Command {
  return createResourceCommand<StatusPage>(configService, apiClient, outputService, {
    resourceName: 'status-page',
    pluralName: 'status pages',
    description: 'Manage status pages',
    apiMethods: {
      list: () => apiClient.getStatusPages(),
      get: (id) => apiClient.getStatusPage(id),
      create: (data) => apiClient.createStatusPage(data),
      update: (id, data) => apiClient.updateStatusPage(id, data),
      delete: (id) => apiClient.deleteStatusPage(id),
    },
    formatters: {
      list: (items, verbose) => outputService.formatStatusPageList(items, verbose),
    },
    createCommandSetup: (cmd) => {
      cmd
        .option('--slug <slug>', 'Status page slug (lowercase, hyphenated)')
        .option('-n, --name <name>', 'Status page name')
        .option('-d, --description <description>', 'Status page description')
        .option('--logo-url <url>', 'Logo URL')
        .option('--theme-primary-color <color>', 'Theme primary color (hex)')
        .option('--theme-background-color <color>', 'Theme background color (hex)')
        .option('--private', 'Make status page private')
        .option('--hide-incident-history', 'Hide incident history')
        .option('--hide-uptime', 'Hide uptime percentage');
    },
    updateCommandSetup: (cmd) => {
      cmd
        .option('--slug <slug>', 'Status page slug (lowercase, hyphenated)')
        .option('-n, --name <name>', 'Status page name')
        .option('-d, --description <description>', 'Status page description')
        .option('--logo-url <url>', 'Logo URL')
        .option('--theme-primary-color <color>', 'Theme primary color (hex)')
        .option('--theme-background-color <color>', 'Theme background color (hex)')
        .option('--private', 'Make status page private')
        .option('--hide-incident-history', 'Hide incident history')
        .option('--hide-uptime', 'Hide uptime percentage');
    },
    createPrompts: async (options) => {
      let slug = options.slug as string | undefined;
      let name = options.name as string | undefined;

      if (!slug || !name) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'slug',
            message: 'Status page slug:',
            when: !slug,
            validate: (val: string) => (val.trim() ? true : 'Slug is required'),
          },
          {
            type: 'input',
            name: 'name',
            message: 'Status page name:',
            when: !name,
            validate: (val: string) => (val.trim() ? true : 'Name is required'),
          },
        ]);
        slug = slug || (answers.slug as string);
        name = name || (answers.name as string);
      }

      return {
        slug,
        name,
        description: options.description as string | undefined,
        logo_url: options.logoUrl as string | undefined,
        theme_primary_color: options.themePrimaryColor as string | undefined,
        theme_background_color: options.themeBackgroundColor as string | undefined,
        is_public: options.private ? false : true,
        show_incident_history: options.hideIncidentHistory ? false : true,
        show_uptime_percentage: options.hideUptime ? false : true,
      };
    },
    updatePrompts: async (_id, options, existing) => {
      const hasChanges =
        options.slug ||
        options.name ||
        options.description ||
        options.logoUrl ||
        options.themePrimaryColor ||
        options.themeBackgroundColor ||
        options.private !== undefined ||
        options.hideIncidentHistory !== undefined ||
        options.hideUptime !== undefined;

      if (!hasChanges) {
        outputService.error('Please provide at least one field to update.');
        process.exit(1);
      }

      return {
        slug: (options.slug as string | undefined) || existing.slug,
        name: (options.name as string | undefined) || existing.name,
        description: (options.description as string | undefined) || existing.description,
        logo_url: (options.logoUrl as string | undefined) || existing.logo_url,
        theme_primary_color:
          (options.themePrimaryColor as string | undefined) || existing.theme_primary_color,
        theme_background_color:
          (options.themeBackgroundColor as string | undefined) ||
          existing.theme_background_color,
        is_public: options.private ? false : existing.is_public,
        show_incident_history: options.hideIncidentHistory ? false : existing.show_incident_history,
        show_uptime_percentage: options.hideUptime ? false : existing.show_uptime_percentage,
      };
    },
  });
}
