import { Command } from 'commander';
import chalk from 'chalk';
import { ApiClient } from '../../services/api-client.service.js';
import { IConfigService } from '../../interfaces/config.interface.js';
import { IOutputService } from '../../interfaces/output.interface.js';

export function createSuiteHealHistoryCommand(
  _configService: IConfigService,
  apiClient: ApiClient,
  outputService: IOutputService
): Command {
  return new Command('heal-history')
    .description('Show the heal event history for a test heal')
    .argument('<test-id>', 'Test ID')
    .requiredOption('--heal-id <id>', 'Heal ID (from a heal run)')
    .action(async (testId: string, options: { healId: string }) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const history = await apiClient.testHealHistory(testId, options.healId);
        if (isJson) {
          outputService.formatJsonOutput({ history });
          return;
        }
        if (!history.length) {
          console.log(chalk.gray('\n No heal history found.\n'));
          return;
        }
        console.log(chalk.bold(`\n Heal history for test ${testId} (heal ${options.healId})\n`));
        history.forEach((event, i) => {
          console.log(chalk.white(` ${i + 1}. `) + JSON.stringify(event));
        });
        console.log('');
      } catch (err: unknown) {
        const msg = (err as Error).message || 'Failed to fetch heal history';
        if (isJson) {
          outputService.formatJsonOutput({ status: 'ERROR', error: { message: msg } });
        } else {
          console.error(chalk.red(`\n❌ ${msg}\n`));
        }
        process.exit(1);
      }
    });
}
