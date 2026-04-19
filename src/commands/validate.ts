import { Command } from 'commander';
import { readFileSync, existsSync } from 'fs';
import { IOutputService } from '../interfaces/output.interface.js';
import { resolveSchema, resourceNames } from '../utils/schemas.js';

export function createValidateCommand(outputService: IOutputService): Command {
  return new Command('validate')
    .description('Validate a resource JSON file against the expected schema')
    .requiredOption('-r, --resource <type>', `Resource type (${resourceNames.join(', ')})`)
    .requiredOption('-f, --file <path>', 'Path to JSON file to validate')
    .option('-j, --json', 'Output in JSON format')
    .action((options: { resource: string; file: string; json?: boolean }) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true' || options.json === true;
      if (isJson) outputService.enableJsonMode();

      const schema = resolveSchema(options.resource);
      if (!schema) {
        outputService.error(
          `Unknown resource type "${options.resource}". Valid types: ${resourceNames.join(', ')}`
        );
        process.exit(1);
      }

      if (!existsSync(options.file)) {
        outputService.error(`File not found: ${options.file}`);
        process.exit(1);
      }

      let data: Record<string, unknown>;
      try {
        data = JSON.parse(readFileSync(options.file, 'utf-8')) as Record<string, unknown>;
      } catch {
        outputService.error(`Failed to parse ${options.file} as JSON.`);
        process.exit(1);
      }

      const missing = schema.required.filter(
        (field) => data[field] === undefined || data[field] === ''
      );

      if (missing.length > 0) {
        if (isJson) {
          outputService.formatJsonOutput({ valid: false, missing_fields: missing });
        } else {
          outputService.error(
            `Validation failed — missing required fields: ${missing.join(', ')}`
          );
        }
        process.exit(1);
      }

      if (isJson) {
        outputService.formatJsonOutput({ valid: true, resource: options.resource });
      } else {
        outputService.success(
          `${options.file} is valid for resource type "${options.resource}".`
        );
      }
    });
}
