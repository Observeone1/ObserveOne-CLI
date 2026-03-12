import { Command } from 'commander';
import { IConfigService } from '../interfaces/config.interface.js';
import { IApiClient } from '../interfaces/api-client.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';

/**
 * Factory function to create list command with direct service injection
 */
export function createListCommand(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService
): Command {
  return new Command('list')
    .description('List all AI browser checks')
    .option('-f, --format <format>', 'Output format (table, json)', 'table')
    .option('--api-url <url>', 'Override API URL')
    .option('--api-key <key>', 'Override API key')
    .action(async (options) => {
      try {
        // Handle API URL override first, before other operations
        if (options.apiUrl) {
          configService.setCommandLineApiUrl(options.apiUrl);
        }

        // Handle API key override
        if (options.apiKey) {
          configService.setApiKey(options.apiKey);
        }

        const apiKey = configService.getApiKey();
        if (!apiKey) {
          outputService.error('Not authenticated. Please run "obs login" first.');
          process.exit(1);
        }

        outputService.progress('Fetching tests...');

        const tests = await apiClient.getTests();

        if (process.env.OBS_JSON_OUTPUT === 'true' || options.format === 'json') {
          outputService.formatJsonOutput(tests);
        } else {
          const isVerbose = process.env.OBS_VERBOSE === 'true';
          outputService.formatTestList(tests, isVerbose);
        }
      } catch (error: any) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });
}
