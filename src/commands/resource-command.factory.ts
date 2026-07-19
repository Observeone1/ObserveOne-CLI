import { Command } from 'commander';
import { readFileSync, existsSync } from 'node:fs';
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
import { resolveSchema } from '../utils/schemas.js';
import { buildDefaultCreatePrompts, buildDefaultUpdatePrompts } from '../utils/schema-prompts.js';

export interface ResourceFactoryOptions<T> {
  resourceName: string;
  pluralName: string;
  description: string;
  apiMethods: {
    list: () => Promise<T[]>;
    listWithFilters?: (query: ListQueryOptions) => Promise<PaginatedListResult<T>>;
    get: (id: string) => Promise<T>;
    create: (data: Partial<T>) => Promise<T>;
    update: (id: string, data: Partial<T>) => Promise<T>;
    delete: (id: string) => Promise<void>;
    toggle?: (id: string) => Promise<boolean>;
  };
  formatters: {
    list: (items: T[], verbose: boolean) => void;
  };
  createCommandSetup?: (cmd: Command) => void;
  updateCommandSetup?: (cmd: Command) => void;
  createPrompts?: (options: Record<string, unknown>) => Promise<Partial<T>>;
  updatePrompts?: (
    id: string,
    options: Record<string, unknown>,
    existing: T
  ) => Promise<Partial<T>>;
}

/** Shared per-invocation context threaded into each generated subcommand action. */
interface FactoryContext<T> {
  configService: IConfigService;
  apiClient: IApiClient;
  outputService: IOutputService;
  options: ResourceFactoryOptions<T>;
  article: string;
}

function resolveOptions(cmdOptions: Record<string, unknown> | Command): Record<string, unknown> {
  if (typeof (cmdOptions as Command).opts === 'function') {
    return (cmdOptions as Command).opts();
  }
  return cmdOptions as Record<string, unknown>;
}

function isJsonRequested(resolvedOptions: Record<string, unknown>): boolean {
  return (
    process.env.OBS_JSON_OUTPUT === 'true' ||
    resolvedOptions.json === true ||
    resolvedOptions.output === 'json'
  );
}

/** Consistent auth + JSON mode setup, shared by every generated subcommand. */
function setupContext<T>(
  ctx: FactoryContext<T>,
  cmdOptions: Record<string, unknown>
): { isJson: boolean; apiKey: string | undefined } {
  const isJson = isJsonRequested(cmdOptions);
  if (isJson) {
    ctx.outputService.enableJsonMode();
  }
  const apiKey = ctx.configService.getApiKey();
  if (!apiKey) {
    ctx.outputService.error(
      'Not authenticated. Run "obs login", or set OBS_API_KEY (get a key at https://app.observeone.com/settings/api).'
    );
    process.exit(1);
  }
  return { isJson, apiKey };
}

function titleCase(resourceName: string): string {
  return resourceName.charAt(0).toUpperCase() + resourceName.slice(1);
}

/** Trim an :id path param, or error + exit when it's empty. */
function requireResourceId<T>(ctx: FactoryContext<T>, id: string): string {
  const resourceId = id.trim();
  if (!resourceId) {
    ctx.outputService.error(`Invalid ${ctx.options.resourceName} ID.`);
    process.exit(1);
  }
  return resourceId;
}

async function runList<T extends { id: string; name?: string }>(
  ctx: FactoryContext<T>,
  cmdOptions: Record<string, unknown>
): Promise<void> {
  const { apiMethods, formatters, pluralName } = ctx.options;
  const resolvedOptions = resolveOptions(cmdOptions);
  setupContext(ctx, resolvedOptions);
  try {
    ctx.outputService.progress(`Fetching ${pluralName}...`);
    const paginated = apiMethods.listWithFilters
      ? await apiMethods.listWithFilters(resolveListQueryOptions(resolvedOptions))
      : null;
    const items = paginated?.items ?? (await apiMethods.list());
    if (isJsonRequested(resolvedOptions)) {
      ctx.outputService.formatJsonOutput(
        paginated ? { items: paginated.items, pagination: paginated.pagination } : items
      );
    } else {
      if (paginated) {
        ctx.outputService.info(
          formatPaginationSummary(paginated.pagination, paginated.items.length)
        );
      }
      formatters.list(items, process.env.OBS_VERBOSE === 'true');
    }
  } catch (error: unknown) {
    ctx.outputService.error(ctx.outputService.formatError(error));
    process.exit(1);
  }
}

async function runGet<T extends { id: string; name?: string }>(
  ctx: FactoryContext<T>,
  id: string,
  cmdOptions: Record<string, unknown>
): Promise<void> {
  const { apiMethods, formatters, resourceName } = ctx.options;
  const resolvedOptions = resolveOptions(cmdOptions);
  setupContext(ctx, resolvedOptions);
  try {
    const resourceId = requireResourceId(ctx, id);
    ctx.outputService.progress(`Fetching ${resourceName} ${resourceId}...`);
    const item = await apiMethods.get(resourceId);
    if (process.env.OBS_JSON_OUTPUT === 'true' || resolvedOptions.json === true) {
      ctx.outputService.formatJsonOutput(item);
    } else {
      formatters.list([item], true);
    }
  } catch (error: unknown) {
    ctx.outputService.error(ctx.outputService.formatError(error));
    process.exit(1);
  }
}

