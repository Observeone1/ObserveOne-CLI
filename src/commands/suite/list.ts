import { Command } from 'commander';
import chalk from 'chalk';
import { ApiClient } from '../../services/api-client.service.js';
import { IConfigService } from '../../interfaces/config.interface.js';
import { IOutputService } from '../../interfaces/output.interface.js';
import { printSuiteList } from './formatters.js';

export function createSuiteListCommand(
  _configService: IConfigService,
  apiClient: ApiClient,
  outputService: IOutputService
): Command {
  return new Command('list')
    .description('List all Playwright Autopilot suites')
    .action(async () => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const suites = await apiClient.listSuites();
        if (isJson) {
          outputService.formatJsonOutput({ suites });
          return;
        }
        printSuiteList(suites);
      } catch (err: unknown) {
        const msg = (err as Error).message || 'Failed to list suites';
        if (isJson) {
          outputService.formatJsonOutput({ status: 'ERROR', error: { message: msg } });
        } else {
          console.error(chalk.red(`❌ ${msg}`));
        }
        process.exit(1);
      }
    });
}
