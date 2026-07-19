import { Command } from 'commander';
import chalk from 'chalk';
import { ApiClient } from '../../services/api-client.service.js';
import { IConfigService } from '../../interfaces/config.interface.js';
import { IOutputService } from '../../interfaces/output.interface.js';
import { computeRegenerateTargets, PlanFileStatus } from '../../utils/plan-scenarios.js';

type RegenerateOptions = {
  dryRun?: boolean;
  all?: boolean;
};

function stateLabel(state: PlanFileStatus['state']): string {
  if (state === 'stale') return chalk.yellow('stale');
  if (state === 'missing') return chalk.gray('missing');
  if (state === 'generated') return chalk.green('generated');
  return chalk.gray(state);
}

/** Queue each target file's generation one at a time, like the dashboard's regenerate run. */
async function generateSequentially(
  apiClient: ApiClient,
  suiteId: string,
  targets: PlanFileStatus[]
): Promise<{ queued: string[]; failed: Array<{ file: string; error: string }> }> {
  const queued: string[] = [];
  const failed: Array<{ file: string; error: string }> = [];
  for (const target of targets) {
    try {
      await apiClient.generateTest(suiteId, target.file);
      queued.push(target.file);
    } catch (err: unknown) {
      failed.push({ file: target.file, error: (err as Error).message || 'Failed to queue' });
    }
  }
  return { queued, failed };
}

export function createSuiteRegenerateCommand(
  _configService: IConfigService,
  apiClient: ApiClient,
  outputService: IOutputService
): Command {
  return new Command('regenerate')
    .description(
      "Regenerate a suite's stale (plan edited after generation) or missing planned tests"
    )
    .argument('<id>', 'Suite ID')
    .option('--dry-run', 'List what would regenerate without generating anything')
    .option(
      '--all',
      'When nothing is stale or missing, regenerate every non-dismissed planned file instead of doing nothing'
    )
    .addHelpText(
      'after',
      `
Examples:
  $ obs suite regenerate 42 --dry-run   # preview what a run would target
  $ obs suite regenerate 42             # regenerate stale/missing planned files
  $ obs suite regenerate 42 --all       # also regenerate everything when nothing is stale/missing
`
    )
    .action(async (id: string, options: RegenerateOptions) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const suite = await apiClient.getSuite(id);
        const { targets, usedAllFallback } = computeRegenerateTargets(suite, !!options.all);

        if (targets.length === 0) {
          if (isJson) {
            outputService.formatJsonOutput({ id, targets: [], dry_run: !!options.dryRun });
            return;
          }
          console.log(
            chalk.gray(
              `\n Nothing stale or missing for "${suite.suite_name}". ` +
                `Pass --all to regenerate every non-dismissed planned file.\n`
            )
          );
          return;
        }

        if (options.dryRun) {
          if (isJson) {
            outputService.formatJsonOutput({
              id,
              dry_run: true,
              used_all_fallback: usedAllFallback,
              targets: targets.map((t) => ({ file: t.file, state: t.state })),
            });
            return;
          }
          console.log(
            chalk.bold(`\n Would regenerate ${targets.length} test(s) in "${suite.suite_name}"`)
          );
          console.log(chalk.gray('─'.repeat(56)));
          targets.forEach((t) => console.log(`  ${stateLabel(t.state).padEnd(18)} ${t.file}`));
          console.log('');
          return;
        }

        const { queued, failed } = await generateSequentially(apiClient, id, targets);

        if (isJson) {
          outputService.formatJsonOutput({
            id,
            used_all_fallback: usedAllFallback,
            queued,
            failed,
          });
          if (failed.length > 0) process.exit(1);
          return;
        }

        console.log(
          chalk.green('✔') +
            ` Queued ${queued.length} test${queued.length === 1 ? '' : 's'} for regeneration in "${suite.suite_name}"`
        );
        if (failed.length > 0) {
          failed.forEach((f) => console.log(chalk.red(`  ✘ ${f.file} — ${f.error}`)));
        }
        console.log(chalk.gray(` Check progress: obs suite get ${id}\n`));
        if (failed.length > 0) process.exit(1);
      } catch (err: unknown) {
        const msg = (err as Error).message || 'Failed to regenerate suite';
        if (isJson) {
          outputService.formatJsonOutput({ status: 'ERROR', error: { message: msg } });
        } else {
          console.error(chalk.red(`\n❌ ${msg}\n`));
        }
        process.exit(1);
      }
    });
}
