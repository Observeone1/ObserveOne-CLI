import { Command } from 'commander';
import chalk from 'chalk';
import { ApiClient } from '../../services/api-client.service.js';
import { IConfigService } from '../../interfaces/config.interface.js';
import { IOutputService } from '../../interfaces/output.interface.js';

export function createSuiteRestorePlannedCommand(
  _configService: IConfigService,
  apiClient: ApiClient,
  outputService: IOutputService
): Command {
  return new Command('restore-planned')
    .description('Restore a previously dismissed planned file in a suite')
    .argument('<suite-id>', 'Suite ID')
    .requiredOption('--planned-file <file>', 'Planned file path to restore')
    .action(async (suiteId: string, options: { plannedFile: string }) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const result = await apiClient.restorePlannedFile(suiteId, options.plannedFile);
        if (isJson) {
          outputService.formatJsonOutput({ ...result, suiteId, plannedFile: options.plannedFile });
          return;
        }
        console.log(chalk.green(`\n✓ Planned file restored: ${options.plannedFile}\n`));
      } catch (err: unknown) {
        const msg = (err as Error).message || 'Failed to restore planned file';
        if (isJson) {
          outputService.formatJsonOutput({ status: 'ERROR', error: { message: msg } });
        } else {
          console.error(chalk.red(`\n❌ ${msg}\n`));
        }
        process.exit(1);
      }
    });
}
