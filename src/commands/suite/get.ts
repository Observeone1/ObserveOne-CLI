import { Command } from 'commander';
import chalk from 'chalk';
import { ApiClient } from '../../services/api-client.service.js';
import { IConfigService } from '../../interfaces/config.interface.js';
import { IOutputService } from '../../interfaces/output.interface.js';
import { printSuiteDetail } from './formatters.js';

export function createSuiteGetCommand(
  _configService: IConfigService,
  apiClient: ApiClient,
  outputService: IOutputService
): Command {
  return new Command('get')
    .description('Get details of a suite')
    .argument('<id>', 'Suite ID')
    .action(async (id: string) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const suite = await apiClient.getSuite(id);
        if (isJson) {
          outputService.formatJsonOutput({ suite });
          return;
        }
        printSuiteDetail(suite);
      } catch (err: unknown) {
        const msg = (err as Error).message || 'Failed to get suite';
        if (isJson) {
          outputService.formatJsonOutput({ status: 'ERROR', error: { message: msg } });
        } else {
          console.error(chalk.red(`❌ ${msg}`));
        }
        process.exit(1);
      }
    });
}
