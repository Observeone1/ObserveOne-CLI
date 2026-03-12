import { Command } from 'commander';
import inquirer from 'inquirer';
import { IConfigService } from '../interfaces/config.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';

export type ResourcePayload = Record<string, unknown>;

export interface ResourcePrompts {
  ensureCreatePayload: (options: Record<string, any>) => Promise<ResourcePayload>;
  ensureUpdatePayload: (
    options: Record<string, any>
  ) => Promise<{ id: number; payload: ResourcePayload }>;
}

export interface ResourceFormatters<T> {
  list: (items: T[], verbose: boolean) => void;
  single?: (item: T, verbose: boolean) => void;
}

export interface ResourceActions<T> {
  list: () => Promise<T[]>;
  get: (id: number) => Promise<T>;
  create: (payload: ResourcePayload) => Promise<T>;
  update: (id: number, payload: ResourcePayload) => Promise<T>;
  remove: (id: number) => Promise<void>;
  toggle?: (id: number) => Promise<boolean>;
}

export interface ResourceConfig<T> {
  name: string;
  description: string;
  prompts: ResourcePrompts;
  formatters: ResourceFormatters<T>;
  actions: ResourceActions<T>;
  onCreateSuccess?: (created: T) => void;
  onUpdateSuccess?: (updated: T) => void;
}

function requireAuth(configService: IConfigService, outputService: IOutputService): void {
  const apiKey = configService.getApiKey();
  if (!apiKey) {
    outputService.error('Not authenticated. Please run "obs login" first.');
    process.exit(1);
  }
}

function parseId(id: string, outputService: IOutputService): number {
  const parsed = Number(id);
  if (Number.isNaN(parsed)) {
    outputService.error('Invalid id. Expected a number.');
    process.exit(1);
  }
  return parsed;
}

export function createResourceCommand<T>(
  config: ResourceConfig<T>,
  services: {
    configService: IConfigService;
    outputService: IOutputService;
  }
): Command {
  const { configService, outputService } = services;
  const resource = new Command(config.name).description(config.description);

  resource
    .command('list')
    .description(`List all ${config.name}s`)
    .option('-f, --format <format>', 'Output format (table, json)', 'table')
    .action(async (options) => {
      if (process.env.OBS_JSON_OUTPUT === 'true' || options.format === 'json') {
        outputService.enableJsonMode();
      }
      try {
        requireAuth(configService, outputService);
        outputService.progress(`Fetching ${config.name}s...`);
        const items = await config.actions.list();
        if (process.env.OBS_JSON_OUTPUT === 'true' || options.format === 'json') {
          outputService.formatJsonOutput(items);
        } else {
          config.formatters.list(items, process.env.OBS_VERBOSE === 'true');
        }
      } catch (error: any) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });

  resource
    .command('get <id>')
    .description(`Get a ${config.name}`)
    .option('-j, --json', 'Output in JSON format')
    .action(async (id, options) => {
      if (process.env.OBS_JSON_OUTPUT === 'true' || options.json) {
        outputService.enableJsonMode();
      }
      try {
        requireAuth(configService, outputService);
        const parsedId = parseId(id, outputService);
        outputService.progress(`Fetching ${config.name} ${parsedId}...`);
        const item = await config.actions.get(parsedId);

        if (process.env.OBS_JSON_OUTPUT === 'true') {
          outputService.formatJsonOutput(item);
        } else if (config.formatters.single) {
          config.formatters.single(item, true);
        } else {
          config.formatters.list([item], true);
        }
      } catch (error: any) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });

  resource
    .command('create')
    .description(`Create a new ${config.name}`)
    .option('-j, --json', 'Output in JSON format')
    .allowUnknownOption()
    .action(async (options) => {
      if (process.env.OBS_JSON_OUTPUT === 'true' || options.json) {
        outputService.enableJsonMode();
      }
      try {
        requireAuth(configService, outputService);
        const payload = await config.prompts.ensureCreatePayload(options);
        outputService.progress(`Creating ${config.name}...`);
        const created = await config.actions.create(payload);

        if (process.env.OBS_JSON_OUTPUT === 'true') {
          outputService.formatJsonOutput(created);
        } else {
          outputService.success(`${config.name} created successfully.`);
          config.onCreateSuccess?.(created);
        }
      } catch (error: any) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });

  resource
    .command('update')
    .description(`Update an existing ${config.name}`)
    .requiredOption('-i, --id <id>', `${config.name} id`)
    .option('-j, --json', 'Output in JSON format')
    .allowUnknownOption()
    .action(async (options) => {
      if (process.env.OBS_JSON_OUTPUT === 'true' || options.json) {
        outputService.enableJsonMode();
      }
      try {
        requireAuth(configService, outputService);
        const { id, payload } = await config.prompts.ensureUpdatePayload(options);
        outputService.progress(`Updating ${config.name} ${id}...`);
        const updated = await config.actions.update(id, payload);

        if (process.env.OBS_JSON_OUTPUT === 'true') {
          outputService.formatJsonOutput(updated);
        } else {
          outputService.success(`${config.name} ${id} updated successfully.`);
          config.onUpdateSuccess?.(updated);
        }
      } catch (error: any) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });

  resource
    .command('delete <id>')
    .description(`Delete a ${config.name}`)
    .option('-y, --yes', 'Skip confirmation prompt')
    .option('-j, --json', 'Output in JSON format')
    .action(async (id, options) => {
      if (process.env.OBS_JSON_OUTPUT === 'true' || options.json) {
        outputService.enableJsonMode();
      }
      try {
        requireAuth(configService, outputService);
        const parsedId = parseId(id, outputService);

        if (!options.yes) {
          const { confirm } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: `Are you sure you want to delete ${config.name} ${parsedId}?`,
              default: false,
            },
          ]);
          if (!confirm) {
            outputService.info('Deletion cancelled.');
            return;
          }
        }

        outputService.progress(`Deleting ${config.name} ${parsedId}...`);
        await config.actions.remove(parsedId);

        if (process.env.OBS_JSON_OUTPUT === 'true') {
          outputService.formatJsonOutput({ success: true, id: parsedId });
        } else {
          outputService.success(`${config.name} ${parsedId} deleted successfully.`);
        }
      } catch (error: any) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });

  if (config.actions.toggle) {
    resource
      .command('toggle <id>')
      .description(`Toggle ${config.name} active state`)
      .option('-j, --json', 'Output in JSON format')
      .action(async (id, options) => {
        if (process.env.OBS_JSON_OUTPUT === 'true' || options.json) {
          outputService.enableJsonMode();
        }
        try {
          requireAuth(configService, outputService);
          const parsedId = parseId(id, outputService);
          outputService.progress(`Toggling ${config.name} ${parsedId}...`);
          const result = await config.actions.toggle!(parsedId);
          if (process.env.OBS_JSON_OUTPUT === 'true') {
            outputService.formatJsonOutput({ id: parsedId, active: result });
          } else {
            outputService.success(
              `${config.name} ${parsedId} is now ${result ? 'active' : 'inactive'}.`
            );
          }
        } catch (error: any) {
          outputService.error(outputService.formatError(error));
          process.exit(1);
        }
      });
  }

  return resource;
}
