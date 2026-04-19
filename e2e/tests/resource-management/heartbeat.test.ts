import { runCLI, assertSuccess, assertContains, assertJSON } from '../../lib/test-runner.js';

export async function testHeartbeatLifecycle() {
  const timestamp = Date.now();
  const hbName = `E2E-HB-${timestamp}`;
  let hbId: number | undefined;

  try {
    console.log('      - Creating heartbeat...');
    const createResult = await runCLI([
      'heartbeat',
      'create',
      '--name',
      hbName,
      '--period',
      '600',
      '--json',
    ]);
    assertSuccess(createResult, 'Heartbeat creation failed');
    assertJSON(createResult.stdout, 'Create output should be JSON');
    const createdHb = JSON.parse(createResult.stdout);
    hbId = createdHb.id || createdHb.data?.id;

    console.log('      - Listing heartbeats...');
    const listResult = await runCLI(['heartbeat', 'list', '--json']);
    assertSuccess(listResult, 'Heartbeat list failed');
    assertContains(listResult.stdout, hbName);

    console.log(`      - Getting heartbeat ${hbId}...`);
    const getResult = await runCLI(['heartbeat', 'get', hbId!.toString(), '--json']);
    assertSuccess(getResult, 'Heartbeat get failed');

    console.log(`      - Updating heartbeat ${hbId}...`);
    const updateResult = await runCLI([
      'heartbeat',
      'update',
      hbId!.toString(),
      '--period',
      '1200',
      '--json',
    ]);
    assertSuccess(updateResult, 'Heartbeat update failed');

    console.log(`      - Toggling heartbeat ${hbId}...`);
    const toggleResult = await runCLI(['heartbeat', 'toggle', hbId!.toString(), '--json']);
    assertSuccess(toggleResult, 'Heartbeat toggle failed');

    console.log(`      - Deleting heartbeat ${hbId}...`);
    const deleteResult = await runCLI(['heartbeat', 'delete', hbId!.toString(), '-y', '--json']);
    assertSuccess(deleteResult, 'Heartbeat delete failed');
    hbId = undefined;
  } finally {
    if (hbId) {
      console.log(`      - [Cleanup] Deleting dangling heartbeat ${hbId}...`);
      await runCLI(['heartbeat', 'delete', hbId.toString(), '-y', '--json']);
    }
  }
}
