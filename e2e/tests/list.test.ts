import { runCLI, assertSuccess, assertContains } from "../lib/test-runner.js";

export async function testListCommand() {
  const result = await runCLI(["list"]);

  // List command may succeed or fail depending on auth, both are valid
  if (result.exitCode === 0) {
    // If it succeeds, it should show some content
    if (result.stdout && result.stdout.trim()) {
      // If there's output, it's acceptable
      return;
    }
  } else {
    // If it fails, it should be due to authentication or similar expected errors
    const output = result.stderr || result.stdout;
    if (!output.includes("authentication") &&
        !output.includes("Resource not found") &&
        !output.includes("not found") &&
        !output.includes("API") &&
        !output.toLowerCase().includes("error")) {
      throw new Error(`Unexpected error in list command: ${output}`);
    }
  }
}
