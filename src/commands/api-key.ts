import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { IConfigService } from '../interfaces/config.interface.js';
import { IApiClient } from '../interfaces/api-client.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';
import { requireConfirmation } from '../utils/confirm.js';

export function createApiKeyCommand(
  _configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService
): Command {
  const cmd = new Command('api-key').description('Manage API keys');

  // obs api-key list [--json]
  cmd
    .command('list')
    .description('List all API keys')
    .action(async () => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const apiKeys = await apiClient.getApiKeys();
        if (isJson) {
          outputService.formatJsonOutput({ apiKeys });
          return;
        }
        if (apiKeys.length === 0) {
          console.log(chalk.gray('\n No API keys found.\n'));
          return;
        }
        console.log(chalk.bold('\n API Keys\n'));
        for (const key of apiKeys) {
          const status = key.is_active ? chalk.green('active') : chalk.gray('inactive');
          console.log(chalk.white(` ${key.name}`) + chalk.gray(` [${key.id}]`) + ` — ${status}`);
        }
        console.log('');
      } catch (err: unknown) {
        const msg = (err as Error).message || 'Failed to list API keys';
        if (isJson) {
          outputService.formatJsonOutput({ status: 'ERROR', error: { message: msg } });
        } else {
          console.error(chalk.red(`\n❌ ${msg}\n`));
        }
        process.exit(1);
      }
    });

  // obs api-key create --name <name> [--json]
  cmd
    .command('create')
    .description('Create a new API key')
    .option('-n, --name <name>', 'API key name')
    .action(async (options: { name?: string }) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        let name = options.name;
        if (!name) {
          const answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'name',
              message: 'API key name:',
              validate: (val: string) => (val.trim() ? true : 'Name is required'),
            },
          ]);
          name = answers.name as string;
        }
        const apiKey = await apiClient.createApiKey(name!);
        if (isJson) {
          outputService.formatJsonOutput({ apiKey });
          return;
        }
        console.log(chalk.green(`\n✓ API key created: ${apiKey.name} [${apiKey.id}]\n`));
      } catch (err: unknown) {
        const msg = (err as Error).message || 'Failed to create API key';
        if (isJson) {
          outputService.formatJsonOutput({ status: 'ERROR', error: { message: msg } });
        } else {
          console.error(chalk.red(`\n❌ ${msg}\n`));
        }
        process.exit(1);
      }
    });

  // obs api-key revoke <id> [-y] [--json]  (also works as: obs api-key delete <id>)
  cmd
    .command('revoke <id>')
    .alias('delete')
    .description('Revoke (delete) an API key')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (id: string, options: { yes?: boolean }) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const confirmed = await requireConfirmation(
          `Are you sure you want to revoke API key ${id}?`,
          {
            yes: options.yes,
            isJson,
            outputError: (msg) => outputService.error(msg),
          }
        );
        if (!confirmed) {
          console.log(chalk.gray(' Revoke cancelled.'));
          return;
        }
        const result = await apiClient.deleteApiKey(id);
        if (isJson) {
          outputService.formatJsonOutput(result);
          return;
        }
        console.log(chalk.green(`\n✓ ${result.message || `API key ${id} revoked.`}\n`));
      } catch (err: unknown) {
        const msg = (err as Error).message || 'Failed to revoke API key';
        if (isJson) {
          outputService.formatJsonOutput({ status: 'ERROR', error: { message: msg } });
        } else {
          console.error(chalk.red(`\n❌ ${msg}\n`));
        }
        process.exit(1);
      }
    });

  // obs api-key toggle <id> [--json]
  cmd
    .command('toggle <id>')
    .description('Toggle an API key active/inactive')
    .action(async (id: string) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const result = await apiClient.toggleApiKey(id);
        if (isJson) {
          outputService.formatJsonOutput(result);
          return;
        }
        const status = result.apiKey?.is_active ? chalk.green('active') : chalk.gray('inactive');
        console.log(chalk.bold(`\n✓ ${result.message || 'Toggled.'} Status: ${status}\n`));
      } catch (err: unknown) {
        const msg = (err as Error).message || 'Failed to toggle API key';
        if (isJson) {
          outputService.formatJsonOutput({ status: 'ERROR', error: { message: msg } });
        } else {
          console.error(chalk.red(`\n❌ ${msg}\n`));
        }
        process.exit(1);
      }
    });

  // obs api-key rotate <id> [-y] [--json]
  cmd
    .command('rotate <id>')
    .description('Rotate an API key: create a new key with the same name, then revoke the old one')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (id: string, options: { yes?: boolean }) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const confirmed = await requireConfirmation(
          `Rotate API key ${id}? This creates a new key and revokes the old one.`,
          {
            yes: options.yes,
            isJson,
            outputError: (msg) => outputService.error(msg),
          }
        );
        if (!confirmed) {
          console.log(chalk.gray(' Rotate cancelled.'));
          return;
        }

        const existing = (await apiClient.getApiKeys()).find((k) => String(k.id) === String(id));
        if (!existing) throw new Error(`API key ${id} not found`);

        // Create the replacement BEFORE revoking the old key so there is no
        // window where the caller has no working key.
        const created = await apiClient.createApiKey(existing.name);

        let oldKeyRevoked = true;
        let revokeWarning: string | undefined;
        try {
          await apiClient.deleteApiKey(id);
        } catch (revokeErr: unknown) {
          oldKeyRevoked = false;
          revokeWarning = (revokeErr as Error).message || `Failed to revoke old key ${id}`;
        }

        if (isJson) {
          outputService.formatJsonOutput({
            apiKey: created,
            rotatedFrom: id,
            oldKeyRevoked,
            ...(revokeWarning ? { warning: revokeWarning } : {}),
          });
          return;
        }
        console.log(chalk.green(`\n✓ API key rotated: ${created.name} [${created.id}]`));
        if (created.key) {
          console.log(
            chalk.bold(`  New key: ${created.key}`) +
              chalk.yellow('  (save it now — it will not be shown again)')
          );
        }
        if (oldKeyRevoked) {
          console.log(chalk.gray(`  Old key ${id} revoked.\n`));
        } else {
          console.log(
            chalk.yellow(
              `\n⚠ New key created, but the old key ${id} was NOT revoked: ${revokeWarning}\n` +
                `  Revoke it manually: obs api-key revoke ${id}\n`
            )
          );
        }
      } catch (err: unknown) {
        const msg = (err as Error).message || 'Failed to rotate API key';
        if (isJson) {
          outputService.formatJsonOutput({ status: 'ERROR', error: { message: msg } });
        } else {
          console.error(chalk.red(`\n❌ ${msg}\n`));
        }
        process.exit(1);
      }
    });

  return cmd;
}
