import { Command } from 'commander';
import chalk from 'chalk';
import { IOutputService } from '../interfaces/output.interface.js';
import { schemas } from '../utils/schemas.js';

export function createTemplatesCommand(outputService: IOutputService): Command {
  const templates = new Command('templates').description('Discover available resource templates');

  templates
    .command('list')
    .description('List all resource templates with descriptions and required fields')
    .option('-j, --json', 'Output in JSON format')
    .action((options: { json?: boolean }) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true' || options.json === true;
      if (isJson) outputService.enableJsonMode();

      const entries = Object.entries(schemas).map(([name, s]) => ({
        name,
        description: s.description,
        required: s.required,
      }));

      if (isJson) {
        outputService.formatJsonOutput({ templates: entries });
        return;
      }

      const nameWidth = Math.max(...entries.map((e) => e.name.length));
      console.log(chalk.bold('\nAvailable resource templates\n'));
      for (const e of entries) {
        const name = chalk.cyan(e.name.padEnd(nameWidth));
        const required = chalk.gray(`(required: ${e.required.join(', ')})`);
        console.log(`  ${name}  ${e.description}`);
        console.log(`  ${' '.repeat(nameWidth)}  ${required}\n`);
      }
      console.log(
        chalk.gray('Use `obs init <name>` to scaffold, `obs schema <name>` for the JSON Schema.\n')
      );
    });

  return templates;
}
