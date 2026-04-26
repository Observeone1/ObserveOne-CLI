import { Command } from 'commander';
import { readFileSync, existsSync } from 'fs';
import { IConfigService } from '../interfaces/config.interface.js';
import { IApiClient } from '../interfaces/api-client.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';
import { ListQueryOptions, PaginatedListResult } from '../types/index.js';
import { requireConfirmation } from '../utils/confirm.js';
import {
  addListQueryOptions,
  formatPaginationSummary,
  resolveListQueryOptions,
} from '../utils/list-query.js';

export interface ResourceFactoryOptions<T> {
  resourceName: string;
  pluralName: string;
  description: string;
  apiMethods: {
    list: () => Promise<T[]>;
    listWithFilters?: (query: ListQueryOptions) => Promise<PaginatedListResult<T>>;
    get: (id: number) => Promise<T>;
    create: (data: Partial<T>) => Promise<T>;
    update: (id: number, data: Partial<T>) => Promise<T>;
    delete: (id: number) => Promise<void>;
    toggle?: (id: number) => Promise<boolean>;
  };
  formatters: {
    list: (items: T[], verbose: boolean) => void;
  };
  createCommandSetup?: (cmd: Command) => void;
  updateCommandSetup?: (cmd: Command) => void;
  createPrompts?: (options: Record<string, unknown>) => Promise<Partial<T>>;
  updatePrompts?: (
    id: number,
    options: Record<string, unknown>,
    existing: T
  ) => Promise<Partial<T>>;
}

/**
 * Factory to generate standardized CRUD subcommands for any resource.
 * This ensures consistent JSON mode detection, error handling, and auth checks.
 */
