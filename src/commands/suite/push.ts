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

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '');
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
        // Locate the suite folder — find by suite.json id field rather than parsing folder name
        const baseDir = path.resolve(options.from);
        if (!fs.existsSync(baseDir)) {
          console.error(chalk.red(`❌ Directory not found: ${baseDir}`));
          process.exit(1);
        }

        // Search for a suite.json with matching id
        const entries = fs.readdirSync(baseDir, { withFileTypes: true });
        let suiteJson: SuiteJson | null = null;
        let folderPath = '';

        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const candidate = path.join(baseDir, entry.name, 'suite.json');
          if (!fs.existsSync(candidate)) continue;
          try {
            const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8')) as SuiteJson;
            if (parsed.id === id) {
              suiteJson = parsed;
              folderPath = path.join(baseDir, entry.name);
              break;
            }
          } catch {
            // skip malformed suite.json
          }
        }

        // Fallback: check the expected folder name directly
        if (!suiteJson) {
          // We don't have the suite name here, so attempt to fetch it to build the expected path
          try {
            const suite = await apiClient.getSuite(id);
            const folderName = `${slugify(suite.suite_name)}-${suite.id}`;
            const expectedPath = path.join(baseDir, folderName);
            const jsonPath = path.join(expectedPath, 'suite.json');
            if (fs.existsSync(jsonPath)) {
              suiteJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as SuiteJson;
              folderPath = expectedPath;
            }
          } catch {
            // ignore — will fail below
          }
        }

        if (!suiteJson || !folderPath) {
          const pullHint = chalk.cyan(`obs suite pull ${id}`);
          console.error(
            chalk.red(`❌ No pulled suite found for id ${id} in ${baseDir}`) +
              `\n  Run ${pullHint} first.`
          );
          process.exit(1);
        }

        const { tests, name: suiteName } = suiteJson;
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

        const suiteLabel = chalk.bold(`"${suiteName}"`);
        const plural = updated === 1 ? '' : 's';
        console.log(
          chalk.green('✔') +
            ` Pushed ${suiteLabel} — ${updated} test${plural} updated` +
            (skipped > 0 ? chalk.yellow(` (${skipped} skipped)`) : '')
        );
      } catch (err: unknown) {
        console.error(chalk.red(`❌ ${(err as Error).message || 'Failed to push suite'}`));
        process.exit(1);
      }
    });
}
