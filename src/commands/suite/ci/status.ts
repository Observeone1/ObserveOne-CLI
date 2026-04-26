import { Command } from 'commander';
import chalk from 'chalk';
import { ApiClient } from '../../../services/api-client.service.js';
import { IConfigService } from '../../../interfaces/config.interface.js';
import { IOutputService } from '../../../interfaces/output.interface.js';

export function createSuiteCiStatusCommand(
  _configService: IConfigService,
  apiClient: ApiClient,
  outputService: IOutputService
): Command {
  return new Command('status')
    .description('Show the CI integration for a suite (repo, branch, hooks, masked token)')
    .argument('<id>', 'Suite ID')
    .action(async (id: string) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const ci = await apiClient.getSuiteCiIntegration(id);

        if (isJson) {
          outputService.formatJsonOutput({ ci_integration: ci });
          return;
        }

        if (!ci) {
          console.log(
            chalk.gray(`\n  Suite ${id} has no CI integration. Connect one in the dashboard.\n`)
          );
          return;
        }

        const tokenDisplay = ci.inbound_webhook_token_last4
          ? chalk.gray(`••••${ci.inbound_webhook_token_last4}`)
          : chalk.dim('(none — generate with: obs suite ci webhook-token ' + id + ')');

        const flag = (b: boolean) => (b ? chalk.green('✓') : chalk.gray('✗'));

        console.log(chalk.bold(`\n  Suite ${id} — CI Integration\n`));
        console.log(`  Status:      ${chalk.green('Connected')}`);
        console.log(`  Provider:    ${ci.provider || chalk.dim('(unknown)')}`);
        console.log(`  Repo:        ${ci.repo_identifier || chalk.dim('(none)')}`);
        console.log(`  Branch:      ${ci.branch || chalk.dim('(any)')}`);
        console.log(
          `  Hooks:       PR comments ${flag(ci.comment_on_pr)}  Status check ${flag(
            ci.set_status_check
          )}  Wait for CI ${flag(ci.wait_for_ci)}`
        );
        console.log(`  Token:       ${tokenDisplay}`);
        if (ci.last_triggered_at) {
          console.log(`  Last fired:  ${chalk.gray(ci.last_triggered_at)}`);
        }
        console.log('');
        console.log(chalk.dim(`  Rotate token:  obs suite ci webhook-token ${id}`));
        console.log(chalk.dim(`  Disconnect:    obs suite ci disconnect ${id}\n`));
      } catch (err: unknown) {
        const msg = (err as Error).message || 'Failed to get CI integration';
        if (isJson) {
          outputService.error(msg);
        } else {
          console.error(chalk.red(`\n❌ ${msg}\n`));
        }
        process.exit(1);
      }
    });
}
