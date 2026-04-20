import { Command } from 'commander';
import chalk from 'chalk';
import { ApiClient } from '../../services/api-client.service.js';
import { IConfigService } from '../../interfaces/config.interface.js';
import { IOutputService } from '../../interfaces/output.interface.js';
import { mergeVars } from './vars.js';

export function createSuiteSecretsCommand(
  _configService: IConfigService,
  apiClient: ApiClient,
  outputService: IOutputService
): Command {
  return new Command('secrets')
    .description('Update credentials/variables for a suite')
    .argument('<id>', 'Suite ID')
    .option(
      '--var <KEY=VALUE>',
      'Variable/credential (repeatable)',
      (v, prev: string[]) => [...prev, v],
      [] as string[]
    )
    .option('--var-file <path>', 'Load variables from a .env file')
    .action(async (id: string, options: { var: string[]; varFile?: string }) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const secrets = mergeVars(options.var, options.varFile);
        if (!secrets || Object.keys(secrets).length === 0) {
          throw new Error('Provide at least one --var KEY=VALUE or --var-file');
        }

        await apiClient.updateSuiteSecrets(id, secrets);

        if (isJson) {
          outputService.formatJsonOutput({ id, updated: Object.keys(secrets) });
        } else {
          console.log(chalk.bold(`\n Suite secrets updated`));
          console.log(chalk.gray(` Keys: ${Object.keys(secrets).join(', ')}\n`));
        }
      } catch (err: unknown) {
        const msg = (err as Error).message || 'Failed to update suite secrets';
        if (isJson) {
          outputService.formatJsonOutput({ status: 'ERROR', error: { message: msg } });
        } else {
          console.error(chalk.red(`\n❌ ${msg}\n`));
        }
        process.exit(1);
      }
    });
}
