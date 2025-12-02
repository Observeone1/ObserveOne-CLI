import {
  runCLI,
  assertSuccess,
  assertFailure,
  assertContains,
} from "../lib/test-runner.js";

// Read API key from environment variable
function getApiKeyFromEnv(): string | undefined {
  return process.env.OBS1_API_KEY || process.env.API_KEY;
}

export async function testGlobalApiKeyOption() {
  const apiKey = getApiKeyFromEnv();

  if (!apiKey) {
    throw new Error("No API key found in environment variables (OBS1_API_KEY or API_KEY). Please set one.");
  }

  const result = await runCLI(["--api-key", apiKey, "login", "--skip-setup"]);

  // The important thing is that the option is parsed and used - either success or invalid key error is OK
  if (result.exitCode === 0) {
    // Success case
    assertContains(
      result.stdout,
      "Successfully authenticated",
      "Should show success message with global API key"
    );
  } else {
    // If it fails, it should be an API key validation error, not a parsing error
    const output = result.stderr || result.stdout;
    if (!output.includes("Invalid API key provided") && !output.includes("authentication")) {
      throw new Error(`Expected API key validation error, but got: ${output}`);
    }
  }
}

export async function testLoginCommandApiKeyOption() {
  const apiKey = getApiKeyFromEnv();

  if (!apiKey) {
    throw new Error("No API key found in environment variables (OBS1_API_KEY or API_KEY). Please set one.");
  }

  const result = await runCLI(["login", "--api-key", apiKey, "--skip-setup"]);

  // The important thing is that the option is parsed and used - either success or invalid key error is OK
  if (result.exitCode === 0) {
    // Success case
    assertContains(
      result.stdout,
      "Successfully authenticated",
      "Should show success message with command-specific API key"
    );
  } else {
    // If it fails, it should be an API key validation error, not a parsing error
    const output = result.stderr || result.stdout;
    if (!output.includes("Invalid API key provided") && !output.includes("authentication")) {
      throw new Error(`Expected API key validation error, but got: ${output}`);
    }
  }
}

export async function testShortApiKeyOption() {
  const apiKey = getApiKeyFromEnv();

  if (!apiKey) {
    throw new Error("No API key found in environment variables (OBS1_API_KEY or API_KEY). Please set one.");
  }

  const result = await runCLI(["login", "-k", apiKey, "--skip-setup"]);

  // The important thing is that the option is parsed and used - either success or invalid key error is OK
  if (result.exitCode === 0) {
    // Success case
    assertContains(
      result.stdout,
      "Successfully authenticated",
      "Should show success message with short API key option"
    );
  } else {
    // If it fails, it should be an API key validation error, not a parsing error
    const output = result.stderr || result.stdout;
    if (!output.includes("Invalid API key provided") && !output.includes("authentication")) {
      throw new Error(`Expected API key validation error, but got: ${output}`);
    }
  }
}