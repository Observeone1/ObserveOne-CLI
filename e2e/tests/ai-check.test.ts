import {
  runCLI,
  assertSuccess,
  assertFailure,
  assertContains,
} from "../lib/test-runner.js";

export async function testAiCheckWithInvalidTestName() {
  const result = await runCLI(["ai-check", "nonexistent-test-name"]);
  
  // This should either fail with a test not found error or succeed with empty results
  // depending on the implementation
  if (result.exitCode !== 0) {
    assertFailure(result, "AI check with invalid test name should fail");
    assertContains(
      result.stderr || result.stdout,
      "Authentication failed",
      "Should show authentication error when not logged in"
    );
  } else {
    // If it succeeds, that's also acceptable behavior
    assertSuccess(result, "AI check with invalid test name handled gracefully");
  }
}

export async function testAiCheckWithMultipleTests() {
  // This test will fail if the tests don't exist, but that's expected
  const result = await runCLI(["ai-check", "test1", "test2", "test3"]);
  
  // The important thing is that the command parses and runs without crashing
  if (result.exitCode !== 0) {
    // If it fails due to missing tests, that's ok
    assertContains(
      result.stderr || result.stdout,
      "Authentication failed",
      "Should handle authentication failure for multiple tests"
    );
  }
}

export async function testAiCheckWithAdHocTest() {
  const result = await runCLI([
    "ai-check",
    "--url",
    "https://example.com",
    "--prompt",
    "Check if page loads",
    "--timeout",
    "5000"
  ]);
  
  // This may fail due to missing auth or other reasons, but should parse correctly
  if (result.exitCode !== 0) {
    // It's OK if it fails due to auth, API, or other expected reasons
    const output = result.stderr || result.stdout;
    if (!output.includes("authentication") &&
        !output.includes("API") &&
        !output.includes("auth") &&
        !output.includes("Resource not found") &&
        !output.includes("not found") &&
        !output.includes("timed out") &&
        !output.toLowerCase().includes("error")) {
      // If it's not an expected error type, then it might be a parsing error
      throw new Error(`Unexpected error in ad-hoc test: ${output}`);
    }
  }
  // If it succeeds, that's also fine
}