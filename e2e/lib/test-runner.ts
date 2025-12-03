import { spawn, SpawnOptions } from "child_process";
import { join } from "path";

// Load environment variables from root .env file for test runner
// The CLI also loads .env separately when it runs
try {
  const dotenv = await import("dotenv");
  dotenv.config({ path: join(process.cwd(), ".env") });
} catch (e) {
  // dotenv might not be available in all contexts, that's ok
}

export interface CLIResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Run the CLI with the given arguments and return the result
 */
export async function runCLI(args: string[]): Promise<CLIResult> {
  return new Promise((resolve) => {
    const binaryMode = process.env.OBS1_BINARY_MODE || "local";
    const isWindows = process.platform === "win32";
    
    let command: string;
    let commandArgs: string[];
    let useShell = false;
    
    // Determine command based on binary mode
    switch (binaryMode) {
      case "local":
        // Use local build (default behavior)
        command = "node";
        commandArgs = [join(process.cwd(), "dist", "index.js"), ...args];
        break;
      
      case "npx":
        // Use npx to run the published package
        command = "npx";
        commandArgs = ["observeone-cli", ...args];
        useShell = isWindows; // npx needs shell on Windows
        break;
      
      case "global":
        // Use globally installed obs1 command
        // On Windows, .cmd files need shell to execute
        command = "obs1";
        commandArgs = args;
        useShell = isWindows;
        break;
      
      default:
        // Use custom path/command
        command = binaryMode;
        commandArgs = args;
        break;
    }
    
    const options: SpawnOptions = {
      env: {
        ...process.env,
        // Use test API URL and key from environment
        OBS1_API_URL: process.env.API_URL,
      },
      shell: useShell,
    };

    const child = spawn(command, commandArgs, options);

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
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
      `${message}\\nExpected exit code 0, got ${result.exitCode}\\nStderr: ${result.stderr}`
    );
  }
}

/**
 * Assert that the CLI command failed (non-zero exit code)
 */
export function assertFailure(result: CLIResult, message: string): void {
  if (result.exitCode === 0) {
    throw new Error(
      `${message}\\nExpected non-zero exit code, got 0\\nStdout: ${result.stdout}`
    );
  }
}

/**
 * Assert that output contains specific text
 */
export function assertContains(
  output: string,
  text: string,
  message?: string
): void {
  if (!output.includes(text)) {
    throw new Error(
      `${message || "Output should contain text"}\\nExpected to find: "${text}"\\nGot: ${output}`
    );
  }
}

/**
 * Assert that output is valid JSON
 */
export function assertJSON(output: string, message?: string): void {
  try {
    JSON.parse(output);
  } catch (error) {
    throw new Error(
      `${message || "Output should be valid JSON"}\\nGot: ${output}`
    );
  }
}
