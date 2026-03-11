import { runCLI, assertSuccess, assertContains, assertJSON, assertFailure } from "../lib/test-runner.js";

/**
 * E2E tests for Monitor Lifecycle
 */
export async function testMonitorLifecycle() {
  const timestamp = Date.now();
  const monitorName = `E2E-Monitor-${timestamp}`;
  const monitorUrl = "https://example.com/e2e-test";

  // 1. Create
  console.log("      - Creating monitor...");
  const createResult = await runCLI([
    "monitor", "create",
    "--name", monitorName,
    "--url", monitorUrl,
    "--interval", "*/10 * * * *",
    "--json"
  ]);
  assertSuccess(createResult, "Monitor creation failed");
  assertJSON(createResult.stdout, "Create output should be JSON");
  const createdMonitor = JSON.parse(createResult.stdout);
  const monitorId = createdMonitor.id || createdMonitor.data?.id;
  if (!monitorId) throw new Error("Could not extract monitor ID from creation response");

  // 2. List
  console.log("      - Listing monitors...");
  const listResult = await runCLI(["monitor", "list", "--json"]);
  assertSuccess(listResult, "Monitor list failed");
  assertContains(listResult.stdout, monitorName, "Created monitor name not found in list");

  // 3. Get
  console.log(`      - Getting monitor ${monitorId}...`);
  const getResult = await runCLI(["monitor", "get", monitorId.toString(), "--json"]);
  assertSuccess(getResult, "Monitor get failed");
  const fetchedMonitor = JSON.parse(getResult.stdout);
  const fetchedId = fetchedMonitor.id || fetchedMonitor.data?.id;
  if (fetchedId !== monitorId) throw new Error(`Fetched ID ${fetchedId} does not match ${monitorId}`);

  // 4. Update
  console.log(`      - Updating monitor ${monitorId}...`);
  const updatedName = `${monitorName}-Updated`;
  const updateResult = await runCLI([
    "monitor", "update", monitorId.toString(),
    "--name", updatedName,
    "--json"
  ]);
  assertSuccess(updateResult, "Monitor update failed");

  // 5. Toggle
  console.log(`      - Toggling monitor ${monitorId}...`);
  const toggleResult = await runCLI(["monitor", "toggle", monitorId.toString(), "--json"]);
  assertSuccess(toggleResult, "Monitor toggle failed");

  // 6. Delete
  console.log(`      - Deleting monitor ${monitorId}...`);
  const deleteResult = await runCLI(["monitor", "delete", monitorId.toString(), "-y", "--json"]);
  assertSuccess(deleteResult, "Monitor delete failed");

  // 7. Verify deletion (Get should fail or return empty/not found)
  console.log(`      - Verifying monitor ${monitorId} deletion...`);
  const verifyResult = await runCLI(["monitor", "get", monitorId.toString()]);
  assertFailure(verifyResult, "Monitor should not be findable after deletion");
}

/**
 * E2E tests for API Check Lifecycle
 */
export async function testApiCheckLifecycle() {
  const timestamp = Date.now();
  const checkName = `E2E-Check-${timestamp}`;
  const checkUrl = "https://api.example.com/v1/health";

  // 1. Create
  console.log("      - Creating API check...");
  const createResult = await runCLI([
    "check", "create",
    "--name", checkName,
    "--url", checkUrl,
    "--method", "GET",
    "--json"
  ]);
  assertSuccess(createResult, "API check creation failed");
  const createdCheck = JSON.parse(createResult.stdout);
  const checkId = createdCheck.id || createdCheck.data?.id;

  // 2. List
  console.log("      - Listing API checks...");
  const listResult = await runCLI(["check", "list", "--json"]);
  assertSuccess(listResult, "API check list failed");
  assertContains(listResult.stdout, checkName);

  // 3. Get
  console.log(`      - Getting API check ${checkId}...`);
  const getResult = await runCLI(["check", "get", checkId.toString(), "--json"]);
  assertSuccess(getResult, "API check get failed");

  // 4. Update
  console.log(`      - Updating API check ${checkId}...`);
  const updateResult = await runCLI([
    "check", "update", checkId.toString(),
    "--method", "POST",
    "--json"
  ]);
  assertSuccess(updateResult, "API check update failed");

  // 5. Delete
  console.log(`      - Deleting API check ${checkId}...`);
  const deleteResult = await runCLI(["check", "delete", checkId.toString(), "-y", "--json"]);
  assertSuccess(deleteResult, "API check delete failed");
}

/**
 * E2E tests for Heartbeat Lifecycle
 */
export async function testHeartbeatLifecycle() {
  const timestamp = Date.now();
  const hbName = `E2E-HB-${timestamp}`;

  // 1. Create
  console.log("      - Creating heartbeat...");
  const createResult = await runCLI([
    "heartbeat", "create",
    "--name", hbName,
    "--period", "600",
    "--json"
  ]);
  assertSuccess(createResult, "Heartbeat creation failed");
  const createdHb = JSON.parse(createResult.stdout);
  const hbId = createdHb.id || createdHb.data?.id;

  // 2. List
  console.log("      - Listing heartbeats...");
  const listResult = await runCLI(["heartbeat", "list", "--json"]);
  assertSuccess(listResult, "Heartbeat list failed");
  assertContains(listResult.stdout, hbName);

  // 3. Get
  console.log(`      - Getting heartbeat ${hbId}...`);
  const getResult = await runCLI(["heartbeat", "get", hbId.toString(), "--json"]);
  assertSuccess(getResult, "Heartbeat get failed");

  // 4. Toggle
  console.log(`      - Toggling heartbeat ${hbId}...`);
  const toggleResult = await runCLI(["heartbeat", "toggle", hbId.toString(), "--json"]);
  assertSuccess(toggleResult, "Heartbeat toggle failed");

  // 5. Delete
  console.log(`      - Deleting heartbeat ${hbId}...`);
  const deleteResult = await runCLI(["heartbeat", "delete", hbId.toString(), "-y", "--json"]);
  assertSuccess(deleteResult, "Heartbeat delete failed");
}

/**
 * E2E tests for AI Browser Check Lifecycle
 */
export async function testAiCheckLifecycle() {
  const timestamp = Date.now();
  const aiName = `E2E-AI-${timestamp}`;
  const aiUrl = "https://example.com";
  const aiPrompt = "Check if the title is Example Domain";

  // 1. Create
  console.log("      - Creating AI check...");
  const createResult = await runCLI([
    "ai-check", "create",
    "--name", aiName,
    "--url", aiUrl,
    "--prompt", aiPrompt,
    "--json"
  ]);
  assertSuccess(createResult, "AI check creation failed");
  const createdAi = JSON.parse(createResult.stdout);
  const aiId = createdAi.id || createdAi.data?.id;

  // 2. Get
  console.log(`      - Getting AI check ${aiId}...`);
  const getResult = await runCLI(["ai-check", "get", aiId.toString(), "--json"]);
  assertSuccess(getResult, "AI check get failed");

  // 3. Delete
  console.log(`      - Deleting AI check ${aiId}...`);
  const deleteResult = await runCLI(["ai-check", "delete", aiId.toString(), "-y", "--json"]);
  assertSuccess(deleteResult, "AI check delete failed");
}
