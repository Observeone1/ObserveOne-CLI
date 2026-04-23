import { Command } from 'commander';
import chalk from 'chalk';
import { ApiClient } from '../../services/api-client.service.js';
import { IConfigService } from '../../interfaces/config.interface.js';
import { IOutputService } from '../../interfaces/output.interface.js';

export function createSuiteHealCommand(
  _configService: IConfigService,
  apiClient: ApiClient,
  outputService: IOutputService
): Command {
  return new Command('heal')
    .description('Trigger a heal for a suite')
    .argument('<id>', 'Suite ID')
    .action(async (id: string) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const result = await apiClient.healSuite(id);
        if (isJson) {
          outputService.formatJsonOutput(result);
          return;
        }
        console.log(chalk.bold(`\n✓ Heal triggered for suite ${id}`));
        if (result.heals && result.heals.length > 0) {
          for (const heal of result.heals) {
            console.log(chalk.gray(`   Test ${heal.testId} → heal ${heal.healId}`));
          }
        } else {
          console.log(chalk.gray('   No heals generated.'));
        }
        console.log('');
      } catch (err: unknown) {
        const msg = (err as Error).message || 'Failed to heal suite';
        if (isJson) {
          outputService.formatJsonOutput({ status: 'ERROR', error: { message: msg } });
        } else {
          console.error(chalk.red(`\n❌ ${msg}\n`));
        }
        process.exit(1);
      }
    });
}
