import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { IConfigService } from '../interfaces/config.interface.js';
import { IApiClient } from '../interfaces/api-client.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';
import { ApiClient } from '../services/api-client.service.js';
import { createResourceCommand } from './resource-command.factory.js';
import { attachRunsCommand, printHeartbeatRuns } from './runs-command.js';
import { Heartbeat } from '../types/index.js';

/**
 * Factory function to create heartbeat command using the generic resource factory
 */
export function createHeartbeatCommand(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService
): Command {
  const cmd = createResourceCommand<Heartbeat>(configService, apiClient, outputService, {
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
        .option('-d, --description <description>', 'Heartbeat description')
        .option('-p, --period <seconds>', 'Expected period in seconds')
        .option('-g, --grace <seconds>', 'Grace period in seconds');
    },
    updateCommandSetup: (cmd) => {
      cmd
        .option('-n, --name <name>', 'Heartbeat name')
        .option('-d, --description <description>', 'Heartbeat description')
        .option('-p, --period <seconds>', 'Expected period in seconds')
        .option('-g, --grace <seconds>', 'Grace period in seconds');
    },
    createPrompts: async (options) => {
      let name = options.name as string | undefined;
      const description = options.description as string | undefined;
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
        description: description ?? '',
      };
    },
    updatePrompts: async (id, options, existing) => {
      const name = options.name as string | undefined;
      const description = options.description as string | undefined;
      const period = options.period as string | number | undefined;
      const grace = options.grace as string | number | undefined;

      if (!name && description === undefined && !period && !grace) {
        outputService.error(
          'Please provide at least one field to update (--name, --description, --period, or --grace).'
        );
        process.exit(1);
      }

      return {
        name: name || existing.name,
        period: period
          ? typeof period === 'string'
            ? parseInt(period)
            : (period as number)
          : existing.period,
        description: description ?? existing.description ?? '',
        grace_period: grace
          ? typeof grace === 'string'
            ? parseInt(grace)
            : (grace as number)
          : (existing.grace_period ?? 60),
      };
    },
  });

  attachRunsCommand(cmd, {
    title: 'Heartbeat Runs',
    emptyMessage: 'No heartbeat runs found.',
    description: 'List recent heartbeat pings',
    fetchRuns: (id, limit) => apiClient.getHeartbeatRuns(id, limit),
    formatRuns: printHeartbeatRuns,
    outputService,
  });

  cmd
    .command('toggle-muted <id>')
    .description('Toggle the muted state of a heartbeat')
    .action(async (id: string) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const hbId = parseInt(id);
        if (isNaN(hbId)) throw new Error('Invalid heartbeat ID');
        const isMuted = await (apiClient as ApiClient).toggleMuteHeartbeat(hbId);
        if (isJson) {
          outputService.formatJsonOutput({ id: hbId, is_muted: isMuted });
          return;
        }
        console.log(chalk.green(`\n Heartbeat ${hbId} is now ${isMuted ? 'muted' : 'unmuted'}.\n`));
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

  cmd
    .command('reset <id>')
    .description('Reset a heartbeat timer (acknowledges missed pings)')
    .action(async (id: string) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const hbId = parseInt(id);
        if (isNaN(hbId)) throw new Error('Invalid heartbeat ID');
        await (apiClient as ApiClient).resetHeartbeat(hbId);
        if (isJson) {
          outputService.formatJsonOutput({ id: hbId, status: 'reset' });
          return;
        }
        console.log(chalk.green(`\n Heartbeat ${hbId} has been reset.\n`));
      } catch (err: unknown) {
        const msg = (err as Error).message || 'Failed to reset heartbeat';
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
