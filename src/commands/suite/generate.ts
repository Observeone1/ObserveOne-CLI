import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ApiClient } from '../../services/api-client.service.js';
import { IConfigService } from '../../interfaces/config.interface.js';
import { IOutputService } from '../../interfaces/output.interface.js';
import { mergeVars } from './vars.js';
import { suiteStatusColor } from './formatters.js';

const STAGE_LABELS: Record<string, string> = {
  pending: 'Queuing...',
  crawling: 'Crawling pages...',
  planning: 'Planning test scenarios...',
  generating: 'Generating test scripts...',
  healing: 'Healing & validating...',
  scheduled: 'Done',
  failed: 'Failed',
};

export function createSuiteGenerateCommand(
  _configService: IConfigService,
  apiClient: ApiClient,
  outputService: IOutputService
): Command {
  return new Command('generate')
    .description('Generate a new Playwright Autopilot suite from a URL')
    .argument('<url>', 'Target URL to generate tests for')
    .option('--name <name>', 'Suite name (default: derived from URL hostname)')
    .option('--cron <expr>', 'Cron schedule (e.g. "0 */6 * * *"). Omit for manual only.')
    .option('--max-tests <n>', 'Max tests to generate (1-30, default: 10)', '10')
    .option('--var <KEY=VALUE>', 'Variable/credential (repeatable)', (v, prev: string[]) => [...prev, v], [] as string[])
    .option('--var-file <path>', 'Load variables from a .env file')
    .option('--allow-form-submit', 'Allow AI agents to submit non-auth forms')
    .option('-w, --wait', 'Wait for generation to complete')
    .action(async (url: string, options: {
      name?: string;
      cron?: string;
      maxTests?: string;
      var: string[];
      varFile?: string;
      allowFormSubmit?: boolean;
      wait?: boolean;
    }) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const hostname = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
        const suiteName = options.name || hostname;

        let secrets: Record<string, string> | undefined;
        try {
          secrets = mergeVars(options.var, options.varFile);
        } catch (e: unknown) {
          throw new Error((e as Error).message);
        }

        const payload: Parameters<typeof apiClient.generateSuite>[0] = {
          target_url: url,
          suite_name: suiteName,
          max_tests: Math.min(30, Math.max(1, parseInt(options.maxTests || '10', 10))),
        };
        if (options.cron) {
          payload.cron_expression = options.cron;
          payload.schedule_active = true;
        }
        if (secrets) payload.secrets = secrets;
        if (options.allowFormSubmit) payload.allow_form_submit = true;

        const suite = await apiClient.generateSuite(payload);

        if (!options.wait) {
          if (isJson) {
            outputService.formatJsonOutput({ suite });
          } else {
            console.log(chalk.bold(`\n Suite created: ${suite.suite_name}`));
            console.log(chalk.gray(` ID: ${suite.id}`));
            console.log(chalk.gray(` Status: ${suiteStatusColor(suite.status)}`));
            console.log(chalk.gray(` Track: obs suite get ${suite.id}\n`));
          }
          return;
        }

        if (!isJson) {
          console.log(chalk.bold(`\n Generating suite for ${url}`));
          console.log(chalk.gray('─'.repeat(56)));
        }

        const spinner = ora({ text: 'Queuing...', stream: process.stdout }).start();
        const started = Date.now();

        const done = await apiClient.pollSuiteGeneration(suite.id);

        const elapsed = ((Date.now() - started) / 1000).toFixed(0);

        if (done.status === 'failed') {
          spinner.fail(chalk.red(`Generation failed: ${done.error_message || 'unknown error'}`));
          if (isJson) outputService.formatJsonOutput({ suite: done });
          process.exit(1);
        }

        spinner.succeed(chalk.green(`Suite ready  (${elapsed}s)  •  ${done.test_count} tests generated`));
        console.log('');
        console.log(chalk.gray(` Suite ID:  ${done.id}`));
        console.log(chalk.gray(` Run it:    obs suite run ${done.id} --wait`));
        console.log('');

        if (isJson) outputService.formatJsonOutput({ suite: done });
      } catch (err: unknown) {
        const msg = (err as Error).message || 'Failed to generate suite';
        if (isJson) {
          outputService.formatJsonOutput({ status: 'ERROR', error: { message: msg } });
        } else {
          console.error(chalk.red(`\n❌ ${msg}\n`));
        }
        process.exit(1);
      }
    });
}
