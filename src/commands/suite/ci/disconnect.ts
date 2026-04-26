import { Command } from 'commander';
import chalk from 'chalk';
import { ApiClient } from '../../../services/api-client.service.js';
import { IConfigService } from '../../../interfaces/config.interface.js';
import { IOutputService } from '../../../interfaces/output.interface.js';
import { requireConfirmation } from '../../../utils/confirm.js';

export function createSuiteCiDisconnectCommand(
  _configService: IConfigService,
  apiClient: ApiClient,
  outputService: IOutputService
): Command {
  return new Command('disconnect')
    .description(
      'Remove the CI integration for a suite. Invalidates the webhook token and unbinds the repo.'
    )
    .argument('<id>', 'Suite ID')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (id: string, options: { yes?: boolean }) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const confirmed = await requireConfirmation(
          `Disconnect CI for suite ${id}? This invalidates the webhook token and unbinds the repo.`,
          {
            yes: options.yes,
            isJson,
            outputError: (msg) => outputService.error(msg),
          }
        );
        if (!confirmed) {
          console.log(chalk.gray(' Disconnect cancelled.'));
          return;
        }

        await apiClient.deleteSuiteCiIntegration(id);

        if (isJson) {
          outputService.formatJsonOutput({ suite_id: id, disconnected: true });
          return;
        }
        console.log(chalk.green(`\n✓ CI integration removed for suite ${id}.\n`));
      } catch (err: unknown) {
        const msg = (err as Error).message || 'Failed to disconnect CI integration';
        if (isJson) {
          outputService.formatJsonOutput({ status: 'ERROR', error: { message: msg } });
        } else {
          console.error(chalk.red(`\n❌ ${msg}\n`));
        }
        process.exit(1);
      }
    });
}
