import { runCLI, assertSuccess, assertJSON } from "../lib/test-runner.js";
import { unlinkSync, existsSync, readFileSync } from "fs";
import { join } from "path";

/**
 * E2E test for Declarative Export Workflow
 */
export async function testDeclarativeExport() {
  const timestamp = Date.now();
  const testExportFile = join(process.cwd(), `e2e-export-${timestamp}.json`);
  const monitorName = `E2E-Export-Monitor-${timestamp}`;
  const checkName = `E2E-Export-Check-${timestamp}`;

  let monitorId: number | undefined;
  let checkId: number | undefined;

  try {
    // 1. Create a monitor to export
    const createMonResult = await runCLI([
      "monitor", "create",
      "--name", monitorName,
      "--url", "https://example.com/export-test",
      "--interval", "*/10 * * * *",
      "--json"
    ]);
    monitorId = JSON.parse(createMonResult.stdout).data?.id;

    // 2. Create an API check to export
    const createCheckResult = await runCLI([
      "check", "create",
      "--name", checkName,
      "--url", "https://api.example.com/export",
      "--method", "GET",
      "--json"
    ]);
    checkId = JSON.parse(createCheckResult.stdout).data?.id;

    // 3. Run Export
    console.log("      - Running export...");
    const exportResult = await runCLI([
      "export",
      "-f", testExportFile,
      "--json"
    ]);
    assertSuccess(exportResult, "Export failed");
    assertJSON(exportResult.stdout, "Export output should be JSON");

    // 4. Verify the exported file
    if (!existsSync(testExportFile)) {
      throw new Error(`Export file ${testExportFile} was not created`);
    }

    const exportedData = JSON.parse(readFileSync(testExportFile, "utf-8"));

    // Check if our test resources made it into the exported config
    const foundMonitor = exportedData.monitors?.find((m: any) => m.name === monitorName);
    if (!foundMonitor) {
      throw new Error("Created test monitor was not found in exported file");
    }
    if (foundMonitor.url !== "https://example.com/export-test") {
      throw new Error("Exported monitor URL mismatch");
    }

    const foundCheck = exportedData.api_checks?.find((c: any) => c.name === checkName);
    if (!foundCheck) {
      throw new Error("Created test API check was not found in exported file");
    }

  } finally {
    // Cleanup: Remove the exported file
    if (existsSync(testExportFile)) {
      unlinkSync(testExportFile);
    }

    // Cleanup: Delete the created resources from backend
    console.log("      - [Cleanup] Removing export test resources...");
    if (monitorId) {
      await runCLI(["monitor", "delete", monitorId.toString(), "-y", "--json"]);
    }
    if (checkId) {
      await runCLI(["check", "delete", checkId.toString(), "-y", "--json"]);
    }
  }
}
