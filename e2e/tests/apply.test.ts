import {
  runCLI,
  assertSuccess,
  assertContains,
  assertJSON,
  assertFailure,
} from "../lib/test-runner.js";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { join } from "path";

/**
 * E2E test for Declarative Apply Workflow
 */
export async function testDeclarativeApply() {
  const timestamp = Date.now();
  const testConfigFile = join(process.cwd(), `e2e-obs-${timestamp}.json`);

  const configContent = {
    monitors: [
      {
        name: `E2E-Apply-Monitor-${timestamp}`,
        url: "https://example.com/apply-test",
        interval: "*/10 * * * *",
        alert_on_failure: true,
      },
    ],
    api_checks: [
      {
        name: `E2E-Apply-Check-${timestamp}`,
        url: "https://api.example.com/apply",
        method: "GET",
      },
    ],
  };

  try {
    // 1. Create config file
    writeFileSync(testConfigFile, JSON.stringify(configContent, null, 2));

    // 2. Initial Apply (Create)
    console.log("      - Running initial apply (create)...");
    const createResult = await runCLI(["apply", testConfigFile, "--json"]);
    assertSuccess(createResult, "Initial apply failed");
    assertJSON(createResult.stdout, "Apply output should be JSON");

    const parsedCreate = JSON.parse(createResult.stdout);
    if (parsedCreate.data?.summary?.monitors?.created !== 1) {
      throw new Error("Expected 1 monitor to be created");
    }
    if (parsedCreate.data?.summary?.apiChecks?.created !== 1) {
      throw new Error("Expected 1 API check to be created");
    }

    // 3. Second Apply (Update/No-op)
    console.log("      - Running second apply (update)...");
    const updateResult = await runCLI(["apply", testConfigFile, "--json"]);
    assertSuccess(updateResult, "Second apply failed");

    const parsedUpdate = JSON.parse(updateResult.stdout);
    if (parsedUpdate.data?.summary?.monitors?.updated !== 1) {
      throw new Error("Expected 1 monitor to be updated");
    }
    if (parsedUpdate.data?.summary?.apiChecks?.updated !== 1) {
      throw new Error("Expected 1 API check to be updated");
    }

    // 4. Verify resources exist in list
    const listResult = await runCLI(["monitor", "list", "--json"]);
    assertContains(listResult.stdout, configContent.monitors[0].name);
  } finally {
    // Cleanup: Remove the file
    if (existsSync(testConfigFile)) {
      unlinkSync(testConfigFile);
    }

    // Cleanup: Delete the created resources from backend
    console.log("      - [Cleanup] Removing declarative resources...");

    // We have to list them to get IDs since apply doesn't return the raw IDs directly in the summary
    const monitorListResult = await runCLI(["monitor", "list", "--json"]);
    if (monitorListResult.exitCode === 0) {
      const monitors = JSON.parse(monitorListResult.stdout).data || [];
      const m = monitors.find(
        (m: any) => m.name === configContent.monitors[0].name,
      );
      if (m && m.id) {
        await runCLI(["monitor", "delete", m.id.toString(), "-y", "--json"]);
      }
    }

    const checkListResult = await runCLI(["check", "list", "--json"]);
    if (checkListResult.exitCode === 0) {
      const checks = JSON.parse(checkListResult.stdout).data || [];
      const c = checks.find(
        (c: any) => c.name === configContent.api_checks[0].name,
      );
      if (c && c.id) {
        await runCLI(["check", "delete", c.id.toString(), "-y", "--json"]);
      }
    }
  }
}
