import { Command } from 'commander';
import chalk from 'chalk';
import { IConfigService } from '../interfaces/config.interface.js';
import { IApiClient } from '../interfaces/api-client.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';
import { ApiClient } from '../services/api-client.service.js';
import { createResourceCommand } from './resource-command.factory.js';
import { Environment } from '../types/index.js';
import { collectOptionValues, parseKeyValuePairs } from '../utils/cli-input.js';

/**
 * Factory for the `obs environment` command. Environments are named sets of
 * variables + a base URL that monitors/checks resolve against. They have no
 * toggle/run surface, so this wraps the generic resource factory (CRUD only)
 * and adds a dedicated `secrets` subcommand for the write-only secrets endpoint.
 */
export function createEnvironmentCommand(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService
): Command {
  const cmd = createResourceCommand<Environment>(configService, apiClient, outputService, {
    resourceName: 'environment',
    pluralName: 'environments',
    description: 'Manage environments (variables + base URL for monitors/checks)',
    apiMethods: {
      list: () => apiClient.getEnvironments(),
      get: (id) => apiClient.getEnvironment(id),
      create: (data) => apiClient.createEnvironment(data),
      update: (id, data) => apiClient.updateEnvironment(id, data),
      delete: (id) => apiClient.deleteEnvironment(id),
      // No toggle: environments have no active/paused state.
    },
    formatters: {
      list: (items, verbose) => outputService.formatEnvironmentList(items, verbose),
    },
    createCommandSetup: (createCmd) => {
      createCmd
        .option('-n, --name <name>', 'Environment name')
        .option('--base-url <url>', 'Base URL used by monitors/checks in this environment')
        .option('--project-id <id>', 'Attach the environment to a project (UUID)')
        .option(
          '--var <KEY=VALUE>',
          'Plaintext variable (repeatable). Use `obs environment secrets` for secrets.',
          collectOptionValues,
          []
        );
    },
    updateCommandSetup: (updateCmd) => {
      updateCmd
        .option('-n, --name <name>', 'Environment name')
        .option('--base-url <url>', 'Base URL used by monitors/checks in this environment')
        .option(
          '--var <KEY=VALUE>',
          'Replace the plaintext variables (repeatable). Omit to leave unchanged.',
          collectOptionValues,
          []
        );
    },
    // createPrompts/updatePrompts intentionally omitted — the resource-command
    // factory falls back to the schema-driven default built from
    // schemas.environment.fieldMetadata.
  });

  cmd
    .command('secrets <id>')
    .description('Set write-only secrets for an environment (an empty value deletes a key)')
    .option(
      '--secret <KEY=VALUE>',
      'Secret to set (repeatable). `--secret KEY=` deletes the key.',
      collectOptionValues,
      []
    )
    .option('-j, --json', 'Output in JSON format')
    .action(async (id: string, cmdOptions: Record<string, unknown>) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true' || cmdOptions.json === true;
      if (isJson) outputService.enableJsonMode();
      try {
        const environmentId = id.trim();
        if (!environmentId) throw new Error('Invalid environment ID');

        const secrets = parseKeyValuePairs(
          cmdOptions.secret as string | string[] | undefined,
          'secret'
        );
        if (!secrets || Object.keys(secrets).length === 0) {
          throw new Error('Provide at least one secret with --secret KEY=VALUE.');
        }

        const result = await (apiClient as ApiClient).updateEnvironmentSecrets(
          environmentId,
          secrets
        );

        if (isJson) {
          outputService.formatJsonOutput({ id: environmentId, secret_keys: result.secret_keys });
          return;
        }
        outputService.success(
          `Secrets updated for environment ${environmentId}. Keys: ${
            result.secret_keys.length > 0 ? result.secret_keys.join(', ') : '(none)'
          }`
        );
      } catch (err: unknown) {
        const msg = (err as Error).message || 'Failed to update secrets';
        if (isJson) {
          outputService.formatJsonOutput({ status: 'ERROR', error: { message: msg } });
        } else {
          console.error(chalk.red(`\n ${msg}\n`));
        }
        process.exit(1);
      }
    });

  cmd.name('environment').alias('env');

  cmd.commands
    .find((c) => c.name() === 'create')
    ?.addHelpText(
      'after',
      `
Examples:
  $ obs environment create --name production --base-url https://api.example.com --var REGION=us-east
  $ obs environment secrets <id> --secret API_TOKEN=xyz --secret OLD_KEY=
  $ obs environment create --file environment.json
`
    );

  return cmd;
}
