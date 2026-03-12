import chalk from 'chalk';
import inquirer from 'inquirer';
import { Heartbeat } from '../types/index.js';
import { IConfigService } from '../interfaces/config.interface.js';
import { IApiClient } from '../interfaces/api-client.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';
import {
  createResourceCommand,
  ResourceConfig,
  ResourcePayload,
} from './resource-command.factory.js';

export function createHeartbeatCommand(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService
) {
  const prompts = {
    ensureCreatePayload: async (options: Record<string, any>): Promise<ResourcePayload> => {
      let { name, period, grace } = options;

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
        name = answers.name;
        period = answers.period;
        grace = answers.grace;
      }

      return {
        name,
        period: parseInt(period, 10) || 300,
        grace_period: parseInt(grace, 10) || 60,
        description: 'Created via CLI',
      };
    },
    ensureUpdatePayload: async (
      options: Record<string, any>
    ): Promise<{ id: number; payload: ResourcePayload }> => {
      const hbId = Number(options.id || options.i);
      if (Number.isNaN(hbId)) {
        outputService.error('Invalid heartbeat ID.');
        process.exit(1);
      }

      const { name, period } = options;
      if (!name && !period) {
        outputService.error('Please provide at least one field to update (--name or --period).');
        process.exit(1);
      }

      const existing = await apiClient.getHeartbeat(hbId);
      return {
        id: hbId,
        payload: {
          name: name || existing.name,
          period: period ? parseInt(period, 10) : existing.period,
          description: existing.description || 'Updated via CLI',
          grace_period: existing.grace_period || 60,
        },
      };
    },
  };

  const formatters = {
    list: (items: Heartbeat[], verbose: boolean) =>
      outputService.formatHeartbeatList(items, verbose),
  };

  const actions = {
    list: () => apiClient.getHeartbeats(),
    get: (id: number) => apiClient.getHeartbeat(id),
    create: (payload: ResourcePayload) => apiClient.createHeartbeat(payload),
    update: (id: number, payload: ResourcePayload) => apiClient.updateHeartbeat(id, payload),
    remove: (id: number) => apiClient.deleteHeartbeat(id),
    toggle: (id: number) => apiClient.toggleHeartbeat(id),
  };

  const config: ResourceConfig<Heartbeat> = {
    name: 'heartbeat',
    description: 'Manage heartbeats',
    prompts,
    formatters,
    actions,
    onCreateSuccess: (created: Heartbeat) => {
      if (created?.ping_key) {
        console.log(
          `\nTo ping this heartbeat, send a GET or POST request to: ${chalk.cyan(`${configService.getApiUrl()}/heartbeats/ping/${created.ping_key}`)}`
        );
      }
    },
  };

  return createResourceCommand(config, { configService, outputService });
}
