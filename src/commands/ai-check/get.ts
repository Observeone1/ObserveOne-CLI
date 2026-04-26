import { Command } from 'commander';
import { IConfigService } from '../../interfaces/config.interface.js';
import { IApiClient } from '../../interfaces/api-client.interface.js';
import { IOutputService } from '../../interfaces/output.interface.js';

export function createAiCheckGetCommand(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService
): Command {
  return new Command('get')
    .description('Get details of an AI browser check')
    .argument('<id>', 'Check ID')
    .option('-j, --json', 'Output in JSON format')
    .action(async (id: string, options: Record<string, unknown>) => {
      if (process.env.OBS_JSON_OUTPUT === 'true' || options.json === true) {
        outputService.enableJsonMode();
      }
      try {
        const apiKey = configService.getApiKey();
        if (!apiKey) {
          outputService.error('Not authenticated. Please run "obs login" first.');
          process.exit(1);
        }

        const testId = parseInt(id);
        if (isNaN(testId)) {
          outputService.error('Invalid test ID.');
          process.exit(1);
        }

        outputService.progress(`Fetching AI check ${testId}...`);
        const testData = await apiClient.getTest(testId);

        if (process.env.OBS_JSON_OUTPUT === 'true' || options.json === true) {
          outputService.formatJsonOutput(testData);
        } else {
          outputService.formatTestList([testData], true);
        }
      } catch (error: unknown) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });
}
