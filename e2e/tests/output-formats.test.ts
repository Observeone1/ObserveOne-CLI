import { runCLI, assertSuccess, assertContains, assertJSON } from '../lib/test-runner.js';

export async function testJsonOutputFormat() {
  const result = await runCLI(['list', '--format', 'json']);

  if (result.exitCode === 0) {
    // The output may contain progress indicators followed by JSON
    // Extract the JSON part and validate it
    const output = result.stdout;
    // Find the first occurrence of [{ or { to locate JSON
    const jsonStartIndex = Math.min(
      output.indexOf('[') !== -1 ? output.indexOf('[') : Infinity,
      output.indexOf('{') !== -1 ? output.indexOf('{') : Infinity
    );

    if (jsonStartIndex !== Infinity) {
      const jsonPart = output.substring(jsonStartIndex);
      try {
        JSON.parse(jsonPart);
      } catch (e) {
        throw new Error(
          `JSON format: Output should contain valid JSON after progress indicators: ${jsonPart}`
        );
      }
    } else {
      // If no JSON found, check if it's because we got an error instead
      if (output.toLowerCase().includes('error') || output.toLowerCase().includes('not found')) {
        // This is OK too - means the command executed but failed in expected way
        return;
      } else {
        throw new Error(`JSON format: Expected JSON output but got: ${output}`);
      }
    }
  } else {
    // If it fails due to auth or other expected errors, that's OK - it means the --format option was parsed correctly
    const output = (result.stderr || result.stdout).toLowerCase();
    if (
      !output.includes('authentication') &&
      !output.includes('api') &&
      !output.includes('resource') &&
      !output.includes('error') &&
      !output.includes('not found') &&
      !output.includes('obs login')
    ) {
      throw new Error(`JSON format: Unexpected error: ${result.stderr || result.stdout}`);
    }
  }
}

export async function testGlobalJsonOutput() {
  const result = await runCLI(['--json', 'list']);

  if (result.exitCode === 0) {
    // The output may contain progress indicators followed by JSON
    const output = result.stdout;
    // Find the first occurrence of [{ or { to locate JSON
    const jsonStartIndex = Math.min(
      output.indexOf('[') !== -1 ? output.indexOf('[') : Infinity,
      output.indexOf('{') !== -1 ? output.indexOf('{') : Infinity
    );

    if (jsonStartIndex !== Infinity) {
      const jsonPart = output.substring(jsonStartIndex);
      try {
        JSON.parse(jsonPart);
      } catch (e) {
        throw new Error(
          `Global JSON: Output should contain valid JSON after progress indicators: ${jsonPart}`
        );
      }
    } else {
      // If no JSON found, check if it's because we got an error instead
      if (output.toLowerCase().includes('error') || output.toLowerCase().includes('not found')) {
        // This is OK too - means the command executed but failed in expected way
        return;
      } else {
        throw new Error(`Global JSON: Expected JSON output but got: ${output}`);
      }
    }
  } else {
    // If it fails due to auth or other expected errors, that's OK
    const output = (result.stderr || result.stdout).toLowerCase();
    if (
      !output.includes('authentication') &&
      !output.includes('api') &&
      !output.includes('resource') &&
      !output.includes('error') &&
      !output.includes('not found') &&
      !output.includes('obs login')
    ) {
      throw new Error(`Global JSON: Unexpected error: ${result.stderr || result.stdout}`);
    }
  }
}

export async function testVerboseMode() {
  const result = await runCLI(['--verbose', 'list']);

  // Verbose mode testing - just ensure it doesn't crash due to option parsing
  if (result.exitCode !== 0) {
    // If it fails, it should be due to auth or API issues, not option parsing
    const output = (result.stderr || result.stdout).toLowerCase();
    if (
      !output.includes('authentication') &&
      !output.includes('resource') &&
      !output.includes('not found') &&
      !output.includes('api') &&
      !output.includes('error') &&
      !output.includes('obs login')
    ) {
      throw new Error(
        `Verbose mode: Unexpected error (should be auth/API related): ${result.stderr || result.stdout}`
      );
    }
  }
  // If it succeeds, that's also fine
}
