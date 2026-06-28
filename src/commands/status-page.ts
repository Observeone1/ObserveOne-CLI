import { Command } from 'commander';
import chalk from 'chalk';
import { IConfigService } from '../interfaces/config.interface.js';
import { IApiClient } from '../interfaces/api-client.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';
import { ApiClient } from '../services/api-client.service.js';
import { createResourceCommand } from './resource-command.factory.js';
import { StatusPage } from '../types/index.js';

const MONITOR_TYPES = ['url-monitor', 'api-check', 'heartbeat', 'browser-check'] as const;

/**
 * Parse a `--order` CLI value into an integer, rejecting non-numeric input.
 * Throws a clear error (matching the reorder command) so no request is sent
 * with a NaN display order.
 */
export function parseDisplayOrder(raw: string): number {
  const value = parseInt(raw, 10);
  if (isNaN(value)) throw new Error('Invalid --order value (must be an integer)');
  return value;
}

export function createStatusPageCommand(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService
): Command {
  const cmd = createResourceCommand<StatusPage>(configService, apiClient, outputService, {
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
    // createPrompts/updatePrompts intentionally omitted — the resource-command
    // factory falls back to the schema-driven default built from
    // schemas['status-page'].fieldMetadata.
  });

  cmd
    .command('add-monitor <sp-id> <resource-id>')
    .description('Attach a monitor to a status page')
    .requiredOption('--type <type>', `Monitor type (${MONITOR_TYPES.join('|')})`)
    .requiredOption('--name <name>', 'Display name on the status page')
    .option('--order <n>', 'Display order (integer)')
    .action(async (spId: string, resourceId: string, options) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const statusPageId = spId.trim();
        const monitorId = resourceId.trim();
        if (!statusPageId) throw new Error('Invalid status page ID');
        if (!monitorId) throw new Error('Invalid resource ID');
        const type = options.type as string;
        if (!MONITOR_TYPES.includes(type as (typeof MONITOR_TYPES)[number])) {
          throw new Error(`Invalid type. Must be one of: ${MONITOR_TYPES.join(', ')}`);
        }
        const payload: {
          monitor_type: string;
          monitor_id: string;
          display_name: string;
          display_order?: number;
        } = {
          monitor_type: type,
          monitor_id: monitorId,
          display_name: options.name as string,
        };
        if (options.order !== undefined) {
          payload.display_order = parseDisplayOrder(options.order as string);
        }
        const entry = await (apiClient as ApiClient).addMonitorToStatusPage(statusPageId, payload);
        if (isJson) {
          outputService.formatJsonOutput({ status_page_monitor: entry });
          return;
        }
        console.log(
          chalk.green(
            `\n Monitor ${monitorId} added to status page ${statusPageId}. Entry ID: ${entry.id}\n`
          )
        );
      } catch (err: unknown) {
        const msg = (err as Error).message || 'Failed to add monitor';
        if (isJson) {
          outputService.formatJsonOutput({ status: 'ERROR', error: { message: msg } });
        } else {
          console.error(chalk.red(`\n ${msg}\n`));
        }
        process.exit(1);
      }
    });

  cmd
    .command('remove-monitor <sp-id> <entry-id>')
    .description('Remove a monitor from a status page (entry-id from add-monitor response)')
    .action(async (spId: string, resourceId: string) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const statusPageId = spId.trim();
        const monitorId = resourceId.trim();
        if (!statusPageId) throw new Error('Invalid status page ID');
        if (!monitorId) throw new Error('Invalid resource ID');
        await (apiClient as ApiClient).removeMonitorFromStatusPage(statusPageId, monitorId);
        if (isJson) {
          outputService.formatJsonOutput({
            status_page_monitor: {
              status_page_id: statusPageId,
              monitor_id: monitorId,
              deleted: true,
            },
          });
          return;
        }
        console.log(
          chalk.green(`\n Monitor ${monitorId} removed from status page ${statusPageId}.\n`)
        );
      } catch (err: unknown) {
        const msg = (err as Error).message || 'Failed to remove monitor';
        if (isJson) {
          outputService.formatJsonOutput({ status: 'ERROR', error: { message: msg } });
        } else {
          console.error(chalk.red(`\n ${msg}\n`));
        }
        process.exit(1);
      }
    });

  cmd
    .command('reorder <sp-id> <entry-id>')
    .description(
      "Change a monitor's display order on a status page (entry-id from add-monitor response)"
    )
    .requiredOption('--order <n>', 'New display order (integer)')
    .action(async (spId: string, entryIdArg: string, options) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const statusPageId = spId.trim();
        const entryId = entryIdArg.trim();
        if (!statusPageId) throw new Error('Invalid status page ID');
        if (!entryId) throw new Error('Invalid entry ID');
        const displayOrder = parseDisplayOrder(options.order as string);
        const entry = await (apiClient as ApiClient).updateStatusPageMonitorOrder(
          statusPageId,
          entryId,
          displayOrder
        );
        if (isJson) {
          outputService.formatJsonOutput({ status_page_monitor: entry });
          return;
        }
        console.log(
          chalk.green(
            `\n Entry ${entryId} on status page ${statusPageId} moved to display order ${displayOrder}.\n`
          )
        );
      } catch (err: unknown) {
        const msg = (err as Error).message || 'Failed to reorder monitor';
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
