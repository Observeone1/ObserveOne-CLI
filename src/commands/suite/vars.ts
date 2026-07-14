import { readFileSync } from 'node:fs';
import inquirer from 'inquirer';

function normalizeKey(key: string): string {
  return key.trim().toUpperCase().replace(/\s+/g, '_');
}

/**
 * Split `--var` flags into values supplied inline (`KEY=VALUE`) and bare keys
 * (`KEY` with no `=value`) that must be prompted for securely. Keeping secret
 * values off the command line avoids leaking them into shell history, `ps`, and
 * /proc/<pid>/cmdline.
 */
export function partitionVarFlags(vars: string[]): {
  resolved: Record<string, string>;
  needsPrompt: string[];
} {
  const resolved: Record<string, string> = {};
  const needsPrompt: string[] = [];
  for (const v of vars) {
    const idx = v.indexOf('=');
    if (idx === -1) {
      // Bare `--var KEY`: value omitted on purpose, prompt for it (masked).
      const key = normalizeKey(v);
      if (!key) throw new Error(`Invalid --var format: "${v}". Key cannot be empty`);
      if (!needsPrompt.includes(key)) needsPrompt.push(key);
    } else {
      const key = normalizeKey(v.slice(0, idx));
      if (!key) throw new Error(`Invalid --var format: "${v}". Key cannot be empty`);
      resolved[key] = v.slice(idx + 1);
    }
  }
  return { resolved, needsPrompt };
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

/**
 * Resolve suite variables from (in increasing precedence): a `--var-file`,
 * inline `--var KEY=VALUE` flags, and finally masked prompts for any bare
 * `--var KEY` flags. Prompting is refused in non-interactive contexts
 * (non-TTY or JSON output) to avoid hangs and corrupting JSON payloads.
 */
export async function resolveVars(
  varFlags: string[],
  varFile: string | undefined,
  opts: { isJson?: boolean | undefined; outputError: (msg: string) => void }
): Promise<Record<string, string> | undefined> {
  const result: Record<string, string> = {};
  if (varFile) Object.assign(result, parseVarFile(varFile));

  const { resolved, needsPrompt } = partitionVarFlags(varFlags);
  Object.assign(result, resolved);

  if (needsPrompt.length > 0) {
    if (!process.stdin.isTTY || opts.isJson) {
      opts.outputError(
        'A secret value prompt is required but cannot run non-interactively. ' +
          'Pass --var KEY=VALUE or --var-file <path> instead.'
      );
      process.exit(1);
    }
    for (const key of needsPrompt) {
      const { value } = await inquirer.prompt([
        {
          type: 'password',
          name: 'value',
          mask: '*',
          message: `Value for ${key} (input hidden):`,
        },
      ]);
      result[key] = value as string;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}
