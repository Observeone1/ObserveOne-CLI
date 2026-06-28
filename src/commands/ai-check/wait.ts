import { Command } from 'commander';
import ora from 'ora';
import { IConfigService } from '../../interfaces/config.interface.js';
import { IApiClient } from '../../interfaces/api-client.interface.js';
import { IOutputService } from '../../interfaces/output.interface.js';

export function createAiCheckWaitCommand(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService
): Command {
  return new Command('wait')
    .description('Wait for a browser check execution to complete')
    .argument('<execution-id>', 'Execution ID')
    .option('-j, --json', 'Output in JSON format')
    .option('-t, --timeout <ms>', 'Max time to wait in milliseconds', '300000')
    .action(async (executionId: string, options: Record<string, unknown>) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true' || options.json === true;
      if (isJson) {
        outputService.enableJsonMode();
      }
      try {
        const apiKey = configService.getApiKey();
        if (!apiKey) {
          outputService.error('Not authenticated. Please run "obs login" first.');
          process.exit(1);
        }

        const id = parseInt(executionId);
        if (isNaN(id)) {
          outputService.error('Invalid execution ID. Must be a numeric ID from a named check run.');
          process.exit(1);
        }

        const timeoutMs = parseInt(options.timeout as string) || 300000;
        const intervalMs = 5000;
        const maxAttempts = Math.ceil(timeoutMs / intervalMs);

        const spinner = isJson ? null : ora(`Waiting for execution ${id}...`).start();

        const execution = await apiClient.pollExecutionStatus(id, maxAttempts, intervalMs);

        if (spinner) {
          if (execution.status === 'SUCCESS') {
            spinner.succeed(`Execution ${id} completed successfully.`);
          } else {
            spinner.fail(`Execution ${id} ended with status: ${execution.status}`);
          }
        }

        let results: unknown[] | undefined;
        if (execution.status === 'SUCCESS') {
          try {
            results = await apiClient.getExecutionResults(id);
          } catch {
            // results are optional
          }
        }

        if (isJson) {
          const payload = { execution, ...(results !== undefined && { results }) };
          outputService.formatJsonOutput(payload);
        }

        if (execution.status !== 'SUCCESS') {
          process.exit(1);
        }
      } catch (error: unknown) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });
}
