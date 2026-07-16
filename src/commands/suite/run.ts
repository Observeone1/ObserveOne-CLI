import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ApiClient } from '../../services/api-client.service.js';
import { IConfigService } from '../../interfaces/config.interface.js';
import { IOutputService } from '../../interfaces/output.interface.js';
import { printExecutionResults } from './formatters.js';

export function createSuiteRunCommand(
  _configService: IConfigService,
  apiClient: ApiClient,
  outputService: IOutputService
): Command {
  return new Command('run')
    .description('Trigger a suite execution')
    .argument('<id>', 'Suite ID')
    .option('-w, --wait', 'Wait for the execution to complete')
    .option('--tests <ids>', 'Comma-separated list of test IDs to run')
    .action(async (id: string, options: { wait?: boolean; tests?: string }) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      let spinner: ReturnType<typeof ora> | null = null;
      try {
        const testIds = options.tests ? options.tests.split(',').map((s) => s.trim()) : undefined;
        const { execution_id } = await apiClient.runSuite(id, testIds);

        if (!options.wait) {
          if (isJson) {
            outputService.formatJsonOutput({ execution_id });
          } else {
            console.log(chalk.bold(`\n Suite run triggered`));
            console.log(chalk.gray(` Execution ID: ${execution_id}`));
            console.log(chalk.gray(` Wait:         obs suite wait ${id} ${execution_id}\n`));
          }
          return;
        }

        if (!isJson) {
          console.log(chalk.bold(`\n Running suite...`));
          console.log(chalk.gray('─'.repeat(56)));
        }

        spinner = isJson ? null : ora({ text: 'Running...', stream: process.stderr }).start();

        const done = await apiClient.pollSuiteExecution(id, execution_id);

        spinner?.stop();

        if (isJson) {
          outputService.formatJsonOutput({ execution: done });
        } else {
          printExecutionResults(done);
        }

        const allPassed = done.status === 'COMPLETED' && (done.failed ?? 0) === 0;
        process.exit(allPassed ? 0 : 1);
      } catch (err: unknown) {
        spinner?.stop();
        const msg = (err as Error).message || 'Failed to run suite';
        if (isJson) {
          outputService.formatJsonOutput({ status: 'ERROR', error: { message: msg } });
        } else {
          console.error(chalk.red(`\n❌ ${msg}\n`));
        }
        process.exit(1);
      }
    });
}