export function createResourceCommand<T extends { id: number; name?: string }>(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService,
  options: ResourceFactoryOptions<T>
): Command {
  const { resourceName, pluralName, description, apiMethods, formatters } = options;
  const cmd = new Command(resourceName).description(description);
  const article = /^[aeiou]/i.test(resourceName) ? 'an' : 'a';

  const resolveOptions = (
    cmdOptions: Record<string, unknown> | Command
  ): Record<string, unknown> => {
    if (typeof (cmdOptions as Command).opts === 'function') {
      return (cmdOptions as Command).opts();
    }
    return cmdOptions as Record<string, unknown>;
  };

  // Helper for consistent auth and JSON mode setup
  const setupContext = (cmdOptions: Record<string, unknown>) => {
    const isJson =
      process.env.OBS_JSON_OUTPUT === 'true' ||
      cmdOptions.json === true ||
      cmdOptions.output === 'json';
    if (isJson) {
      outputService.enableJsonMode();
    }
    const apiKey = configService.getApiKey();
    if (!apiKey) {
      outputService.error('Not authenticated. Please run "obs login" first.');
      process.exit(1);
    }
    return { isJson, apiKey };
  };

  // LIST
  const listCmd = cmd
    .command('list')
    .description(`List all ${pluralName}`)
    .option('-o, --output <format>', 'Output format (table, json)', 'table')
    .option('-j, --json', 'Output in JSON format');

  if (apiMethods.listWithFilters) {
    addListQueryOptions(listCmd);
  }

  listCmd.action(async (cmdOptions: Record<string, unknown>) => {
    const resolvedOptions = resolveOptions(cmdOptions);
    setupContext(resolvedOptions);
    try {
      outputService.progress(`Fetching ${pluralName}...`);
      const paginated = apiMethods.listWithFilters
        ? await apiMethods.listWithFilters(resolveListQueryOptions(resolvedOptions))
        : null;
      const items = paginated?.items ?? (await apiMethods.list());
      if (
        process.env.OBS_JSON_OUTPUT === 'true' ||
        resolvedOptions.output === 'json' ||
        resolvedOptions.json === true
      ) {
        outputService.formatJsonOutput(
          paginated ? { items: paginated.items, pagination: paginated.pagination } : items
        );
      } else {
        if (paginated) {
          outputService.info(formatPaginationSummary(paginated.pagination, paginated.items.length));
        }
        formatters.list(items, process.env.OBS_VERBOSE === 'true');
      }
    } catch (error: unknown) {
      outputService.error(outputService.formatError(error));
      process.exit(1);
    }
  });

  // GET
  cmd
    .command('get <id>')
    .description(`Get details of ${article} ${resourceName}`)
    .option('-j, --json', 'Output in JSON format')
    .action(async (id: string, cmdOptions: Record<string, unknown>) => {
      const resolvedOptions = resolveOptions(cmdOptions);
      setupContext(resolvedOptions);
      try {
        const resourceId = parseInt(id);
        if (isNaN(resourceId)) {
          outputService.error(`Invalid ${resourceName} ID.`);
          process.exit(1);
        }
        outputService.progress(`Fetching ${resourceName} ${resourceId}...`);
        const item = await apiMethods.get(resourceId);
        if (process.env.OBS_JSON_OUTPUT === 'true' || resolvedOptions.json === true) {
          outputService.formatJsonOutput(item);
        } else {
          formatters.list([item], true);
        }
      } catch (error: unknown) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });

  // CREATE
  const createCmd = cmd
    .command('create')
    .description(`Create a new ${resourceName}`)
    .option('-j, --json', 'Output in JSON format');

  createCmd.option('--file <path>', 'Path to JSON file with resource data');

  if (options.createCommandSetup) {
    options.createCommandSetup(createCmd);
  }

  createCmd.action(async (cmdOptions: Record<string, unknown>) => {
    const resolvedOptions = resolveOptions(cmdOptions);
    setupContext(resolvedOptions);
    try {
      let payload: Partial<T>;

      if (resolvedOptions.file) {
        const filePath = resolvedOptions.file as string;
        if (!existsSync(filePath)) {
          outputService.error(`File not found: ${filePath}`);
          process.exit(1);
        }
        try {
          payload = JSON.parse(readFileSync(filePath, 'utf-8')) as Partial<T>;
        } catch {
          outputService.error(`Failed to parse ${filePath} as JSON.`);
          process.exit(1);
        }
      } else {
        payload = resolvedOptions as unknown as Partial<T>;
        if (options.createPrompts) {
          payload = await options.createPrompts(resolvedOptions);
        }
      }

      outputService.progress(`Creating ${resourceName}...`);
      const newItem = await apiMethods.create(payload);

      if (process.env.OBS_JSON_OUTPUT === 'true' || resolvedOptions.json === true) {
        outputService.formatJsonOutput(newItem);
      } else {
        const nameLabel = newItem.name ? `"${newItem.name}"` : `ID ${newItem.id}`;
        const idSuffix = newItem.name ? ` (ID: ${newItem.id})` : '';
        outputService.success(
          `${resourceName.charAt(0).toUpperCase() + resourceName.slice(1)} ${nameLabel} created successfully${idSuffix}.`
        );
      }
    } catch (error: unknown) {
      outputService.error(outputService.formatError(error));
      process.exit(1);
    }
  });

  // UPDATE
  const updateCmd = cmd
    .command('update <id>')
    .description(`Update ${article} ${resourceName}`)
    .option('-j, --json', 'Output in JSON format');

  if (options.updateCommandSetup) {
    options.updateCommandSetup(updateCmd);
  }

  updateCmd.action(async (id: string, cmdOptions: Record<string, unknown>) => {
    const resolvedOptions = resolveOptions(cmdOptions);
    setupContext(resolvedOptions);
    try {
      const resourceId = parseInt(id);
      if (isNaN(resourceId)) {
        outputService.error(`Invalid ${resourceName} ID.`);
        process.exit(1);
      }

      outputService.progress(`Updating ${resourceName} ${resourceId}...`);
      const existing = await apiMethods.get(resourceId);

      let payload: Partial<T> = resolvedOptions as unknown as Partial<T>;
      if (options.updatePrompts) {
        payload = await options.updatePrompts(resourceId, resolvedOptions, existing);
      }

      const updatedItem = await apiMethods.update(resourceId, payload);
      if (process.env.OBS_JSON_OUTPUT === 'true' || resolvedOptions.json === true) {
        outputService.formatJsonOutput(updatedItem);
      } else {
        outputService.success(
          `${resourceName.charAt(0).toUpperCase() + resourceName.slice(1)} ${resourceId} updated successfully.`
        );
      }
    } catch (error: unknown) {
      outputService.error(outputService.formatError(error));
      process.exit(1);
    }
  });

  // DELETE
  cmd
    .command('delete <id>')
    .description(`Delete ${article} ${resourceName}`)
    .option('-y, --yes', 'Skip confirmation prompt')
    .option('-j, --json', 'Output in JSON format')
    .action(async (id: string, cmdOptions: Record<string, unknown>) => {
      const resolvedOptions = resolveOptions(cmdOptions);
      setupContext(resolvedOptions);
      try {
        const resourceId = parseInt(id);
        if (isNaN(resourceId)) {
          outputService.error(`Invalid ${resourceName} ID.`);
          process.exit(1);
        }

        const confirmed = await requireConfirmation(
          `Are you sure you want to delete ${resourceName} ${resourceId}?`,
          {
            yes: resolvedOptions.yes as boolean | undefined,
            isJson: resolvedOptions.json === true || process.env.OBS_JSON_OUTPUT === 'true',
            outputError: (msg) => outputService.error(msg),
          }
        );
        if (!confirmed) {
          outputService.info('Deletion cancelled.');
          return;
        }

        outputService.progress(`Deleting ${resourceName} ${resourceId}...`);
        await apiMethods.delete(resourceId);

        if (process.env.OBS_JSON_OUTPUT === 'true' || resolvedOptions.json === true) {
          outputService.formatJsonOutput({ success: true, id: resourceId });
        } else {
          outputService.success(
            `${resourceName.charAt(0).toUpperCase() + resourceName.slice(1)} ${resourceId} deleted successfully.`
          );
        }
      } catch (error: unknown) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });

  // TOGGLE (Optional)
  if (apiMethods.toggle) {
    cmd
      .command('toggle <id>')
      .description(`Pause or resume ${article} ${resourceName}`)
      .option('-j, --json', 'Output in JSON format')
      .action(async (id: string, cmdOptions: Record<string, unknown>) => {
        const resolvedOptions = resolveOptions(cmdOptions);
        setupContext(resolvedOptions);
        try {
          const resourceId = parseInt(id);
          if (isNaN(resourceId)) {
            outputService.error(`Invalid ${resourceName} ID.`);
            process.exit(1);
          }
          outputService.progress(`Toggling ${resourceName} ${resourceId}...`);
          const isActive = await apiMethods.toggle!(resourceId);

          if (process.env.OBS_JSON_OUTPUT === 'true' || resolvedOptions.json === true) {
            outputService.formatJsonOutput({ id: resourceId, is_active: isActive });
          } else {
            outputService.success(
              `${resourceName.charAt(0).toUpperCase() + resourceName.slice(1)} ${resourceId} is now ${isActive ? 'ACTIVE' : 'PAUSED'}.`
            );
          }
        } catch (error: unknown) {
          outputService.error(outputService.formatError(error));
          process.exit(1);
        }
      });
  }

  return cmd;
}
