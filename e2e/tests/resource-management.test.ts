import {
  runCLI,
  assertSuccess,
  assertContains,
  assertJSON,
  assertFailure,
} from '../lib/test-runner.js';

/**
 * E2E tests for Monitor Lifecycle
 */
export async function testMonitorLifecycle() {
  const timestamp = Date.now();
  const monitorName = `E2E-Monitor-${timestamp}`;
  const monitorUrl = 'https://example.com/e2e-test';
  let monitorId: number | undefined;

  try {
    // 1. Create
    console.log('      - Creating monitor...');
    const createResult = await runCLI([
      'monitor',
      'create',
      '--name',
      monitorName,
      '--url',
      monitorUrl,
      '--interval',
      '*/10 * * * *',
      '--json',
    ]);
    assertSuccess(createResult, 'Monitor creation failed');
    assertJSON(createResult.stdout, 'Create output should be JSON');
    const createdMonitor = JSON.parse(createResult.stdout);
    monitorId = createdMonitor.id || createdMonitor.data?.id;
    if (!monitorId) throw new Error('Could not extract monitor ID from creation response');

    // 2. List
    console.log('      - Listing monitors...');
    const listResult = await runCLI(['monitor', 'list', '--json']);
    assertSuccess(listResult, 'Monitor list failed');
    assertContains(listResult.stdout, monitorName, 'Created monitor name not found in list');

    // 3. Get
    console.log(`      - Getting monitor ${monitorId}...`);
    const getResult = await runCLI(['monitor', 'get', monitorId.toString(), '--json']);
    assertSuccess(getResult, 'Monitor get failed');
    const fetchedMonitor = JSON.parse(getResult.stdout);
    const fetchedId = fetchedMonitor.id || fetchedMonitor.data?.id;
    if (fetchedId !== monitorId)
      throw new Error(`Fetched ID ${fetchedId} does not match ${monitorId}`);

    // 4. Update
    console.log(`      - Updating monitor ${monitorId}...`);
    const updatedName = `${monitorName}-Updated`;
    const updateResult = await runCLI([
      'monitor',
      'update',
      monitorId.toString(),
      '--name',
      updatedName,
      '--json',
    ]);
    assertSuccess(updateResult, 'Monitor update failed');

    // 5. Toggle
    console.log(`      - Toggling monitor ${monitorId}...`);
    const toggleResult = await runCLI(['monitor', 'toggle', monitorId.toString(), '--json']);
    assertSuccess(toggleResult, 'Monitor toggle failed');

    // 6. Delete
    console.log(`      - Deleting monitor ${monitorId}...`);
    const deleteResult = await runCLI(['monitor', 'delete', monitorId.toString(), '-y', '--json']);
    assertSuccess(deleteResult, 'Monitor delete failed');

    // Clear monitorId since we successfully deleted it
    monitorId = undefined;

    // 7. Verify deletion (Get should fail or return empty/not found)
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

/**
 * E2E tests for API Check Lifecycle
 */
export async function testApiCheckLifecycle() {
  const timestamp = Date.now();
  const checkName = `E2E-Check-${timestamp}`;
  const checkUrl = 'https://api.example.com/v1/health';
  let checkId: number | undefined;

  try {
    // 1. Create
    console.log('      - Creating API check...');
    const createResult = await runCLI([
      'check',
      'create',
      '--name',
      checkName,
      '--url',
      checkUrl,
      '--method',
      'GET',
      '--json',
    ]);
    assertSuccess(createResult, 'API check creation failed');
    const createdCheck = JSON.parse(createResult.stdout);
    checkId = createdCheck.id || createdCheck.data?.id;

    // 2. List
    console.log('      - Listing API checks...');
    const listResult = await runCLI(['check', 'list', '--json']);
    assertSuccess(listResult, 'API check list failed');
    assertContains(listResult.stdout, checkName);

    // 3. Get
    console.log(`      - Getting API check ${checkId}...`);
    const getResult = await runCLI(['check', 'get', checkId!.toString(), '--json']);
    assertSuccess(getResult, 'API check get failed');

    // 4. Update
    console.log(`      - Updating API check ${checkId}...`);
    const updateResult = await runCLI([
      'check',
      'update',
      checkId!.toString(),
      '--method',
      'POST',
      '--json',
    ]);
    assertSuccess(updateResult, 'API check update failed');

    // 5. Delete
    console.log(`      - Deleting API check ${checkId}...`);
    const deleteResult = await runCLI(['check', 'delete', checkId!.toString(), '-y', '--json']);
    assertSuccess(deleteResult, 'API check delete failed');

    checkId = undefined;
  } finally {
    if (checkId) {
      console.log(`      - [Cleanup] Deleting dangling API check ${checkId}...`);
      await runCLI(['check', 'delete', checkId.toString(), '-y', '--json']);
    }
  }
}

/**
 * E2E tests for Heartbeat Lifecycle
 */
export async function testHeartbeatLifecycle() {
  const timestamp = Date.now();
  const hbName = `E2E-HB-${timestamp}`;
  let hbId: number | undefined;

  try {
    // 1. Create
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
    const createdHb = JSON.parse(createResult.stdout);
    hbId = createdHb.id || createdHb.data?.id;

    // 2. List
    console.log('      - Listing heartbeats...');
    const listResult = await runCLI(['heartbeat', 'list', '--json']);
    assertSuccess(listResult, 'Heartbeat list failed');
    assertContains(listResult.stdout, hbName);

    // 3. Get
    console.log(`      - Getting heartbeat ${hbId}...`);
    const getResult = await runCLI(['heartbeat', 'get', hbId!.toString(), '--json']);
    assertSuccess(getResult, 'Heartbeat get failed');

    // 4. Update
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

    // 5. Toggle
    console.log(`      - Toggling heartbeat ${hbId}...`);
    const toggleResult = await runCLI(['heartbeat', 'toggle', hbId!.toString(), '--json']);
    assertSuccess(toggleResult, 'Heartbeat toggle failed');

    // 5. Delete
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

/**
 * E2E tests for AI Browser Check Lifecycle
 */
export async function testAiCheckLifecycle() {
  const timestamp = Date.now();
  const aiName = `E2E-AI-${timestamp}`;
  const aiUrl = 'https://example.com';
  const aiPrompt = 'Check if the title is Example Domain';
  let aiId: number | undefined;

  try {
    // 1. Create
    console.log('      - Creating AI check...');
    const createResult = await runCLI([
      'ai-check',
      'create',
      '--name',
      aiName,
      '--url',
      aiUrl,
      '--prompt',
      aiPrompt,
      '--json',
    ]);
    assertSuccess(createResult, 'AI check creation failed');
    const createdAi = JSON.parse(createResult.stdout);
    aiId = createdAi.id || createdAi.data?.id;

    // 2. Get
    console.log(`      - Getting AI check ${aiId}...`);
    const getResult = await runCLI(['ai-check', 'get', aiId!.toString(), '--json']);
    assertSuccess(getResult, 'AI check get failed');

    // 3. Delete
    console.log(`      - Deleting AI check ${aiId}...`);
    const deleteResult = await runCLI(['ai-check', 'delete', aiId!.toString(), '-y', '--json']);
    assertSuccess(deleteResult, 'AI check delete failed');

    aiId = undefined;
  } finally {
    if (aiId) {
      console.log(`      - [Cleanup] Deleting dangling AI check ${aiId}...`);
      await runCLI(['ai-check', 'delete', aiId.toString(), '-y', '--json']);
    }
  }
}

/**
 * E2E tests for Alert Channel Lifecycle
 */
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
    const updatedName = `${channelName}-Updated`;
    const updateResult = await runCLI([
      'alert-channel',
      'update',
      channelId!.toString(),
      '--name',
      updatedName,
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

/**
 * E2E tests for Status Page Lifecycle
 */
export async function testStatusPageLifecycle() {
  const timestamp = Date.now();
  const pageName = `E2E Status ${timestamp}`;
  const slug = `e2e-status-${timestamp}`;
  let pageId: number | undefined;

  try {
    console.log('      - Creating status page...');
    const createResult = await runCLI([
      'status-page',
      'create',
      '--name',
      pageName,
      '--slug',
      slug,
      '--json',
    ]);
    assertSuccess(createResult, 'Status page creation failed');
    const createdPage = JSON.parse(createResult.stdout);
    pageId = createdPage.id || createdPage.data?.id;

    console.log('      - Listing status pages...');
    const listResult = await runCLI(['status-page', 'list', '--json']);
    assertSuccess(listResult, 'Status page list failed');
    assertContains(listResult.stdout, slug);

    console.log(`      - Getting status page ${pageId}...`);
    const getResult = await runCLI(['status-page', 'get', pageId!.toString(), '--json']);
    assertSuccess(getResult, 'Status page get failed');

    console.log(`      - Updating status page ${pageId}...`);
    const updateResult = await runCLI([
      'status-page',
      'update',
      pageId!.toString(),
      '--name',
      pageName,
      '--slug',
      slug,
      '--description',
      'Updated via E2E',
      '--json',
    ]);
    assertSuccess(updateResult, 'Status page update failed');

    console.log(`      - Deleting status page ${pageId}...`);
    const deleteResult = await runCLI([
      'status-page',
      'delete',
      pageId!.toString(),
      '-y',
      '--json',
    ]);
    assertSuccess(deleteResult, 'Status page delete failed');

    pageId = undefined;
  } finally {
    if (pageId) {
      console.log(`      - [Cleanup] Deleting dangling status page ${pageId}...`);
      await runCLI(['status-page', 'delete', pageId.toString(), '-y', '--json']);
    }
  }
}

/**
 * E2E tests for Incident Lifecycle
 */
export async function testIncidentLifecycle() {
  const timestamp = Date.now();
  const title = `E2E Incident ${timestamp}`;
  let incidentId: number | undefined;

  try {
    console.log('      - Creating incident...');
    const createResult = await runCLI([
      'incident',
      'create',
      '--title',
      title,
      '--priority',
      'HIGH',
      '--description',
      'E2E incident creation',
      '--json',
    ]);
    assertSuccess(createResult, 'Incident creation failed');
    const createdIncident = JSON.parse(createResult.stdout);
    incidentId = createdIncident.id || createdIncident.data?.id;

    console.log('      - Listing incidents...');
    const listResult = await runCLI(['incident', 'list', '--json']);
    assertSuccess(listResult, 'Incident list failed');
    assertContains(listResult.stdout, title);

    console.log(`      - Getting incident ${incidentId}...`);
    const getResult = await runCLI(['incident', 'get', incidentId!.toString(), '--json']);
    assertSuccess(getResult, 'Incident get failed');

    console.log(`      - Updating incident ${incidentId}...`);
    const updateResult = await runCLI([
      'incident',
      'update',
      incidentId!.toString(),
      '--title',
      title,
      '--priority',
      'HIGH',
      '--description',
      'Updated via E2E',
      '--json',
    ]);
    assertSuccess(updateResult, 'Incident update failed');

    console.log(`      - Deleting incident ${incidentId}...`);
    const deleteResult = await runCLI([
      'incident',
      'delete',
      incidentId!.toString(),
      '-y',
      '--json',
    ]);
    assertSuccess(deleteResult, 'Incident delete failed');

    incidentId = undefined;
  } finally {
    if (incidentId) {
      console.log(`      - [Cleanup] Deleting dangling incident ${incidentId}...`);
      await runCLI(['incident', 'delete', incidentId.toString(), '-y', '--json']);
    }
  }
}
