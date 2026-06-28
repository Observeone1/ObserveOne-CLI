import { Command } from 'commander';
import chalk from 'chalk';
import { ApiClient } from '../../services/api-client.service.js';
import { IConfigService } from '../../interfaces/config.interface.js';
import { IOutputService } from '../../interfaces/output.interface.js';
import { resolveVars } from './vars.js';

export function createSuiteSecretsCommand(
  _configService: IConfigService,
  apiClient: ApiClient,
  outputService: IOutputService
): Command {
  return new Command('secrets')
    .description(
      'Update credentials/variables for a suite. Pass --var KEY (no value) to be ' +
        'prompted securely (masked) instead of putting secrets on the command line, ' +
        'or load them from an uncommitted file with --var-file.'
    )
    .argument('<id>', 'Suite ID')
    .option(
      '--var <KEY[=VALUE]>',
      'Variable/credential (repeatable). Omit =VALUE (e.g. --var API_TOKEN) to be prompted securely.',
      (v, prev: string[]) => [...prev, v],
      [] as string[]
    )
    .option(
      '--var-file <path>',
      'Load variables from an uncommitted .env file (safer than inline values)'
    )
    .addHelpText(
      'after',
      `
Examples:
  $ obs suite secrets 42 --var API_TOKEN            # prompts for the value (masked)
  $ obs suite secrets 42 --var-file .env.secrets    # never touches shell history
  $ obs suite secrets 42 --var REGION=us-east       # inline (lands in shell history)
`
    )
    .action(async (id: string, options: { var: string[]; varFile?: string }) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const secrets = await resolveVars(options.var, options.varFile, {
          isJson,
          outputError: (msg) => outputService.error(msg),
        });
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
