export type CliListInput = string | string[] | undefined;

export function collectOptionValues(value: string, previous: string[] = []): string[] {
  previous.push(value);
  return previous;
}

export function parseKeyValuePairs(
  input: CliListInput,
  label: string
): Record<string, string> | undefined {
  if (!input) return undefined;

  const values = Array.isArray(input) ? input : [input];
  if (values.length === 0) return undefined;
  const result: Record<string, string> = {};

  for (const entry of values) {
    const idx = entry.indexOf('=');
    if (idx <= 0) {
      throw new Error(`Invalid --${label} format: "${entry}". Expected KEY=VALUE`);
    }

    const key = entry.slice(0, idx).trim();
    const value = entry.slice(idx + 1).trim();

    if (!key) {
      throw new Error(`Invalid --${label} format: "${entry}". Key cannot be empty`);
    }

    result[key] = value;
  }

  return result;
}

export function parseJsonArrayOption<T>(input: CliListInput, label: string): T[] | undefined {
  if (!input) return undefined;

  const values = Array.isArray(input) ? input : [input];
  if (values.length === 0) return undefined;
  return values.map((entry) => {
    try {
      return JSON.parse(entry) as T;
    } catch {
      throw new Error(`Invalid --${label} JSON: "${entry}"`);
    }
  });
}

export function parseIdList(input: CliListInput, label: string): string[] | undefined {
  if (!input) return undefined;

  const values = Array.isArray(input) ? input : [input];
  if (values.length === 0) return undefined;
  return values.map((entry) => {
    const trimmed = entry.trim();
    if (!trimmed) {
      throw new Error(`Invalid --${label} value: "${entry}". Value cannot be empty`);
    }
    return trimmed;
  });
}

/**
 * Parse IDs out of piped text for chainable bulk actions, e.g.
 *   `obs schedule list --json | jq -r '.data[].id' | obs schedule bulk stop --stdin`.
 *
 * Accepts either a JSON array of strings/objects (`[{"id":"..."}]` or `["..."]`)
 * or plain whitespace/newline-separated tokens. Deduplicates while preserving
 * order and drops empty tokens.
 */
export function parseIdsFromText(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  let tokens: string[] = [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        tokens = parsed
          .map((item) => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object' && 'id' in item) {
              return String((item as { id: unknown }).id);
            }
            return '';
          })
          .filter((t) => t.length > 0);
      }
    } catch {
      // Fall back to whitespace splitting below.
    }
  }

  if (tokens.length === 0) {
    tokens = trimmed.split(/\s+/);
  }

  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tokens) {
    const id = raw.trim();
    if (id && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  return result;
}
