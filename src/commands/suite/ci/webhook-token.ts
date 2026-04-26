import { Command } from 'commander';
import chalk from 'chalk';
import { ApiClient } from '../../../services/api-client.service.js';
import { IConfigService } from '../../../interfaces/config.interface.js';
import { IOutputService } from '../../../interfaces/output.interface.js';
import { requireConfirmation } from '../../../utils/confirm.js';

export function createSuiteCiWebhookTokenCommand(
  _configService: IConfigService,
  apiClient: ApiClient,
  outputService: IOutputService
): Command {
  return new Command('webhook-token')
    .description(
      'Generate (rotate) the inbound webhook token for a suite. Invalidates the previous token.'
    )
    .argument('<id>', 'Suite ID')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (id: string, options: { yes?: boolean }) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const confirmed = await requireConfirmation(
          `Rotate webhook token for suite ${id}? This invalidates the previous token.`,
          {
            yes: options.yes,
            isJson,
            outputError: (msg) => outputService.error(msg),
          }
        );
        if (!confirmed) {
          console.log(chalk.gray(' Token rotation cancelled.'));
          return;
        }

        const { token } = await apiClient.generateSuiteCiWebhookToken(id);

        if (isJson) {
          outputService.formatJsonOutput({ suite_id: id, token });
          return;
        }

        console.log(
          chalk.green(`\n✓ New webhook token generated for suite ${id}. Old token invalidated.\n`)
        );
        console.log(`  ${chalk.bold(token)}\n`);
        console.log(chalk.gray('  Use as: POST {API_URL}/webhook/playwright?token=<above>\n'));
      } catch (err: unknown) {
        const msg = (err as Error).message || 'Failed to generate webhook token';
        if (isJson) {
          outputService.error(msg);
        } else {
          console.error(chalk.red(`\n❌ ${msg}\n`));
        }
        process.exit(1);
      }
    });
}
