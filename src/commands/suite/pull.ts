import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';
import { ApiClient } from '../../services/api-client.service.js';
import { IConfigService } from '../../interfaces/config.interface.js';
import { IOutputService } from '../../interfaces/output.interface.js';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function createSuitePullCommand(
  _configService: IConfigService,
  apiClient: ApiClient,
  _outputService: IOutputService
): Command {
  return new Command('pull')
    .description('Download a suite and its generated test scripts to disk')
    .argument('<id>', 'Suite ID')
    .option('--out <dir>', 'Base output directory', './suites')
    .action(async (id: string, options: { out: string }) => {
      try {
        const [suite, scripts] = await Promise.all([
          apiClient.getSuite(id),
          apiClient.getSuiteScripts(id),
        ]);

        const folderName = `${slugify(suite.suite_name)}-${suite.id}`;
        const folderPath = path.resolve(options.out, folderName);
        fs.mkdirSync(folderPath, { recursive: true });

        // Write PLAN.md
        if (suite.plan_markdown) {
          fs.writeFileSync(path.join(folderPath, 'PLAN.md'), suite.plan_markdown, 'utf8');
        }

        // Build test manifest
        const testManifest: Array<{ id: string; name: string; file: string }> = [];
        for (const t of scripts.tests) {
          const fileName = `${slugify(t.name)}.spec.ts`;
          fs.writeFileSync(path.join(folderPath, fileName), t.code, 'utf8');
          testManifest.push({ id: t.id, name: t.name, file: fileName });
        }

        // Write suite.json
        const suiteJson = {
          id: suite.id,
          name: suite.suite_name,
          target_url: suite.target_url,
          cron_expression: suite.cron_expression ?? null,
          schedule_active: suite.schedule_active,
          pulled_at: new Date().toISOString(),
          tests: testManifest,
        };
        fs.writeFileSync(
          path.join(folderPath, 'suite.json'),
          JSON.stringify(suiteJson, null, 2),
          'utf8'
        );

        const parts: string[] = [];
        if (suite.plan_markdown) parts.push('PLAN.md');
        parts.push(`${scripts.tests.length} test${scripts.tests.length !== 1 ? 's' : ''}`);

        console.log(
          chalk.green('✔') +
            ` Pulled ${chalk.bold(`"${suite.suite_name}"`)} → ${chalk.cyan(path.relative(process.cwd(), folderPath) + '/')}`
        );
        console.log(`  ${parts.join('  ')}`);
      } catch (err: unknown) {
        console.error(chalk.red(`❌ ${(err as Error).message || 'Failed to pull suite'}`));
        process.exit(1);
      }
    });
}
