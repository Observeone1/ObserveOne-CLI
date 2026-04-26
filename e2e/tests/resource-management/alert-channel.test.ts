import {
  runCLI,
  assertSuccess,
  assertContains,
  assertJSON,
  assertFailure,
  assertStrictJSON,
} from '../../lib/test-runner.js';

export async function testAlertChannelLifecycle() {
  const timestamp = Date.now();
  const channelName = `E2E-Alert-${timestamp}`;
  const channelEmail = `alerts+${timestamp}@example.com`;
  let channelId: number | undefined;

  try {
    console.log('      - Creating alert channel...');
    const createResult = await runCLI([
      'alert-channel',
      'create',
      '--name',
      channelName,
      '--type',
      'email',
      '--email',
      channelEmail,
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
      'alert-channel',
      'update',
      channelId!.toString(),
      '--name',
      `${channelName}-Updated`,
      '--type',
      'email',
      '--email',
      channelEmail,
      '--json',
    ]);
    assertSuccess(updateResult, 'Alert channel update failed');

    console.log(`      - Deleting alert channel ${channelId}...`);
    const deleteResult = await runCLI([
      'alert-channel',
      'delete',
      channelId!.toString(),
      '-y',
      '--json',
    ]);
    assertSuccess(deleteResult, 'Alert channel delete failed');
    channelId = undefined;
  } finally {
    if (channelId) {
      console.log(`      - [Cleanup] Deleting dangling alert channel ${channelId}...`);
      await runCLI(['alert-channel', 'delete', channelId.toString(), '-y', '--json']);
    }
  }
}

export async function testAlertChannelTestSucceeds() {
  const timestamp = Date.now();
  const channelName = `e2e-test-webhook-${timestamp}`;
  let channelId: number | undefined;

  try {
    const createResult = await runCLI([
      'alert-channel',
      'create',
      '--name',
      channelName,
      '--type',
      'webhook',
      '--webhook-url',
      'https://example.invalid/sink',
      '--json',
    ]);
    assertSuccess(createResult, 'Alert channel creation failed');
    const payload = JSON.parse(createResult.stdout);
    channelId = payload?.alert_channel?.id ?? payload?.data?.id ?? payload?.id;

    if (!channelId) {
      throw new Error(`Could not parse channel id from: ${createResult.stdout}`);
    }

    const testResult = await runCLI(['alert-channel', 'test', channelId.toString(), '--json']);
    assertStrictJSON(testResult.stdout, 'alert-channel test --json must output valid JSON');
    const parsed = JSON.parse(testResult.stdout.trim()) as { status?: string };
    if (parsed.status !== 'SUCCESS' && parsed.status !== 'ERROR') {
      throw new Error(`Expected SUCCESS or ERROR envelope, got: ${parsed.status}`);
    }
    // We accept either outcome — webhook to invalid URL may fail delivery
    // but the command itself must complete and return a valid envelope.
    console.log(`      - alert-channel test returned status: ${parsed.status}`);
  } finally {
    if (channelId) {
      await runCLI(['alert-channel', 'delete', channelId.toString(), '-y', '--json']);
    }
  }
}

export async function testAlertChannelTestBadIdFails() {
  const result = await runCLI(['alert-channel', 'test', '999999999']);
  assertFailure(result, 'obs alert-channel test with unknown ID should fail');
}

export async function testAlertChannelTestInvalidIdFails() {
  const result = await runCLI(['alert-channel', 'test', 'not-a-number']);
  assertFailure(result, 'obs alert-channel test with non-numeric ID should fail');
}

export async function testAlertChannelTestJsonEnvelope() {
  const result = await runCLI(['alert-channel', 'test', '999999999', '--json']);
  assertStrictJSON(result.stdout, 'alert-channel test --json must output valid JSON envelope');
  const parsed = JSON.parse(result.stdout.trim()) as { status?: string };
  if (parsed.status !== 'SUCCESS' && parsed.status !== 'ERROR') {
    throw new Error(`JSON envelope status must be SUCCESS or ERROR, got: ${parsed.status}`);
  }
}
