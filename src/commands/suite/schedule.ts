import { Command } from 'commander';
import chalk from 'chalk';
import { ApiClient } from '../../services/api-client.service.js';
import { IConfigService } from '../../interfaces/config.interface.js';
import { IOutputService } from '../../interfaces/output.interface.js';

function printScheduleUpdated(suite: {
  schedule_active?: boolean | null;
  cron_expression?: string | null;
}): void {
  const status = suite.schedule_active ? chalk.green('enabled') : chalk.gray('disabled');
  console.log(chalk.bold(`\n Suite schedule updated`));
  console.log(chalk.gray(` Schedule: ${status}`));
  if (suite.cron_expression) {
    console.log(chalk.gray(` Cron:     ${suite.cron_expression}`));
  }
  console.log('');
}

export function createSuiteScheduleCommand(
  _configService: IConfigService,
  apiClient: ApiClient,
  outputService: IOutputService
): Command {
  return new Command('schedule')
    .description('Enable, disable, or update the schedule for a suite')
    .argument('<id>', 'Suite ID')
    .option('--enable', 'Activate the schedule')
    .option('--disable', 'Deactivate the schedule')
    .option('--cron <expr>', 'Cron expression (e.g. "0 */6 * * *")')
    .action(async (id: string, options: { enable?: boolean; disable?: boolean; cron?: string }) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        if (options.enable && options.disable) {
          throw new Error('Cannot use --enable and --disable together');
        }

        let schedule_active: boolean | undefined;
        if (options.enable) schedule_active = true;
        else if (options.disable) schedule_active = false;

        const suite = await apiClient.updateSuiteSchedule(id, {
          ...(schedule_active !== undefined && { schedule_active }),
          ...(options.cron && { cron_expression: options.cron }),
        });

        if (isJson) {
          outputService.formatJsonOutput({ suite });
        } else {
          printScheduleUpdated(suite);
        }
      } catch (err: unknown) {
        const msg = (err as Error).message || 'Failed to update suite schedule';
        if (isJson) {
          outputService.formatJsonOutput({ status: 'ERROR', error: { message: msg } });
        } else {
          console.error(chalk.red(`\n❌ ${msg}\n`));
        }
        process.exit(1);
      }
    });
}
