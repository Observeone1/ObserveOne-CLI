import { Command } from 'commander';
import chalk from 'chalk';
import { ApiClient } from '../../services/api-client.service.js';
import { IConfigService } from '../../interfaces/config.interface.js';
import { IOutputService } from '../../interfaces/output.interface.js';
import { printExecutionResults } from './formatters.js';

export function createSuiteStatusCommand(
  _configService: IConfigService,
  apiClient: ApiClient,
  outputService: IOutputService
): Command {
  return new Command('status')
    .description('Check the status of a suite execution (defaults to latest)')
    .argument('<id>', 'Suite ID')
    .argument('[executionId]', 'Execution ID (optional, defaults to latest)')
    .action(async (id: string, executionId?: string) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        let resolvedExecId: string;
        if (executionId) {
          resolvedExecId = executionId;
        } else {
          const executions = await apiClient.listSuiteExecutions(id);
          const latest = executions[0];
          if (!latest) {
            const msg = 'No executions found for this suite. Run: obs suite run <id>';
            if (isJson) {
              outputService.formatJsonOutput({ status: 'ERROR', error: { message: msg } });
            } else {
              console.log(chalk.gray(`\n ${msg}\n`));
            }
            return;
          }
          resolvedExecId = latest.id;
        }

        const execution = await apiClient.getSuiteExecution(id, resolvedExecId);

        if (isJson) {
          outputService.formatJsonOutput({ execution });
          return;
        }

        const lastRun = new Date(execution.created_at).toLocaleString();
        console.log(chalk.gray(`\n Last run: ${lastRun}`));
        printExecutionResults(execution);
      } catch (err: unknown) {
        const msg = (err as Error).message || 'Failed to get suite status';
        if (isJson) {
          outputService.formatJsonOutput({ status: 'ERROR', error: { message: msg } });
        } else {
          console.error(chalk.red(`❌ ${msg}`));
        }
        process.exit(1);
      }
    });
}
