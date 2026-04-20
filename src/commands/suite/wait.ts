import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ApiClient } from '../../services/api-client.service.js';
import { IConfigService } from '../../interfaces/config.interface.js';
import { IOutputService } from '../../interfaces/output.interface.js';
import { printExecutionResults } from './formatters.js';

export function createSuiteWaitCommand(
  _configService: IConfigService,
  apiClient: ApiClient,
  outputService: IOutputService
): Command {
  return new Command('wait')
    .description('Wait for a suite execution to complete (CI-friendly)')
    .argument('<id>', 'Suite ID')
    .argument('<executionId>', 'Execution ID')
    .action(async (id: string, executionId: string) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const spinner = ora({ text: 'Waiting for execution to complete...', stream: process.stdout }).start();

        const done = await apiClient.pollSuiteExecution(id, executionId);

        spinner.stop();

        if (isJson) {
          outputService.formatJsonOutput({ execution: done });
        } else {
          printExecutionResults(done);
        }

        const allPassed = done.status === 'COMPLETED' && (done.failed ?? 0) === 0;
        process.exit(allPassed ? 0 : 1);
      } catch (err: unknown) {
        const msg = (err as Error).message || 'Failed to wait for suite execution';
        if (isJson) {
          outputService.formatJsonOutput({ status: 'ERROR', error: { message: msg } });
        } else {
          console.error(chalk.red(`❌ ${msg}`));
        }
        process.exit(1);
      }
    });
}
