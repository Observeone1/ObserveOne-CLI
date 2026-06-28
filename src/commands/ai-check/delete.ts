import { Command } from 'commander';
import { IConfigService } from '../../interfaces/config.interface.js';
import { IApiClient } from '../../interfaces/api-client.interface.js';
import { IOutputService } from '../../interfaces/output.interface.js';
import { requireConfirmation } from '../../utils/confirm.js';

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

        const testId = parseInt(id);
        if (isNaN(testId)) {
          outputService.error('Invalid test ID.');
          process.exit(1);
        }

        // requireConfirmation handles --yes, JSON mode, and the non-TTY/CI
        // case (exits non-zero instead of hanging on the interactive prompt).
        const confirmed = await requireConfirmation(
          `Are you sure you want to delete AI check ${testId}?`,
          {
            yes: options.yes as boolean | undefined,
            isJson,
            outputError: (msg) => outputService.error(msg),
          }
        );
        if (!confirmed) return;

        outputService.progress(`Deleting AI check ${testId}...`);
        await apiClient.deleteTest(testId);
        if (isJson) {
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
