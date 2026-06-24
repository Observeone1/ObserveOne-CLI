import inquirer, { DistinctQuestion } from 'inquirer';
import chalk from 'chalk';
import { FieldSchema, ResourceSchema } from './schemas.js';
import { requireTTY } from './confirm.js';
import { IOutputService } from '../interfaces/output.interface.js';

type Payload = Record<string, unknown>;
type Options = Record<string, unknown>;

/**
 * Default `createPrompts` callback for the resource-command factory.
 *
 * Behavior:
 *   1. For every field with `requiredOnCreate` and no CLI flag, builds an inquirer
 *      question (using `inquirerType`, `label`, `choices`, `default`, `validate`)
 *      and runs them as a single prompt batch. Bails fast with `requireTTY` if
 *      stdin is not a TTY.
 *   2. Assembles the payload by iterating every field in `fieldMetadata`:
 *      - Pulls the value from `options[flagName]` (or from the inquirer answers).
 *      - Falls back to `default` when neither is present.
 *      - Applies `transformer` to the raw value before merging.
 *
 * Returns the payload as a `Partial<T>`-compatible plain object.
 */
export function buildDefaultCreatePrompts<T>(
  schema: ResourceSchema
): (options: Options) => Promise<Partial<T>> {
  return async (options) => {
    const metadata = schema.fieldMetadata ?? {};
    const entries = Object.entries(metadata);

    // Trigger condition: any `requiredOnCreate` field is missing from options.
    // Matches the existing per-command pattern where one missing required
    // flag flips the whole create flow into interactive mode.
    const triggered = entries.some(([field, meta]) => {
      if (!meta.requiredOnCreate) return false;
      return isFlagAbsent(options, field, meta);
    });

    const promptQuestions: DistinctQuestion[] = [];
    if (triggered) {
      // Once triggered, batch-prompt every field with an `inquirerType` whose
      // flag is missing — including optional fields with defaults (e.g.
      // heartbeat period/grace). The user can just press enter to accept.
      for (const [field, meta] of entries) {
        if (!meta.inquirerType) continue;
        if (!isFlagAbsent(options, field, meta)) continue;
        promptQuestions.push(toInquirerQuestion(field, meta));
      }
    }

    let answers: Record<string, unknown> = {};
    if (promptQuestions.length > 0) {
      requireTTY((msg) => console.error(chalk.red(`\n❌ ${msg}\n`)));
      answers = (await inquirer.prompt(promptQuestions)) as Record<string, unknown>;
    }

    const payload: Payload = {};
    for (const [field, meta] of entries) {
      const value = resolveValue(field, meta, options, answers);
      if (value !== undefined) payload[field] = value;
    }

    return payload as Partial<T>;
  };
}

/**
 * Default `updatePrompts` callback for the resource-command factory.
 *
 * Behavior:
 *   1. Asserts the user passed at least one updatable flag; otherwise emits an
 *      error via `outputService` and exits with code 1 (mirrors the existing
 *      per-command "Please provide at least one field to update" pattern).
 *   2. Assembles the payload by iterating every updatable field:
 *      - If the CLI flag was passed, uses the flag value (with `transformer`).
 *      - Otherwise, falls back to `existing[field]` so the value is preserved.
 *      - If both are absent, uses `default` (or omits the field).
 *
 * No inquirer prompts on update — `update` is non-interactive by design.
 */
export function buildDefaultUpdatePrompts<T>(
  schema: ResourceSchema,
  outputService: IOutputService
): (id: string, options: Options, existing: T) => Promise<Partial<T>> {
  return async (_id, options, existing) => {
    const metadata = schema.fieldMetadata ?? {};
    const entries = Object.entries(metadata);
    const updatableEntries = entries.filter(([, m]) => m.updatable !== false);

    const anyFlagPassed =
      updatableEntries.some(([field, meta]) => !isFlagAbsent(options, field, meta)) ||
      (schema.extraUpdateTriggers ?? []).some((flag) => options[flag] !== undefined);

    if (!anyFlagPassed) {
      const updatableFlags = updatableEntries
        .map(([field, meta]) => meta.flagName ?? field)
        .filter((f) => f)
        .map((f) => `--${kebab(f)}`);
      const hint = updatableFlags.length > 0 ? ` (${updatableFlags.join(', ')})` : '';
      outputService.error(`Please provide at least one field to update${hint}.`);
      process.exit(1);
    }

    // `existing` is a generic `T` so we cast to a row to index by API field name.
    const existingRecord = (existing ?? {}) as Record<string, unknown>;
    const payload: Payload = {};
    for (const [field, meta] of updatableEntries) {
      const flag = meta.flagName ?? field;
      const flagAbsent = isFlagAbsent(options, field, meta);
      const raw = flagAbsent ? undefined : options[flag];
      let value: unknown;
      if (raw !== undefined) {
        value = meta.transformer ? meta.transformer(raw) : raw;
        assertChoice(field, meta, value);
      } else if (existingRecord[field] != null) {
        // `!= null` matches the existing `??`-chain semantics used across the
        // hand-rolled commands — both undefined and null fall through to default.
        value = existingRecord[field];
      } else if (meta.default !== undefined) {
        value = meta.default;
      } else {
        continue;
      }
      payload[field] = value;
    }
    return payload as Partial<T>;
  };
}

function toInquirerQuestion(field: string, meta: FieldSchema): DistinctQuestion {
  const question: DistinctQuestion = {
    type: meta.inquirerType ?? 'input',
    name: field,
    message: meta.label ?? `${field}:`,
  };
  if (meta.choices) {
    (question as { choices: readonly string[] }).choices = meta.choices;
  }
  if (meta.default !== undefined) {
    (question as { default: unknown }).default = meta.default;
  }
  if (meta.validate) {
    (question as { validate: (val: unknown) => boolean | string }).validate = meta.validate;
  }
  return question;
}

function resolveValue(
  field: string,
  meta: FieldSchema,
  options: Options,
  answers: Record<string, unknown>
): unknown {
  const flag = meta.flagName ?? field;
  const fromOptions = isFlagAbsent(options, field, meta) ? undefined : options[flag];
  const fromAnswers = field in answers ? answers[field] : undefined;
  const raw = fromOptions !== undefined ? fromOptions : fromAnswers;
  if (raw !== undefined) {
    const transformed = meta.transformer ? meta.transformer(raw) : raw;
    assertChoice(field, meta, transformed);
    return transformed;
  }
  return meta.default;
}

/**
 * Returns true when the user didn't actually supply this flag — either it's
 * undefined or it's an empty array that the schema marked as
 * `treatEmptyArrayAsAbsent` (commander's repeatable-option default).
 */
function isFlagAbsent(options: Options, field: string, meta: FieldSchema): boolean {
  const flag = meta.flagName ?? field;
  const raw = options[flag];
  if (raw === undefined) return true;
  if (meta.treatEmptyArrayAsAbsent && Array.isArray(raw) && raw.length === 0) return true;
  return false;
}

/**
 * Reject CLI/prompt input that's not a member of `meta.choices`. Skipped when
 * `meta.choices` is undefined or the value comes from `existing[field]` (which
 * is presumed valid because it came from the backend).
 */
function assertChoice(field: string, meta: FieldSchema, value: unknown): void {
  if (!meta.choices) return;
  if (meta.choices.includes(value as string)) return;
  throw new Error(
    `Invalid ${field}: '${String(value)}'. Must be one of: ${meta.choices.join(', ')}`
  );
}

/** camelCase → kebab-case for help-message rendering of flag names. */
function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}
