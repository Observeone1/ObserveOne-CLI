import { readFileSync } from 'fs';

function normalizeKey(key: string): string {
  return key.trim().toUpperCase().replace(/\s+/g, '_');
}

export function parseVarFlags(vars: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const v of vars) {
    const idx = v.indexOf('=');
    if (idx === -1) throw new Error(`Invalid --var format: "${v}". Expected KEY=VALUE`);
    result[normalizeKey(v.slice(0, idx))] = v.slice(idx + 1);
  }
  return result;
}

export function parseVarFile(filePath: string): Record<string, string> {
  const content = readFileSync(filePath, 'utf8');
  const result: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = normalizeKey(trimmed.slice(0, idx));
    const value = trimmed.slice(idx + 1).replace(/^["']|["']$/g, '');
    result[key] = value;
  }
  return result;
}

export function mergeVars(
  varFlags: string[],
  varFile?: string
): Record<string, string> | undefined {
  const result: Record<string, string> = {};
  if (varFile) Object.assign(result, parseVarFile(varFile));
  Object.assign(result, parseVarFlags(varFlags));
  return Object.keys(result).length > 0 ? result : undefined;
}
