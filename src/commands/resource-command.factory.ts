import { Command } from 'commander';
import inquirer from 'inquirer';
import { IConfigService } from '../interfaces/config.interface.js';
import { IApiClient } from '../interfaces/api-client.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';

export interface ResourceFactoryOptions<T> {
  resourceName: string;
  pluralName: string;
  description: string;
  apiMethods: {
    list: () => Promise<T[]>;
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
export function createResourceCommand<T extends { id: number; name: string }>(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService,
  options: ResourceFactoryOptions<T>
): Command {
  const { resourceName, pluralName, description, apiMethods, formatters } = options;
  const cmd = new Command(resourceName).description(description);

  // Helper for consistent auth and JSON mode setup
  const setupContext = (cmdOptions: Record<string, unknown>) => {
    const isJson =
      process.env.OBS_JSON_OUTPUT === 'true' ||
      cmdOptions.json === true ||
      cmdOptions.format === 'json';
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
  cmd
    .command('list')
    .description(`List all ${pluralName}`)
    .option('-f, --format <format>', 'Output format (table, json)', 'table')
    .option('-j, --json', 'Output in JSON format')
    .action(async (cmdOptions: Record<string, unknown>) => {
      setupContext(cmdOptions);
      try {
        outputService.progress(`Fetching ${pluralName}...`);
        const items = await apiMethods.list();
        if (
          process.env.OBS_JSON_OUTPUT === 'true' ||
          cmdOptions.format === 'json' ||
          cmdOptions.json === true
        ) {
          outputService.formatJsonOutput(items);
        } else {
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
    .description(`Get details of a ${resourceName}`)
    .option('-j, --json', 'Output in JSON format')
    .action(async (id: string, cmdOptions: Record<string, unknown>) => {
      setupContext(cmdOptions);
      try {
        const resourceId = parseInt(id);
        if (isNaN(resourceId)) {
          outputService.error(`Invalid ${resourceName} ID.`);
          process.exit(1);
        }
        outputService.progress(`Fetching ${resourceName} ${resourceId}...`);
        const item = await apiMethods.get(resourceId);
        if (process.env.OBS_JSON_OUTPUT === 'true' || cmdOptions.json === true) {
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

  if (options.createCommandSetup) {
    options.createCommandSetup(createCmd);
  }

  createCmd.action(async (cmdOptions: Record<string, unknown>) => {
    setupContext(cmdOptions);
    try {
      let payload: Partial<T> = cmdOptions as unknown as Partial<T>;
      if (options.createPrompts) {
        payload = await options.createPrompts(cmdOptions);
      }

      outputService.progress(`Creating ${resourceName}...`);
      const newItem = await apiMethods.create(payload);

      if (process.env.OBS_JSON_OUTPUT === 'true' || cmdOptions.json === true) {
        outputService.formatJsonOutput(newItem);
      } else {
        outputService.success(
          `${resourceName.charAt(0).toUpperCase() + resourceName.slice(1)} "${newItem.name}" created successfully (ID: ${newItem.id})`
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
    .description(`Update a ${resourceName}`)
    .option('-j, --json', 'Output in JSON format');

  if (options.updateCommandSetup) {
    options.updateCommandSetup(updateCmd);
  }

  updateCmd.action(async (id: string, cmdOptions: Record<string, unknown>) => {
      setupContext(cmdOptions);
      try {
        const resourceId = parseInt(id);
        if (isNaN(resourceId)) {
          outputService.error(`Invalid ${resourceName} ID.`);
          process.exit(1);
        }

        outputService.progress(`Updating ${resourceName} ${resourceId}...`);
        const existing = await apiMethods.get(resourceId);

        let payload: Partial<T> = cmdOptions as unknown as Partial<T>;
        if (options.updatePrompts) {
          payload = await options.updatePrompts(resourceId, cmdOptions, existing);
        }

        const updatedItem = await apiMethods.update(resourceId, payload);
        if (process.env.OBS_JSON_OUTPUT === 'true' || cmdOptions.json === true) {
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
    .description(`Delete a ${resourceName}`)
    .option('-y, --yes', 'Skip confirmation prompt')
    .option('-j, --json', 'Output in JSON format')
    .action(async (id: string, cmdOptions: Record<string, unknown>) => {
      setupContext(cmdOptions);
      try {
        const resourceId = parseInt(id);
        if (isNaN(resourceId)) {
          outputService.error(`Invalid ${resourceName} ID.`);
          process.exit(1);
        }

        if (!cmdOptions.yes) {
          const { confirm } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: `Are you sure you want to delete ${resourceName} ${resourceId}?`,
              default: false,
            },
          ]);
          if (!confirm) {
            outputService.info('Deletion cancelled.');
            return;
          }
        }

        outputService.progress(`Deleting ${resourceName} ${resourceId}...`);
        await apiMethods.delete(resourceId);

        if (process.env.OBS_JSON_OUTPUT === 'true' || cmdOptions.json === true) {
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
      .description(`Pause or resume a ${resourceName}`)
      .option('-j, --json', 'Output in JSON format')
      .action(async (id: string, cmdOptions: Record<string, unknown>) => {
        setupContext(cmdOptions);
        try {
          const resourceId = parseInt(id);
          if (isNaN(resourceId)) {
            outputService.error(`Invalid ${resourceName} ID.`);
            process.exit(1);
          }
          outputService.progress(`Toggling ${resourceName} ${resourceId}...`);
          const isActive = await apiMethods.toggle!(resourceId);

          if (process.env.OBS_JSON_OUTPUT === 'true' || cmdOptions.json === true) {
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
