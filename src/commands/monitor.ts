import { Command } from 'commander';
import chalk from 'chalk';
import { IConfigService } from '../interfaces/config.interface.js';
import { IApiClient } from '../interfaces/api-client.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';
import { ApiClient } from '../services/api-client.service.js';
import { createResourceCommand } from './resource-command.factory.js';
import { attachRunsCommand, printExecutionRuns } from './runs-command.js';
import { UrlMonitor } from '../types/index.js';
import { collectOptionValues } from '../utils/cli-input.js';

/**
 * Factory function to create monitor command using the generic resource factory
 */
export function createMonitorCommand(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService
): Command {
  const cmd = createResourceCommand<UrlMonitor>(configService, apiClient, outputService, {
    resourceName: 'monitor',
    pluralName: 'URL monitors',
    description: 'Manage URL monitors',
    apiMethods: {
      list: () => apiClient.getUrlMonitors(),
      listWithFilters: (query) => apiClient.listUrlMonitors(query),
      get: (id) => apiClient.getUrlMonitor(id),
      create: (data) => apiClient.createUrlMonitor(data),
      update: (id, data) => apiClient.updateUrlMonitor(id, data),
      delete: (id) => apiClient.deleteUrlMonitor(id),
      toggle: (id) => apiClient.toggleUrlMonitor(id),
    },
    formatters: {
      list: (items, verbose) => outputService.formatMonitorList(items, verbose),
    },
    createCommandSetup: (cmd) => {
      cmd
        .option('-n, --name <name>', 'Monitor name')
        .option('-d, --description <description>', 'Monitor description')
        .option('-u, --url <url>', 'URL to monitor')
        .option('-i, --interval <interval>', 'Cron expression interval')
        .option(
          '--alert-channel-id <id>',
          'Attach an alert channel to this monitor (repeatable)',
          collectOptionValues,
          []
        )
        .option('--no-alerts', 'Disable alerts');
    },
    updateCommandSetup: (cmd) => {
      cmd
        .option('-n, --name <name>', 'Monitor name')
        .option('-d, --description <description>', 'Monitor description')
        .option('-u, --url <url>', 'URL to monitor')
        .option('-i, --interval <interval>', 'Cron expression interval')
        .option(
          '--alert-channel-id <id>',
          'Attach an alert channel to this monitor (repeatable)',
          collectOptionValues,
          []
        );
    },
    // createPrompts/updatePrompts intentionally omitted — the resource-command
    // factory falls back to the schema-driven default built from
    // schemas.monitor.fieldMetadata. The `--alert-channel-id` repeatable
    // option is handled via fieldMetadata.channel_ids.treatEmptyArrayAsAbsent
    // so an unspecified flag falls through to existing on update (rather
    // than wiping attached channels with commander's [] default).
  });

  cmd
    .command('run <id>')
    .description('Trigger a manual check for a monitor')
    .action(async (id: string) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const monitorId = id.trim();
        if (!monitorId) throw new Error('Invalid monitor ID');

        const result = await (apiClient as ApiClient).runUrlMonitor(monitorId);

        if (isJson) {
          outputService.formatJsonOutput({
            executions: result.executions,
            message: result.message,
          });
          return;
        }

        console.log(chalk.bold(`\n ${result.message}`));
        for (const ex of result.executions) {
          console.log(
            chalk.gray(` Region: ${ex.region}  execution: ${ex.execution_id}  status: ${ex.status}`)
          );
        }
        console.log('');
      } catch (err: unknown) {
        const msg = (err as Error).message || 'Failed to run monitor';
        if (isJson) {
          outputService.formatJsonOutput({ status: 'ERROR', error: { message: msg } });
        } else {
          console.error(chalk.red(`\n ${msg}\n`));
        }
        process.exit(1);
      }
    });

  attachRunsCommand(cmd, {
    title: 'Monitor Runs',
    emptyMessage: 'No monitor runs found.',
    description: 'List recent monitor executions',
    fetchRuns: (id, limit) => apiClient.getUrlMonitorRuns(id, limit),
    formatRuns: printExecutionRuns,
    outputService,
  });

  cmd
    .command('toggle-muted <id>')
    .description('Toggle the muted state of a URL monitor')
    .action(async (id: string) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const monitorId = id.trim();
        if (!monitorId) throw new Error('Invalid monitor ID');
        const result = await (apiClient as ApiClient).toggleMuteUrlMonitor(monitorId);
        if (isJson) {
          outputService.formatJsonOutput({
            id: monitorId,
            alert_on_failure: result.alert_on_failure,
            message: result.message,
          });
          return;
        }
        console.log(chalk.green(`\n ${result.message}\n`));
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

  cmd.name('url-monitor').alias('monitor');

  cmd.commands
    .find((c) => c.name() === 'create')
    ?.addHelpText(
      'after',
      `
Examples:
  $ obs monitor create --name "Frontend" --url https://example.com --interval "*/5 * * * *"
  $ obs monitor create --file monitor.json
`
    );

  cmd.commands
    .find((c) => c.name() === 'update')
    ?.addHelpText(
      'after',
      `
Examples:
  $ obs monitor update 42 --interval "*/10 * * * *"
  $ obs monitor update 42 --name "Frontend v2" --url https://v2.example.com
`
    );

  return cmd;
}
