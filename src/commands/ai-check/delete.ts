import { Command } from 'commander';
import inquirer from 'inquirer';
import { IConfigService } from '../../interfaces/config.interface.js';
import { IApiClient } from '../../interfaces/api-client.interface.js';
import { IOutputService } from '../../interfaces/output.interface.js';

export function createAiCheckDeleteCommand(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService
): Command {
  return new Command('delete')
    .description('Delete an AI browser check')
    .argument('<id>', 'Check ID')
    .option('-y, --yes', 'Skip confirmation prompt')
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

        if (!options.yes) {
          const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
            {
              type: 'confirm',
              name: 'confirm',
              message: `Are you sure you want to delete AI check ${testId}?`,
              default: false,
            },
          ]);
          if (!confirm) return;
        }

        outputService.progress(`Deleting AI check ${testId}...`);
        await apiClient.deleteTest(testId);
        if (process.env.OBS_JSON_OUTPUT === 'true') {
          outputService.formatJsonOutput({ success: true, id: testId });
        } else {
          outputService.success(`AI check ${testId} deleted successfully.`);
        }
      } catch (error: unknown) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });
}
