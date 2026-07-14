import { Command } from 'commander';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { IOutputService } from '../interfaces/output.interface.js';
import { buildJsonSchema, resourceNames } from '../utils/schemas.js';

export function createSchemaCommand(outputService: IOutputService): Command {
  return new Command('schema')
    .description('Print the JSON Schema for a resource type')
    .argument('<resource>', `Resource type (${resourceNames.join(', ')})`)
    .option('-o, --out <path>', 'Write schema to file (directories auto-created)')
    .option('-j, --json', 'Output in JSON format (schema is already JSON)')
    .action((resource: string, options: { out?: string; json?: boolean }) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true' || options.json === true;
      if (isJson) outputService.enableJsonMode();

      const schema = buildJsonSchema(resource);
      if (!schema) {
        outputService.error(
          `Unknown resource type "${resource}". Valid types: ${resourceNames.join(', ')}`
        );
        process.exit(1);
      }

      const payload = JSON.stringify(schema, null, 2);

      if (options.out) {
        const dir = dirname(options.out);
        if (dir && dir !== '.') mkdirSync(dir, { recursive: true });
        writeFileSync(options.out, payload);
        if (isJson) {
          outputService.formatJsonOutput({ resource, out: options.out });
        } else {
          outputService.success(`Schema written to ${options.out}`);
        }
        return;
      }

      if (isJson) {
        outputService.formatJsonOutput(schema);
      } else {
        console.log(payload);
      }
    });
}
