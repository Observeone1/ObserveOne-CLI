export function collectOptionValues(value: string, previous: string[] = []): string[] {
  previous.push(value);
  return previous;
}

export function parseKeyValuePairs(
  input: string | string[] | undefined,
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

export function parseJsonArrayOption<T>(
  input: string | string[] | undefined,
  label: string
): T[] | undefined {
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

export function parseIdList(
  input: string | string[] | undefined,
  label: string
): string[] | undefined {
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
