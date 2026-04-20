import { Command } from 'commander';
import { IConfigService } from '../../interfaces/config.interface.js';
import { IApiClient } from '../../interfaces/api-client.interface.js';
import { IOutputService } from '../../interfaces/output.interface.js';

export function createAiCheckListCommand(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService
): Command {
  return new Command('list')
    .description('List all AI browser checks')
    .option('-f, --format <format>', 'Output format (table, json)', 'table')
    .option('-j, --json', 'Output in JSON format')
    .action(async (options: Record<string, unknown>) => {
      if (
        process.env.OBS_JSON_OUTPUT === 'true' ||
        options.format === 'json' ||
        options.json === true
      ) {
        outputService.enableJsonMode();
      }
      try {
        const apiKey = configService.getApiKey();
        if (!apiKey) {
          outputService.error('Not authenticated. Please run "obs login" first.');
          process.exit(1);
        }

        outputService.progress('Fetching AI checks...');
        const tests = await apiClient.getTests();

        if (
          process.env.OBS_JSON_OUTPUT === 'true' ||
          options.format === 'json' ||
          options.json === true
        ) {
          outputService.formatJsonOutput(tests);
        } else {
          outputService.formatTestList(tests, process.env.OBS_VERBOSE === 'true');
        }
      } catch (error: unknown) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });
}
