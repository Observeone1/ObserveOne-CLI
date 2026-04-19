import { runCLI, assertSuccess, assertContains, assertJSON } from '../../lib/test-runner.js';

export async function testAlertChannelLifecycle() {
  const timestamp = Date.now();
  const channelName = `E2E-Alert-${timestamp}`;
  const channelEmail = `alerts+${timestamp}@example.com`;
  let channelId: number | undefined;

  try {
    console.log('      - Creating alert channel...');
    const createResult = await runCLI([
      'alert-channel', 'create',
      '--name', channelName,
      '--type', 'email',
      '--email', channelEmail,
      '--json',
    ]);
    assertSuccess(createResult, 'Alert channel creation failed');
    assertJSON(createResult.stdout, 'Create output should be JSON');
    const createdChannel = JSON.parse(createResult.stdout);
    channelId = createdChannel.id || createdChannel.data?.id;

    console.log('      - Listing alert channels...');
    const listResult = await runCLI(['alert-channel', 'list', '--json']);
    assertSuccess(listResult, 'Alert channel list failed');
    assertContains(listResult.stdout, channelName);

    console.log(`      - Getting alert channel ${channelId}...`);
    const getResult = await runCLI(['alert-channel', 'get', channelId!.toString(), '--json']);
    assertSuccess(getResult, 'Alert channel get failed');

    console.log(`      - Updating alert channel ${channelId}...`);
    const updateResult = await runCLI([
      'alert-channel', 'update', channelId!.toString(),
      '--name', `${channelName}-Updated`,
      '--type', 'email',
      '--email', channelEmail,
      '--json',
    ]);
    assertSuccess(updateResult, 'Alert channel update failed');

    console.log(`      - Deleting alert channel ${channelId}...`);
    const deleteResult = await runCLI(['alert-channel', 'delete', channelId!.toString(), '-y', '--json']);
    assertSuccess(deleteResult, 'Alert channel delete failed');
    channelId = undefined;
  } finally {
    if (channelId) {
      console.log(`      - [Cleanup] Deleting dangling alert channel ${channelId}...`);
      await runCLI(['alert-channel', 'delete', channelId.toString(), '-y', '--json']);
    }
  }
}
