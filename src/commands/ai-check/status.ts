import { Command } from 'commander';
import { IConfigService } from '../../interfaces/config.interface.js';
import { IApiClient } from '../../interfaces/api-client.interface.js';
import { IOutputService } from '../../interfaces/output.interface.js';

export function createAiCheckStatusCommand(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService
): Command {
  return new Command('status')
    .description('Get the status of a browser check execution')
    .argument('<execution-id>', 'Execution ID')
    .option('-j, --json', 'Output in JSON format')
    .action(async (executionId: string, options: Record<string, unknown>) => {
      if (process.env.OBS_JSON_OUTPUT === 'true' || options.json === true) {
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

        outputService.progress(`Fetching execution status for ${id}...`);
        const execution = await apiClient.getExecutionStatus(id);
        outputService.formatJsonOutput(execution);
      } catch (error: unknown) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });
}
