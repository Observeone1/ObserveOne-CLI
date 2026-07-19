import { spawn, SpawnOptions } from 'node:child_process';
import { join } from 'node:path';

// Load environment variables from root .env file for test runner
// The CLI also loads .env separately when it runs
try {
  const dotenv = await import('dotenv');
  dotenv.config({ path: join(process.cwd(), '.env') });
} catch (e) {
  // dotenv might not be available in all contexts, that's ok — but surface it
  // under a debug flag so a genuinely broken .env load isn't silently invisible.
  if (process.env.OBS_E2E_DEBUG === 'true') {
    console.warn(`[test-runner] dotenv load skipped: ${(e as Error).message}`);
  }
}

export interface CLIResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Run the CLI with the given arguments and return the result
 */
export async function runCLI(
  args: string[],
  timeoutMs: number = 30000,
  envOverrides?: Record<string, string | undefined>
): Promise<CLIResult> {
  return new Promise((resolve) => {
    const binaryMode = process.env.OBS_BINARY_MODE || 'local';
    const isWindows = process.platform === 'win32';

    let command: string;
    let commandArgs: string[];
    let useShell = false;

    // Determine command based on binary mode
    switch (binaryMode) {
      case 'local':
        // Use local build (default behavior)
        command = 'node';
        commandArgs = [join(process.cwd(), 'dist', 'index.js'), ...args];
        break;

      case 'npx':
        // Use npx to run the published package
        command = 'npx';
        commandArgs = ['@observeone/cli', ...args]; // Updated package name
        useShell = isWindows;
        break;

      case 'global':
        // Use globally installed obs command
        // On Windows, .cmd files need shell to execute
        command = 'obs';
        commandArgs = args;
        useShell = isWindows;
        break;

      default:
        // Use custom path/command
        command = binaryMode;
        commandArgs = args;
        break;
    }

    const env: Record<string, string | undefined> = {
      ...process.env,
      // Use test API URL and key from environment
      OBS_API_URL: process.env.API_URL || process.env.OBS_API_URL,
      OBS_API_KEY: process.env.OBS_API_KEY || process.env.API_KEY,
      DOTENV_QUIET: 'true',
      DOTENV_CONFIG_SILENT: 'true',
    };

    if (envOverrides) {
      Object.keys(envOverrides).forEach((key) => {
        if (envOverrides[key] === undefined) {
          delete env[key];
        } else {
          env[key] = envOverrides[key];
        }
      });
    }

    const options: SpawnOptions = {
      env: env as NodeJS.ProcessEnv,
      shell: useShell,
    };

    const child = spawn(command, commandArgs, options);

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    const timeoutTimer = setTimeout(() => {
      child.kill('SIGTERM');
    }, timeoutMs);

    child.on('close', (code) => {
      clearTimeout(timeoutTimer);
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 0,
      });
    });
  });
}

/**
 * Assert that a condition is true
 */
export function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

/**
 * Assert that the CLI command succeeded (exit code 0)
 */
export function assertSuccess(result: CLIResult, message: string): void {
  if (result.exitCode !== 0) {
    throw new Error(
      String.raw`${message}\nExpected exit code 0, got ${result.exitCode}\nStderr: ${result.stderr}`
    );
  }
}

/**
 * Assert that the CLI command failed (non-zero exit code)
 */
export function assertFailure(result: CLIResult, message: string): void {
  if (result.exitCode === 0) {
    throw new Error(
      String.raw`${message}\nExpected non-zero exit code, got 0\nStdout: ${result.stdout}`
    );
  }
}

/**
 * Assert that output contains specific text
 */
export function assertContains(output: string, text: string, message?: string): void {
  if (!output.includes(text)) {
    throw new Error(
      String.raw`${message || 'Output should contain text'}\nExpected to find: "${text}"\nGot: ${output}`
    );
  }
}

/**
 * Assert that output is valid JSON
 */
export function assertJSON(output: string, message?: string): void {
  try {
    // Find the first '{' and last '}' to extract the JSON object
    const start = output.indexOf('{');
    const end = output.lastIndexOf('}');

    if (start === -1 || end === -1 || end < start) {
      throw new Error('No JSON object found in output');
    }

    const jsonStr = output.substring(start, end + 1);
    JSON.parse(jsonStr);
  } catch (error) {
    throw new Error(String.raw`${message || 'Output should be valid JSON'}\nGot: ${output}`, {
      cause: error,
    });
  }
}

/**
 * Assert that output is a single JSON document with no surrounding noise.
 * Stricter than assertJSON: rejects empty output, leading non-JSON (BOM, ANSI,
 * SSE markers, spinner frames), and trailing garbage after the document.
 */
export function assertStrictJSON(output: string, message?: string): void {
  const label = message || 'Output should be strict JSON only';
  const trimmed = output.trim();

  if (trimmed.length === 0) {
    throw new Error(`${label} — empty output\nGot: ${JSON.stringify(output)}`);
  }
  if (!/^[[{]/.test(trimmed)) {
    throw new Error(`${label} — leading non-JSON content\nGot: ${output}`);
  }
  try {
    JSON.parse(trimmed);
  } catch (_error) {
    throw new Error(`${label}\nGot: ${output}`);
  }
}
