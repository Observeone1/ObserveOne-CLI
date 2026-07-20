import { Command } from 'commander';
import chalk from 'chalk';
import { IConfigService } from '../interfaces/config.interface.js';
import { IApiClient } from '../interfaces/api-client.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';
import { ApiClient } from '../services/api-client.service.js';
import { createResourceCommand } from './resource-command.factory.js';
import { attachRunsCommand, printHeartbeatRuns } from './runs-command.js';
import { attachIdActionCommand, attachToggleMutedCommand } from './id-action-command.js';
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
    // createPrompts/updatePrompts intentionally omitted — the resource-command
    // factory falls back to the schema-driven default built from
    // schemas.heartbeat.fieldMetadata.
  });

  attachRunsCommand(cmd, {
    title: 'Heartbeat Runs',
    emptyMessage: 'No heartbeat runs found.',
    description: 'List recent heartbeat pings',
    fetchRuns: (id, limit) => apiClient.getHeartbeatRuns(id, limit),
    formatRuns: printHeartbeatRuns,
    outputService,
  });

  attachToggleMutedCommand(cmd, {
    description: 'Toggle the muted state of a heartbeat',
    invalidIdMessage: 'Invalid heartbeat ID',
    outputService,
    toggle: (id) => (apiClient as ApiClient).toggleMuteHeartbeat(id),
  });

  attachIdActionCommand(cmd, {
    command: 'reset <id>',
    description: 'Reset a heartbeat timer (acknowledges missed pings)',
    invalidIdMessage: 'Invalid heartbeat ID',
    failureMessage: 'Failed to reset heartbeat',
    outputService,
    action: (id) => (apiClient as ApiClient).resetHeartbeat(id),
    formatJson: (hb) => hb,
    printResult: (_hb, id) => {
      console.log(chalk.green(`\n Heartbeat ${id} has been reset.\n`));
    },
  });

  cmd.commands
    .find((c) => c.name() === 'create')
    ?.addHelpText(
      'after',
      `
Examples:
  $ obs heartbeat create --name "Daily Backup" --period 86400 --grace 3600
  $ obs heartbeat create --file heartbeat.json
`
    );

  return cmd;
}
