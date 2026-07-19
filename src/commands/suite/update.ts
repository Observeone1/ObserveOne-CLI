import { Command } from 'commander';
import chalk from 'chalk';
import { ApiClient } from '../../services/api-client.service.js';
import { IConfigService } from '../../interfaces/config.interface.js';
import { IOutputService } from '../../interfaces/output.interface.js';
import { printSuiteDetail } from './formatters.js';

export function createSuiteUpdateCommand(
  _configService: IConfigService,
  apiClient: ApiClient,
  outputService: IOutputService
): Command {
  return new Command('update')
    .description('Update suite name, target URL, or planner instructions')
    .argument('<id>', 'Suite ID')
    .option('--name <name>', 'New suite name')
    .option('--url <url>', 'New target URL')
    .option(
      '--instructions <text>',
      'Extra guidance appended to the planner prompt (max 4000 characters). Pass "" to clear.'
    )
    .action(async (id: string, options: { name?: string; url?: string; instructions?: string }) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        if (!options.name && !options.url && options.instructions === undefined) {
          const msg = 'At least one of --name, --url, or --instructions is required';
          if (isJson) {
            outputService.formatJsonOutput({ status: 'ERROR', error: { message: msg } });
          } else {
            console.error(chalk.red(`❌ ${msg}`));
          }
          process.exit(1);
        }

        const payload: {
          suite_name?: string;
          target_url?: string;
          planner_instructions?: string | null;
        } = {};
        if (options.name) payload.suite_name = options.name;
        if (options.url) payload.target_url = options.url;
        if (options.instructions !== undefined) payload.planner_instructions = options.instructions;

        const suite = await apiClient.updateSuite(id, payload);

        if (isJson) {
          outputService.formatJsonOutput({ suite });
          return;
        }

        console.log(chalk.bold('\n Suite updated'));
        printSuiteDetail(suite);
      } catch (err: unknown) {
        const msg = (err as Error).message || 'Failed to update suite';
        if (isJson) {
          outputService.formatJsonOutput({ status: 'ERROR', error: { message: msg } });
        } else {
          console.error(chalk.red(`❌ ${msg}`));
        }
        process.exit(1);
      }
    });
}