/** Resolve the create/update payload from --file, a custom prompts fn, or the schema default. */
async function resolveCreatePayload<T>(
  ctx: FactoryContext<T>,
  resolvedOptions: Record<string, unknown>
): Promise<Partial<T>> {
  const { resourceName, createPrompts } = ctx.options;

  if (resolvedOptions.file) {
    const filePath = resolvedOptions.file as string;
    if (!existsSync(filePath)) {
      ctx.outputService.error(`File not found: ${filePath}`);
      process.exit(1);
    }
    try {
      return JSON.parse(readFileSync(filePath, 'utf-8')) as Partial<T>;
    } catch {
      ctx.outputService.error(`Failed to parse ${filePath} as JSON.`);
      process.exit(1);
    }
  }

  if (createPrompts) {
    return createPrompts(resolvedOptions);
  }

  const schema = resolveSchema(resourceName);
  if (schema?.fieldMetadata) {
    return buildDefaultCreatePrompts<T>(schema)(resolvedOptions);
  }
  return resolvedOptions as unknown as Partial<T>;
}

async function runCreate<T extends { id: string; name?: string }>(
  ctx: FactoryContext<T>,
  cmdOptions: Record<string, unknown>
): Promise<void> {
  const { apiMethods, resourceName } = ctx.options;
  const resolvedOptions = resolveOptions(cmdOptions);
  setupContext(ctx, resolvedOptions);
  try {
    const payload = await resolveCreatePayload(ctx, resolvedOptions);

    ctx.outputService.progress(`Creating ${resourceName}...`);
    const newItem = await apiMethods.create(payload);

    if (process.env.OBS_JSON_OUTPUT === 'true' || resolvedOptions.json === true) {
      ctx.outputService.formatJsonOutput(newItem);
    } else {
      const nameLabel = newItem.name ? `"${newItem.name}"` : `ID ${newItem.id}`;
      const idSuffix = newItem.name ? ` (ID: ${newItem.id})` : '';
      ctx.outputService.success(
        `${titleCase(resourceName)} ${nameLabel} created successfully${idSuffix}.`
      );
    }
  } catch (error: unknown) {
    ctx.outputService.error(ctx.outputService.formatError(error));
    process.exit(1);
  }
}

async function resolveUpdatePayload<T>(
  ctx: FactoryContext<T>,
  resourceId: string,
  resolvedOptions: Record<string, unknown>,
  existing: T
): Promise<Partial<T>> {
  const { resourceName, updatePrompts } = ctx.options;

  if (updatePrompts) {
    return updatePrompts(resourceId, resolvedOptions, existing);
  }

  const schema = resolveSchema(resourceName);
  if (schema?.fieldMetadata) {
    return buildDefaultUpdatePrompts<T>(schema, ctx.outputService)(
      resourceId,
      resolvedOptions,
      existing
    );
  }
  return resolvedOptions as unknown as Partial<T>;
}

async function runUpdate<T extends { id: string; name?: string }>(
  ctx: FactoryContext<T>,
  id: string,
  cmdOptions: Record<string, unknown>
): Promise<void> {
  const { apiMethods, resourceName } = ctx.options;
  const resolvedOptions = resolveOptions(cmdOptions);
  setupContext(ctx, resolvedOptions);
  try {
    const resourceId = requireResourceId(ctx, id);

    ctx.outputService.progress(`Updating ${resourceName} ${resourceId}...`);
    const existing = await apiMethods.get(resourceId);
    const payload = await resolveUpdatePayload(ctx, resourceId, resolvedOptions, existing);

    const updatedItem = await apiMethods.update(resourceId, payload);
    if (process.env.OBS_JSON_OUTPUT === 'true' || resolvedOptions.json === true) {
      ctx.outputService.formatJsonOutput(updatedItem);
    } else {
      ctx.outputService.success(`${titleCase(resourceName)} ${resourceId} updated successfully.`);
    }
  } catch (error: unknown) {
    ctx.outputService.error(ctx.outputService.formatError(error));
    process.exit(1);
  }
}

