import { Command } from 'commander';
import chalk from 'chalk';
import { ApiClient } from '../../services/api-client.service.js';
import { IConfigService } from '../../interfaces/config.interface.js';
import { IOutputService } from '../../interfaces/output.interface.js';

export function createSuiteEnvVarsCommand(
  _configService: IConfigService,
  apiClient: ApiClient,
  outputService: IOutputService
): Command {
  return new Command('env-vars')
    .description(
      'List the variable/credential keys currently configured for a suite (values are never returned)'
    )
    .argument('<id>', 'Suite ID')
    .action(async (id: string) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const { secret_keys } = await apiClient.getSuiteEnvVars(id);

        if (isJson) {
          outputService.formatJsonOutput({ id, secret_keys });
          return;
        }

        if (secret_keys.length === 0) {
          console.log(chalk.gray(`\n No variables configured for suite ${id}.`));
          console.log(chalk.gray(` Set one with: obs suite secrets ${id} --var KEY\n`));
          return;
        }

        console.log(chalk.bold(`\n Suite variables (${secret_keys.length})`));
        console.log(chalk.gray('─'.repeat(40)));
        secret_keys.forEach((key) => console.log(`  ${chalk.yellow(key)}`));
        console.log('');
      } catch (err: unknown) {
        const msg = (err as Error).message || 'Failed to get suite env vars';
        if (isJson) {
          outputService.formatJsonOutput({ status: 'ERROR', error: { message: msg } });
        } else {
          console.error(chalk.red(`❌ ${msg}`));
        }
        process.exit(1);
      }
    });
}
