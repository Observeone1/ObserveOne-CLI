import { Command } from 'commander';
import { readFileSync, existsSync } from 'node:fs';
import { IOutputService } from '../interfaces/output.interface.js';
import { resolveSchema, resourceNames } from '../utils/schemas.js';

type ValueType = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null';

/** JSON value type, collapsing integer/float to a single 'number' bucket. */
function valueType(value: unknown): ValueType {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'number') return 'number';
  if (t === 'boolean') return 'boolean';
  if (t === 'string') return 'string';
  return 'object';
}

/**
 * Enforce field TYPES and ENUM membership for a resource file, beyond the
 * required-present checks. Types are inferred from the resource template; enums
 * come from `fieldMetadata.choices`. Fields absent from the template (and
 * without choices) carry no type info and pass through untouched, so exported
 * keys like `id`/`created_at` and template-less flags (e.g. `regions`) are fine.
 *
 * Enum membership is case-sensitive against the declared choices: files should
 * use the exact casing the schema emits (e.g. `"GET"`, `"HIGH"`, `"email"`).
 *
 * Returns a list of human-readable error strings (empty when valid).
 */
export function validateAgainstSchema(resource: string, obj: Record<string, unknown>): string[] {
  const schema = resolveSchema(resource);
  if (!schema) return [];

  const errors: string[] = [];
  const meta = schema.fieldMetadata ?? {};

  for (const [field, value] of Object.entries(obj)) {
    // Skip absent/null — required-present handles missing keys; a null clears.
    if (value === undefined || value === null) continue;

    const choices = meta[field]?.choices;
    if (choices && typeof value === 'string' && !choices.includes(value)) {
      errors.push(
        `Field "${field}" must be one of: ${choices.join(', ')} (got ${JSON.stringify(value)})`
      );
      continue;
    }

    if (field in schema.template) {
      const expected = valueType(schema.template[field]);
      // A template null carries no type constraint.
      if (expected === 'null') continue;
      const actual = valueType(value);
      if (actual !== expected) {
        errors.push(`Field "${field}" must be of type ${expected} (got ${actual})`);
      }
    }
  }

  return errors;
}

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
          outputService.error(`Validation failed — missing required fields: ${missing.join(', ')}`);
        }
        process.exit(1);
      }

      const typeErrors = validateAgainstSchema(options.resource, data);
      if (typeErrors.length > 0) {
        if (isJson) {
          outputService.formatJsonOutput({ valid: false, errors: typeErrors });
        } else {
          outputService.error(`Validation failed:\n  - ${typeErrors.join('\n  - ')}`);
        }
        process.exit(1);
      }

      if (isJson) {
        outputService.formatJsonOutput({ valid: true, resource: options.resource });
      } else {
        outputService.success(`${options.file} is valid for resource type "${options.resource}".`);
      }
    });
}