async function runDelete<T extends { id: string; name?: string }>(
  ctx: FactoryContext<T>,
  id: string,
  cmdOptions: Record<string, unknown>
): Promise<void> {
  const { apiMethods, resourceName } = ctx.options;
  const resolvedOptions = resolveOptions(cmdOptions);
  setupContext(ctx, resolvedOptions);
  try {
    const resourceId = requireResourceId(ctx, id);

    const confirmed = await requireConfirmation(
      `Are you sure you want to delete ${resourceName} ${resourceId}?`,
      {
        yes: resolvedOptions.yes as boolean | undefined,
        isJson: resolvedOptions.json === true || process.env.OBS_JSON_OUTPUT === 'true',
        outputError: (msg) => ctx.outputService.error(msg),
      }
    );
    if (!confirmed) {
      ctx.outputService.info('Deletion cancelled.');
      return;
    }

    ctx.outputService.progress(`Deleting ${resourceName} ${resourceId}...`);
    await apiMethods.delete(resourceId);

    if (process.env.OBS_JSON_OUTPUT === 'true' || resolvedOptions.json === true) {
      ctx.outputService.formatJsonOutput({ success: true, id: resourceId });
    } else {
      ctx.outputService.success(`${titleCase(resourceName)} ${resourceId} deleted successfully.`);
    }
  } catch (error: unknown) {
    ctx.outputService.error(ctx.outputService.formatError(error));
    process.exit(1);
  }
}

async function runToggle<T extends { id: string; name?: string }>(
  ctx: FactoryContext<T>,
  id: string,
  cmdOptions: Record<string, unknown>
): Promise<void> {
  const { apiMethods, resourceName } = ctx.options;
  const resolvedOptions = resolveOptions(cmdOptions);
  setupContext(ctx, resolvedOptions);
  try {
    const resourceId = requireResourceId(ctx, id);
    ctx.outputService.progress(`Toggling ${resourceName} ${resourceId}...`);
    const isActive = await apiMethods.toggle!(resourceId);

    if (process.env.OBS_JSON_OUTPUT === 'true' || resolvedOptions.json === true) {
      ctx.outputService.formatJsonOutput({ id: resourceId, is_active: isActive });
    } else {
      ctx.outputService.success(
        `${titleCase(resourceName)} ${resourceId} is now ${isActive ? 'ACTIVE' : 'PAUSED'}.`
      );
    }
  } catch (error: unknown) {
    ctx.outputService.error(ctx.outputService.formatError(error));
    process.exit(1);
  }
}

/**
 * Factory to generate standardized CRUD subcommands for any resource.
 * This ensures consistent JSON mode detection, error handling, and auth checks.
 */
export function createResourceCommand<T extends { id: string; name?: string }>(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService,
  options: ResourceFactoryOptions<T>
): Command {
  const { resourceName, pluralName, description, apiMethods } = options;
  const cmd = new Command(resourceName).description(description);
  const article = /^[aeiou]/i.test(resourceName) ? 'an' : 'a';
  const ctx: FactoryContext<T> = { configService, apiClient, outputService, options, article };

  // LIST
  const listCmd = cmd
    .command('list')
    .description(`List all ${pluralName}`)
    .option('-o, --output <format>', 'Output format (table, json)', 'table')
    .option('-j, --json', 'Output in JSON format');

  if (apiMethods.listWithFilters) {
    addListQueryOptions(listCmd);
  }

  listCmd.action((cmdOptions: Record<string, unknown>) => runList(ctx, cmdOptions));

  // GET
  cmd
    .command('get <id>')
    .description(`Get details of ${article} ${resourceName}`)
    .option('-j, --json', 'Output in JSON format')
    .action((id: string, cmdOptions: Record<string, unknown>) => runGet(ctx, id, cmdOptions));

  // CREATE
  const createCmd = cmd
    .command('create')
    .description(`Create a new ${resourceName}`)
    .option('-j, --json', 'Output in JSON format');

  createCmd.option('--file <path>', 'Path to JSON file with resource data');

  if (options.createCommandSetup) {
    options.createCommandSetup(createCmd);
  }

  createCmd.action((cmdOptions: Record<string, unknown>) => runCreate(ctx, cmdOptions));

  // UPDATE
  const updateCmd = cmd
    .command('update <id>')
    .description(`Update ${article} ${resourceName}`)
    .option('-j, --json', 'Output in JSON format');

  if (options.updateCommandSetup) {
    options.updateCommandSetup(updateCmd);
  }

  updateCmd.action((id: string, cmdOptions: Record<string, unknown>) =>
    runUpdate(ctx, id, cmdOptions)
  );

  // DELETE
  cmd
    .command('delete <id>')
    .description(`Delete ${article} ${resourceName}`)
    .option('-y, --yes', 'Skip confirmation prompt')
    .option('-j, --json', 'Output in JSON format')
    .action((id: string, cmdOptions: Record<string, unknown>) => runDelete(ctx, id, cmdOptions));

  // TOGGLE (Optional)
  if (apiMethods.toggle) {
    cmd
      .command('toggle <id>')
      .description(`Pause or resume ${article} ${resourceName}`)
      .option('-j, --json', 'Output in JSON format')
      .action((id: string, cmdOptions: Record<string, unknown>) => runToggle(ctx, id, cmdOptions));
  }

  return cmd;
}
