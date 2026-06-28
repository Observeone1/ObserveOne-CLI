import { Command } from 'commander';
import chalk from 'chalk';
import { ApiClient } from '../../services/api-client.service.js';
import { IConfigService } from '../../interfaces/config.interface.js';
import { IOutputService } from '../../interfaces/output.interface.js';
import { requireConfirmation } from '../../utils/confirm.js';

export function createSuiteTogglePublicCommand(
  _configService: IConfigService,
  apiClient: ApiClient,
  outputService: IOutputService
): Command {
  return new Command('toggle-public')
    .description('Toggle public visibility of a suite')
    .argument('<id>', 'Suite ID')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (id: string, options: { yes?: boolean }) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        // Fetch current state to toggle
        const suite = await apiClient.getSuite(id);
        const newPublic = !suite.is_public;

        // Making a suite public can expose its test credentials and internal
        // URLs, so gate that direction behind an explicit confirmation.
        if (newPublic) {
          const confirmed = await requireConfirmation(
            `Make suite ${id} PUBLIC? Its test credentials and internal URLs may be exposed.`,
            {
              yes: options.yes,
              isJson,
              outputError: (msg) => outputService.error(msg),
            }
          );
          if (!confirmed) {
            console.log(chalk.gray(' Toggle cancelled.'));
            return;
          }
        }

        const result = await apiClient.toggleSuitePublic(id, newPublic);
        if (isJson) {
          outputService.formatJsonOutput({ suite: result });
          return;
        }
        const status = newPublic ? chalk.green('public') : chalk.gray('private');
        console.log(chalk.bold(`\n✓ Suite ${id} is now ${status}.\n`));
      } catch (err: unknown) {
        const msg = (err as Error).message || 'Failed to toggle suite visibility';
        if (isJson) {
          outputService.formatJsonOutput({ status: 'ERROR', error: { message: msg } });
        } else {
          console.error(chalk.red(`\n❌ ${msg}\n`));
        }
        process.exit(1);
      }
    });
}
