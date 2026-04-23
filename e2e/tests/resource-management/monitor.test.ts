import {
  runCLI,
  assertSuccess,
  assertContains,
  assertJSON,
  assertFailure,
  assertStrictJSON,
} from '../../lib/test-runner.js';

function parseListEnvelope(output: string) {
  assertStrictJSON(output, 'monitor list --json must output valid JSON envelope');
  return JSON.parse(output.trim()) as {
    data?: {
      items?: Array<{ id?: number; name?: string; status?: string; is_active?: boolean }>;
      pagination?: { page?: number; limit?: number; total?: number; totalPages?: number };
    };
  };
}

export async function testMonitorLifecycle() {
  const timestamp = Date.now();
  const monitorName = `E2E-Monitor-${timestamp}`;
  const monitorUrl = 'https://example.com/e2e-test';
  let monitorId: number | undefined;

  try {
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
      'monitor',
      'update',
      monitorId.toString(),
      '--name',
      updatedName,
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

export async function testMonitorRunBadIdFails() {
  const result = await runCLI(['monitor', 'run', '999999999']);
  assertFailure(result, 'obs monitor run with unknown ID should fail');
}

export async function testMonitorRunInvalidIdFails() {
  const result = await runCLI(['monitor', 'run', 'not-a-number']);
  assertFailure(result, 'obs monitor run with non-numeric ID should fail');
}

export async function testMonitorRunJsonEnvelope() {
  const result = await runCLI(['monitor', 'run', '999999999', '--json']);
  assertStrictJSON(result.stdout, 'monitor run --json must output valid JSON envelope');
  const parsed = JSON.parse(result.stdout.trim()) as { status?: string };
  if (parsed.status !== 'SUCCESS' && parsed.status !== 'ERROR') {
    throw new Error(`JSON envelope status must be SUCCESS or ERROR, got: ${parsed.status}`);
  }
}

export async function testMonitorRunsJsonEnvelope() {
  const timestamp = Date.now();
  const monitorName = `E2E-Monitor-Runs-${timestamp}`;
  let monitorId: number | undefined;
  let executionId: number | undefined;

  try {
    const createResult = await runCLI([
      'monitor',
      'create',
      '--name',
      monitorName,
      '--url',
      `https://example.com/e2e-runs-${timestamp}`,
      '--interval',
      '*/10 * * * *',
      '--json',
    ]);
    assertSuccess(createResult, 'Monitor creation failed');
    const createdMonitor = JSON.parse(createResult.stdout);
    monitorId = createdMonitor.id || createdMonitor.data?.id;
    if (!monitorId) throw new Error('Could not extract monitor ID from creation response');

    const runResult = await runCLI(['monitor', 'run', monitorId.toString(), '--json']);
    assertSuccess(runResult, 'Monitor run failed');
    assertStrictJSON(runResult.stdout, 'monitor run --json must output valid JSON envelope');
    const parsedRun = JSON.parse(runResult.stdout.trim()) as {
      data?: { executions?: Array<{ execution_id?: number }> };
    };
    executionId = parsedRun.data?.executions?.[0]?.execution_id;
    if (!executionId) throw new Error('Could not extract monitor execution ID');

    const runsResult = await runCLI([
      'monitor',
      'runs',
      monitorId.toString(),
      '--limit',
      '5',
      '--json',
    ]);
    assertSuccess(runsResult, 'Monitor runs failed');
    assertStrictJSON(runsResult.stdout, 'monitor runs --json must output valid JSON envelope');
    const parsedRuns = JSON.parse(runsResult.stdout.trim()) as {
      data?: { runs?: Array<{ id?: number }> };
    };
    const runs = parsedRuns.data?.runs || [];

    if (!runs.some((run) => run.id === executionId)) {
      throw new Error(`Monitor execution ${executionId} not found in runs output`);
    }
  } finally {
    if (monitorId) {
      await runCLI(['monitor', 'delete', monitorId.toString(), '-y', '--json']);
    }
  }
}

export async function testMonitorListFiltersJsonEnvelope() {
  const timestamp = Date.now();
  const monitorName = `E2E-Monitor-List-${timestamp}`;
  const monitorUrl = `https://example.com/e2e-list-${timestamp}`;
  let monitorId: number | undefined;

  try {
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
    const createdMonitor = JSON.parse(createResult.stdout);
    monitorId = createdMonitor.id || createdMonitor.data?.id;
    if (!monitorId) throw new Error('Could not extract monitor ID from creation response');

    const searchResult = await runCLI([
      'monitor',
      'list',
      '--search',
      monitorName,
      '--limit',
      '5',
      '--page',
      '1',
      '--json',
    ]);
    assertSuccess(searchResult, 'Filtered monitor list failed');
    const searchEnvelope = parseListEnvelope(searchResult.stdout);
    const searchItems = searchEnvelope.data?.items || [];
    const searchPagination = searchEnvelope.data?.pagination;

    if (!searchItems.some((item) => item.id === monitorId)) {
      throw new Error(`Created monitor ${monitorId} not found in filtered search results`);
    }
    if (searchPagination?.page !== 1 || searchPagination?.limit !== 5) {
      throw new Error(`Unexpected pagination: ${JSON.stringify(searchPagination)}`);
    }

    const activeResult = await runCLI([
      'monitor',
      'list',
      '--is-active',
      'true',
      '--status',
      'pending',
      '--search',
      monitorName,
      '--json',
    ]);
    assertSuccess(activeResult, 'Active filtered monitor list failed');
    const activeEnvelope = parseListEnvelope(activeResult.stdout);
    const activeItems = activeEnvelope.data?.items || [];
    const activeMonitor = activeItems.find((item) => item.id === monitorId);

    if (!activeMonitor) {
      throw new Error(`Active monitor ${monitorId} not found in filtered results`);
    }
    if (activeMonitor.status !== 'pending' || activeMonitor.is_active !== true) {
      throw new Error(`Unexpected active monitor state: ${JSON.stringify(activeMonitor)}`);
    }
  } finally {
    if (monitorId) {
      await runCLI(['monitor', 'delete', monitorId.toString(), '-y', '--json']);
    }
  }
}

export async function testMonitorFieldParity() {
  const timestamp = Date.now();
  const channelName = `E2E-Monitor-Channel-${timestamp}`;
  const channelEmail = `monitor-alerts+${timestamp}@example.com`;
  const monitorName = `E2E-Monitor-Parity-${timestamp}`;
  let channelId: number | undefined;
  let monitorId: number | undefined;

  try {
    const createChannel = await runCLI([
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
    assertSuccess(createChannel, 'Alert channel creation failed for monitor parity test');
    const createdChannel = JSON.parse(createChannel.stdout);
    channelId = createdChannel.id || createdChannel.data?.id;
    if (!channelId) throw new Error('Could not extract alert channel ID');

    const createMonitor = await runCLI([
      'monitor',
      'create',
      '--name',
      monitorName,
      '--description',
      'Created from CLI parity test',
      '--url',
      `https://example.com/monitor-parity-${timestamp}`,
      '--interval',
      '*/15 * * * *',
      '--alert-channel-id',
      channelId.toString(),
      '--json',
    ]);
    assertSuccess(createMonitor, 'Monitor parity create failed');
    const createdMonitor = JSON.parse(createMonitor.stdout);
    monitorId = createdMonitor.id || createdMonitor.data?.id;
    if (!monitorId) throw new Error('Could not extract monitor ID');

    const getMonitor = await runCLI(['monitor', 'get', monitorId.toString(), '--json']);
    assertSuccess(getMonitor, 'Monitor parity get failed');
    const parsedMonitor = JSON.parse(getMonitor.stdout);
    const monitor = parsedMonitor.data || parsedMonitor;

    if (monitor.description !== 'Created from CLI parity test') {
      throw new Error(`Unexpected monitor description: ${monitor.description}`);
    }
    if (
      !Array.isArray(monitor.channels) ||
      !monitor.channels.some((c: { id?: number }) => c.id === channelId)
    ) {
      throw new Error(`Expected monitor ${monitorId} to include alert channel ${channelId}`);
    }

    const updateMonitor = await runCLI([
      'monitor',
      'update',
      monitorId.toString(),
      '--description',
      'Updated from CLI parity test',
      '--json',
    ]);
    assertSuccess(updateMonitor, 'Monitor parity update failed');

    const getUpdatedMonitor = await runCLI(['monitor', 'get', monitorId.toString(), '--json']);
    assertSuccess(getUpdatedMonitor, 'Updated monitor fetch failed');
    const updatedParsed = JSON.parse(getUpdatedMonitor.stdout);
    const updatedMonitor = updatedParsed.data || updatedParsed;

    if (updatedMonitor.description !== 'Updated from CLI parity test') {
      throw new Error(`Unexpected updated monitor description: ${updatedMonitor.description}`);
    }
  } finally {
    if (monitorId) {
      await runCLI(['monitor', 'delete', monitorId.toString(), '-y', '--json']);
    }
    if (channelId) {
      await runCLI(['alert-channel', 'delete', channelId.toString(), '-y', '--json']);
    }
  }
}
