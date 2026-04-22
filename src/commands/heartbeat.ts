import { Command } from 'commander';
import inquirer from 'inquirer';
import { IConfigService } from '../interfaces/config.interface.js';
import { IApiClient } from '../interfaces/api-client.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';
import { createResourceCommand } from './resource-command.factory.js';
import { Heartbeat } from '../types/index.js';

/**
 * Factory function to create heartbeat command using the generic resource factory
 */
export function createHeartbeatCommand(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService
): Command {
  return createResourceCommand<Heartbeat>(configService, apiClient, outputService, {
    resourceName: 'heartbeat',
    pluralName: 'heartbeats',
    description: 'Manage heartbeats',
    apiMethods: {
      list: () => apiClient.getHeartbeats(),
      listWithFilters: (query) => apiClient.listHeartbeats(query),
      get: (id) => apiClient.getHeartbeat(id),
      create: (data) => apiClient.createHeartbeat(data),
      update: (id, data) => apiClient.updateHeartbeat(id, data),
      delete: (id) => apiClient.deleteHeartbeat(id),
      toggle: (id) => apiClient.toggleHeartbeat(id),
    },
    formatters: {
      list: (items, verbose) => outputService.formatHeartbeatList(items, verbose),
    },
    createCommandSetup: (cmd) => {
      cmd
        .option('-n, --name <name>', 'Heartbeat name')
        .option('-p, --period <seconds>', 'Expected period in seconds')
        .option('-g, --grace <seconds>', 'Grace period in seconds');
    },
    updateCommandSetup: (cmd) => {
      cmd
        .option('-n, --name <name>', 'Heartbeat name')
        .option('-p, --period <seconds>', 'Expected period in seconds');
    },
    createPrompts: async (options) => {
      let name = options.name as string | undefined;
      let period = options.period as string | number | undefined;
      let grace = options.grace as string | number | undefined;

      if (!name) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Heartbeat name:',
            validate: (val: string) => (val.trim() ? true : 'Name is required'),
          },
          {
            type: 'number',
            name: 'period',
            message: 'Expected period (seconds):',
            default: 300,
          },
          {
            type: 'number',
            name: 'grace',
            message: 'Grace period (seconds):',
            default: 60,
          },
        ]);
        name = name || (answers.name as string);
        period = period || (answers.period as number);
        grace = grace || (answers.grace as number);
      }

      return {
        name,
        period: typeof period === 'string' ? parseInt(period) : (period as number) || 300,
        grace_period: typeof grace === 'string' ? parseInt(grace) : (grace as number) || 60,
        description: 'Created via CLI',
      };
    },
    updatePrompts: async (id, options, existing) => {
      const name = options.name as string | undefined;
      const period = options.period as string | number | undefined;

      if (!name && !period) {
        outputService.error('Please provide at least one field to update (--name or --period).');
        process.exit(1);
      }

      return {
        name: name || existing.name,
        period: period
          ? typeof period === 'string'
            ? parseInt(period)
            : (period as number)
          : existing.period,
        description: existing.description || 'Updated via CLI',
        grace_period: existing.grace_period || 60,
      };
    },
  });
}
