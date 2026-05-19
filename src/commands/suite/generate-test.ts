import { Command } from 'commander';
import chalk from 'chalk';
import { ApiClient } from '../../services/api-client.service.js';
import { IConfigService } from '../../interfaces/config.interface.js';
import { IOutputService } from '../../interfaces/output.interface.js';

export function createSuiteGenerateTestCommand(
  _configService: IConfigService,
  apiClient: ApiClient,
  outputService: IOutputService
): Command {
  return new Command('generate-test')
    .description('Generate a single test from one planned file in a suite')
    .argument('<suite-id>', 'Suite ID')
    .requiredOption('--planned-file <file>', 'Planned file path to generate a test for')
    .action(async (suiteId: string, options: { plannedFile: string }) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const result = await apiClient.generateTest(suiteId, options.plannedFile);
        if (isJson) {
          outputService.formatJsonOutput({ ...result, suiteId, plannedFile: options.plannedFile });
          return;
        }
        console.log(
          chalk.green(
            `\n✓ Test generation queued for ${options.plannedFile} (test ${result.testId}).\n`
          )
        );
      } catch (err: unknown) {
        const msg = (err as Error).message || 'Failed to generate test';
        if (isJson) {
          outputService.formatJsonOutput({ status: 'ERROR', error: { message: msg } });
        } else {
          console.error(chalk.red(`\n❌ ${msg}\n`));
        }
        process.exit(1);
      }
    });
}
