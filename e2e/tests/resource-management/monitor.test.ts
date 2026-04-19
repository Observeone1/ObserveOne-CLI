import { runCLI, assertSuccess, assertContains, assertJSON, assertFailure } from '../../lib/test-runner.js';

export async function testMonitorLifecycle() {
  const timestamp = Date.now();
  const monitorName = `E2E-Monitor-${timestamp}`;
  const monitorUrl = 'https://example.com/e2e-test';
  let monitorId: number | undefined;

  try {
    console.log('      - Creating monitor...');
    const createResult = await runCLI([
      'monitor', 'create',
      '--name', monitorName,
      '--url', monitorUrl,
      '--interval', '*/10 * * * *',
      '--json',
    ]);
    assertSuccess(createResult, 'Monitor creation failed');
    assertJSON(createResult.stdout, 'Create output should be JSON');
    const createdMonitor = JSON.parse(createResult.stdout);
    monitorId = createdMonitor.id || createdMonitor.data?.id;
    if (!monitorId) throw new Error('Could not extract monitor ID from creation response');

    console.log('      - Listing monitors...');
    const listResult = await runCLI(['monitor', 'list', '--json']);
    assertSuccess(listResult, 'Monitor list failed');
    assertContains(listResult.stdout, monitorName, 'Created monitor name not found in list');

    console.log(`      - Getting monitor ${monitorId}...`);
    const getResult = await runCLI(['monitor', 'get', monitorId.toString(), '--json']);
    assertSuccess(getResult, 'Monitor get failed');
    const fetchedMonitor = JSON.parse(getResult.stdout);
    const fetchedId = fetchedMonitor.id || fetchedMonitor.data?.id;
    if (fetchedId !== monitorId)
      throw new Error(`Fetched ID ${fetchedId} does not match ${monitorId}`);

    console.log(`      - Updating monitor ${monitorId}...`);
    const updatedName = `${monitorName}-Updated`;
    const updateResult = await runCLI([
      'monitor', 'update', monitorId.toString(),
      '--name', updatedName,
      '--json',
    ]);
    assertSuccess(updateResult, 'Monitor update failed');

    console.log(`      - Toggling monitor ${monitorId}...`);
    const toggleResult = await runCLI(['monitor', 'toggle', monitorId.toString(), '--json']);
    assertSuccess(toggleResult, 'Monitor toggle failed');

    console.log(`      - Deleting monitor ${monitorId}...`);
    const deleteResult = await runCLI(['monitor', 'delete', monitorId.toString(), '-y', '--json']);
    assertSuccess(deleteResult, 'Monitor delete failed');
    monitorId = undefined;

    console.log(`      - Verifying monitor deletion...`);
    const verifyResult = await runCLI(['monitor', 'get', monitorName]);
    assertFailure(verifyResult, 'Monitor should not be findable after deletion');
  } finally {
    if (monitorId) {
      console.log(`      - [Cleanup] Deleting dangling monitor ${monitorId}...`);
      await runCLI(['monitor', 'delete', monitorId.toString(), '-y', '--json']);
    }
  }
}
