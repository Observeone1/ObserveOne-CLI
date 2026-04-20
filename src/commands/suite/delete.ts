import { Command } from 'commander';
import chalk from 'chalk';
import { ApiClient } from '../../services/api-client.service.js';
import { IConfigService } from '../../interfaces/config.interface.js';
import { IOutputService } from '../../interfaces/output.interface.js';

export function createSuiteDeleteCommand(
  _configService: IConfigService,
  apiClient: ApiClient,
  outputService: IOutputService
): Command {
  return new Command('delete')
    .description('Delete a suite')
    .argument('<id>', 'Suite ID')
    .action(async (id: string) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const suite = await apiClient.getSuite(id);
        await apiClient.deleteSuite(id);
        if (isJson) {
          outputService.formatJsonOutput({ id, name: suite.suite_name });
        } else {
          console.log(chalk.green(`\n Deleted suite: ${suite.suite_name} (${id})\n`));
        }
      } catch (err: unknown) {
        const msg = (err as Error).message || 'Failed to delete suite';
        if (isJson) {
          outputService.formatJsonOutput({ status: 'ERROR', error: { message: msg } });
        } else {
          console.error(chalk.red(`❌ ${msg}`));
        }
        process.exit(1);
      }
    });
}
