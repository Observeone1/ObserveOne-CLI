import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';
import { ApiClient } from '../../services/api-client.service.js';
import { IConfigService } from '../../interfaces/config.interface.js';
import { IOutputService } from '../../interfaces/output.interface.js';
import { Suite } from '../../types/index.js';

interface SuiteJson {
  id: string;
  name: string;
  tests: Array<{ id: string; name: string; file: string }>;
}

interface LocatedSuite {
  suiteJson: SuiteJson;
  folderPath: string;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '');
}

/** Search baseDir's immediate subfolders for a suite.json whose id matches. */
function findSuiteByScan(baseDir: string, id: string): LocatedSuite | null {
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(baseDir, entry.name, 'suite.json');
    if (!fs.existsSync(candidate)) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8')) as SuiteJson;
      if (parsed.id === id) {
        return { suiteJson: parsed, folderPath: path.join(baseDir, entry.name) };
      }
    } catch {
      // skip malformed suite.json
    }
  }
  return null;
}

/** Fallback: use an already-fetched suite to build the expected pulled-folder path directly. */
function findSuiteByExpectedPath(remoteSuite: Suite, baseDir: string): LocatedSuite | null {
  const folderName = `${slugify(remoteSuite.suite_name)}-${remoteSuite.id}`;
  const expectedPath = path.join(baseDir, folderName);
  const jsonPath = path.join(expectedPath, 'suite.json');
  if (fs.existsSync(jsonPath)) {
    const suiteJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as SuiteJson;
    return { suiteJson, folderPath: expectedPath };
  }
  return null;
}

function locateSuite(baseDir: string, id: string, remoteSuite: Suite | null): LocatedSuite | null {
  const byScan = findSuiteByScan(baseDir, id);
  if (byScan) return byScan;
  return remoteSuite ? findSuiteByExpectedPath(remoteSuite, baseDir) : null;
}

/**
 * Decide whether the local PLAN.md differs from the suite's remote
 * plan_markdown and should be pushed. Comparison trims both sides (editors
 * routinely add/remove a trailing newline, which must not read as a real
 * edit); the value sent to the API is the untrimmed local file content so
 * formatting is preserved exactly as authored.
 */
export function planPushDecision(
  localPlanMarkdown: string | null,
  remotePlanMarkdown: string | null
): { shouldPush: boolean; reason: 'missing' | 'blank' | 'unchanged' | 'changed' } {
  if (localPlanMarkdown === null) return { shouldPush: false, reason: 'missing' };
  if (!localPlanMarkdown.trim()) return { shouldPush: false, reason: 'blank' };
  if (localPlanMarkdown.trim() === (remotePlanMarkdown ?? '').trim()) {
    return { shouldPush: false, reason: 'unchanged' };
  }
  return { shouldPush: true, reason: 'changed' };
}

/** Push the local PLAN.md when it changed. Returns a status the caller renders; never throws. */
async function pushPlanIfChanged(
  apiClient: ApiClient,
  suiteId: string,
  folderPath: string,
  remoteSuite: Suite | null
): Promise<{ pushed: boolean; skippedReason?: string; error?: string }> {
  const planPath = path.join(folderPath, 'PLAN.md');
  const localPlanMarkdown = fs.existsSync(planPath) ? fs.readFileSync(planPath, 'utf8') : null;
  const decision = planPushDecision(localPlanMarkdown, remoteSuite?.plan_markdown ?? null);

  if (!decision.shouldPush) {
    if (decision.reason === 'unchanged') return { pushed: false, skippedReason: 'unchanged' };
    return { pushed: false };
  }

  try {
    await apiClient.updateSuitePlan(suiteId, localPlanMarkdown as string);
    return { pushed: true };
  } catch (err: unknown) {
    const message = (err as { response?: { data?: { error?: string } } } & Error).response?.data
      ?.error;
    return { pushed: false, error: message || (err as Error).message || 'Failed to push plan' };
  }
}

/** Push each test's local file content back, skipping any that vanished locally. */
async function pushTestFiles(
  apiClient: ApiClient,
  folderPath: string,
  tests: SuiteJson['tests']
): Promise<{ updated: number; skipped: number }> {
  let updated = 0;
  let skipped = 0;

  for (const t of tests) {
    const filePath = path.join(folderPath, t.file);
    if (!fs.existsSync(filePath)) {
      console.warn(chalk.yellow(`  ⚠ Skipping "${t.name}" — file not found: ${t.file}`));
      skipped++;
      continue;
    }
    const code = fs.readFileSync(filePath, 'utf8');
    await apiClient.updateTestScript(t.id, code);
    updated++;
  }

  return { updated, skipped };
}

function testsWord(count: number): string {
  return count === 1 ? 'test' : 'tests';
}

export function createSuitePushCommand(
  _configService: IConfigService,
  apiClient: ApiClient,
  _outputService: IOutputService
): Command {
  return new Command('push')
    .description('Push locally modified test scripts back to a suite')
    .argument('<id>', 'Suite ID')
    .option('--from <dir>', 'Base directory containing pulled suites', './suites')
    .action(async (id: string, options: { from: string }) => {
      try {
        const baseDir = path.resolve(options.from);
        if (!fs.existsSync(baseDir)) {
          console.error(chalk.red(`❌ Directory not found: ${baseDir}`));
          process.exit(1);
        }

        // Fetched once up front: used both as the suite.json-scan fallback
        // (folder resolution) and as the remote side of the PLAN.md diff.
        const remoteSuite = await apiClient.getSuite(id).catch(() => null);

        const located = locateSuite(baseDir, id, remoteSuite);
        if (!located) {
          const pullHint = `obs suite pull ${id}`;
          const pullHintColored = chalk.cyan(pullHint);
          console.error(
            chalk.red(`❌ No pulled suite found for id ${id} in ${baseDir}`) +
              `\n  Run ${pullHintColored} first.`
          );
          process.exit(1);
        }

        const { suiteJson, folderPath } = located;
        const { tests, name: suiteName } = suiteJson;
        const { updated, skipped } = await pushTestFiles(apiClient, folderPath, tests);
        const planResult = await pushPlanIfChanged(apiClient, id, folderPath, remoteSuite);

        const suiteNameColored = chalk.bold(`"${suiteName}"`);
        console.log(
          chalk.green('✔') +
            ` Pushed ${suiteNameColored} — ${updated} ${testsWord(updated)} updated` +
            (skipped > 0 ? chalk.yellow(` (${skipped} skipped)`) : '')
        );
        if (planResult.pushed) {
          console.log(chalk.green('  ✔ PLAN.md pushed (local edits sent to the suite)'));
        } else if (planResult.error) {
          console.log(chalk.yellow(`  ⚠ PLAN.md not pushed — ${planResult.error}`));
        }
      } catch (err: unknown) {
        console.error(chalk.red(`❌ ${(err as Error).message || 'Failed to push suite'}`));
        process.exit(1);
      }
    });
}
