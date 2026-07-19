import { Command, Option } from 'commander';
import chalk from 'chalk';
import ora, { Ora } from 'ora';
import { ApiClient } from '../../services/api-client.service.js';
import { IConfigService } from '../../interfaces/config.interface.js';
import { IOutputService } from '../../interfaces/output.interface.js';
import { resolveVars } from './vars.js';
import { suiteStatusColor } from './formatters.js';

type GenerateOptions = {
  name?: string;
  cron?: string;
  maxTests?: string;
  var: string[];
  varFile?: string;
  allowFormSubmit?: boolean;
  planOnly?: boolean;
  wait?: boolean;
};

function extractPlannedFiles(planMarkdown: string): string[] {
  const matches = [
    ...planMarkdown.matchAll(/\*\*File:\*\*\s*`tests\/([^`]+?\.(?:spec|test)\.ts)`/g),
  ];
  return [...new Set(matches.map((m) => m[1]).filter((f): f is string => !!f))];
}

/** Pluralize the trailing "test(s)" label used across the generate output. */
function testsLabel(count: number): string {
  return count === 1 ? '' : 's';
}

async function buildGeneratePayload(
  url: string,
  suiteName: string,
  options: GenerateOptions,
  outputService: IOutputService,
  isJson: boolean
): Promise<Parameters<ApiClient['generateSuite']>[0]> {
  const secrets = await resolveVars(options.var, options.varFile, {
    isJson,
    outputError: (msg) => outputService.error(msg),
  });

  const payload: Parameters<ApiClient['generateSuite']>[0] = {
    target_url: url,
    suite_name: suiteName,
    max_tests: Math.min(30, Math.max(1, Number.parseInt(options.maxTests || '10', 10))),
  };
  if (options.cron) {
    payload.cron_expression = options.cron;
    payload.schedule_active = true;
  }
  if (secrets) payload.secrets = secrets;
  if (options.allowFormSubmit) payload.allow_form_submit = true;

  return payload;
}

/**
 * Poll the planning phase to completion. Returns the planned file list to
 * continue into test generation, or `null` when the caller should stop
 * (failed, --plan-only, or an empty plan) — those terminal cases already
 * printed their own output.
 */
async function runPlanningPhase(
  apiClient: ApiClient,
  outputService: IOutputService,
  suiteId: string,
  spinner: Ora,
  isJson: boolean,
  planOnly: boolean
): Promise<{ plannedFiles: string[]; planId: string } | null> {
  const planned = await apiClient.pollSuiteGeneration(suiteId);

  if (planned.status === 'failed') {
    spinner.fail(chalk.red(`Generation failed: ${planned.error_message || 'unknown error'}`));
    if (isJson) outputService.formatJsonOutput({ suite: planned });
    process.exit(1);
  }

  const plannedFiles = extractPlannedFiles(planned.plan_markdown ?? '');

  if (planOnly) {
    spinner.succeed(
      chalk.green(
        `Plan ready  •  ${plannedFiles.length} test${testsLabel(plannedFiles.length)} planned`
      )
    );
    console.log('');
    console.log(chalk.gray(` Suite ID:   ${planned.id}`));
    console.log(chalk.gray(` Status:     ${suiteStatusColor(planned.status)}`));
    console.log(chalk.gray(` Open the dashboard to generate tests`));
    console.log('');
    if (isJson) outputService.formatJsonOutput({ suite: planned });
    return null;
  }

  if (plannedFiles.length === 0) {
    spinner.warn(chalk.yellow('Plan complete but no test files found. Check the dashboard.'));
    if (isJson) outputService.formatJsonOutput({ suite: planned });
    return null;
  }

  return { plannedFiles, planId: planned.id };
}

/** Generate the planned test scripts, poll until settled, and report progress on the spinner. */
async function runTestGenerationPhase(
  apiClient: ApiClient,
  spinner: Ora,
  started: number,
  planId: string,
  plannedFiles: string[]
) {
  spinner.text = `Generating ${plannedFiles.length} test${testsLabel(plannedFiles.length)}...`;
  await Promise.all(plannedFiles.map((file) => apiClient.generateTest(planId, file)));

  const done = await apiClient.pollSuiteTests(planId, plannedFiles.length);
  const elapsed = ((Date.now() - started) / 1000).toFixed(0);
  const generated = done.generated_tests.length;

  if (generated >= plannedFiles.length) {
    spinner.succeed(
      chalk.green(
        `Suite ready  (${elapsed}s)  •  ${generated}/${plannedFiles.length} tests generated`
      )
    );
  } else {
    spinner.warn(
      chalk.yellow(
        `Done (${elapsed}s)  •  ${generated}/${plannedFiles.length} tests generated (some may still be processing)`
      )
    );
  }

  console.log('');
  console.log(chalk.gray(` Suite ID:  ${done.id}`));
  console.log(chalk.gray(` Run it:    obs suite run ${done.id} --wait`));
  console.log('');

  return done;
}

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
    .option(
      '--var <KEY[=VALUE]>',
      'Variable/credential (repeatable). Omit =VALUE (e.g. --var API_TOKEN) to be prompted securely.',
      (v, prev: string[]) => [...prev, v],
      [] as string[]
    )
    .option(
      '--var-file <path>',
      'Load variables from an uncommitted .env file (safer than inline values)'
    )
    .option('--allow-form-submit', 'Allow AI agents to submit non-auth forms')
    .option('--plan-only', 'Stop after the planning phase; do not generate test scripts')
    .addOption(
      new Option('-w, --wait', 'Deprecated: test generation is now the default').hideHelp()
    )
    .addHelpText(
      'after',
      `
Examples:
  $ obs suite generate https://example.com
  $ obs suite generate https://example.com --name "Smoke Tests" --max-tests 5
  $ obs suite generate https://example.com --cron "0 */6 * * *"
  $ obs suite generate https://example.com --var API_TOKEN   # prompts for the secret (masked)
  $ obs suite generate https://example.com --var-file .env.secrets
`
    )
    .action(async (url: string, options: GenerateOptions) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';

      if (options.wait) {
        console.warn(
          chalk.yellow(
            ' --wait is deprecated and has no effect. Test generation is now the default.\n'
          )
        );
      }

      try {
        const hostname = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
        const suiteName = options.name || hostname;

        const payload = await buildGeneratePayload(url, suiteName, options, outputService, isJson);
        const suite = await apiClient.generateSuite(payload);

        if (!isJson) {
          console.log(chalk.bold(`\n Generating suite for ${url}`));
          console.log(chalk.gray('─'.repeat(56)));
        }

        const started = Date.now();
        const spinner = ora({
          text: 'Planning test scenarios...',
          stream: process.stdout,
        }).start();

        const planningResult = await runPlanningPhase(
          apiClient,
          outputService,
          suite.id,
          spinner,
          isJson,
          !!options.planOnly
        );
        if (!planningResult) return;

        const done = await runTestGenerationPhase(
          apiClient,
          spinner,
          started,
          planningResult.planId,
          planningResult.plannedFiles
        );

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
