import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';
import { ApiClient } from '../../services/api-client.service.js';
import { IConfigService } from '../../interfaces/config.interface.js';
import { IOutputService } from '../../interfaces/output.interface.js';

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

/** Fallback: fetch the suite name from the API to build the expected pulled-folder path directly. */
async function findSuiteByExpectedPath(
  apiClient: ApiClient,
  baseDir: string,
  id: string
): Promise<LocatedSuite | null> {
  try {
    const suite = await apiClient.getSuite(id);
    const folderName = `${slugify(suite.suite_name)}-${suite.id}`;
    const expectedPath = path.join(baseDir, folderName);
    const jsonPath = path.join(expectedPath, 'suite.json');
    if (fs.existsSync(jsonPath)) {
      const suiteJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as SuiteJson;
      return { suiteJson, folderPath: expectedPath };
    }
  } catch {
    // ignore — caller reports "not found" below
  }
  return null;
}

async function locateSuite(
  apiClient: ApiClient,
  baseDir: string,
  id: string
): Promise<LocatedSuite | null> {
  return findSuiteByScan(baseDir, id) ?? (await findSuiteByExpectedPath(apiClient, baseDir, id));
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

        const located = await locateSuite(apiClient, baseDir, id);
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

        const suiteNameColored = chalk.bold(`"${suiteName}"`);
        console.log(
          chalk.green('✔') +
            ` Pushed ${suiteNameColored} — ${updated} ${testsWord(updated)} updated` +
            (skipped > 0 ? chalk.yellow(` (${skipped} skipped)`) : '')
        );
      } catch (err: unknown) {
        console.error(chalk.red(`❌ ${(err as Error).message || 'Failed to push suite'}`));
        process.exit(1);
      }
    });
}
