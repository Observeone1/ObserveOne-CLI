import {
  runCLI,
  assertSuccess,
  assertContains,
  assertJSON,
  assertStrictJSON,
} from '../../lib/test-runner.js';

function parseListEnvelope(output: string) {
  assertStrictJSON(output, 'heartbeat list --json must output valid JSON envelope');
  return JSON.parse(output.trim()) as {
    data?: {
      items?: Array<{ id?: number; name?: string; status?: string; is_active?: boolean }>;
      pagination?: { page?: number; limit?: number; total?: number; totalPages?: number };
    };
  };
}

async function waitForPausedHeartbeat(hbId: number, hbName: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const pausedResult = await runCLI([
      'heartbeat',
      'list',
      '--status',
      'paused',
      '--is-active',
      'false',
      '--search',
      hbName,
      '--json',
    ]);
    assertSuccess(pausedResult, 'Paused filtered heartbeat list failed');
    const pausedEnvelope = parseListEnvelope(pausedResult.stdout);
    const pausedItems = pausedEnvelope.data?.items || [];
    const pausedHeartbeat = pausedItems.find((item) => item.id === hbId);

    if (pausedHeartbeat) {
      return pausedHeartbeat;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Paused heartbeat ${hbId} not found in filtered results`);
}

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

export async function testHeartbeatListFiltersJsonEnvelope() {
  const timestamp = Date.now();
  const hbName = `E2E-HB-List-${timestamp}`;
  let hbId: number | undefined;

  try {
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
    if (!hbId) throw new Error('Could not extract heartbeat ID from creation response');

    const searchResult = await runCLI([
      'heartbeat',
      'list',
      '--search',
      hbName,
      '--limit',
      '5',
      '--page',
      '1',
      '--json',
    ]);
    assertSuccess(searchResult, 'Filtered heartbeat list failed');
    const searchEnvelope = parseListEnvelope(searchResult.stdout);
    const searchItems = searchEnvelope.data?.items || [];
    const searchPagination = searchEnvelope.data?.pagination;

    if (!searchItems.some((item) => item.id === hbId)) {
      throw new Error(`Created heartbeat ${hbId} not found in filtered search results`);
    }
    if (searchPagination?.page !== 1 || searchPagination?.limit !== 5) {
      throw new Error(`Unexpected pagination: ${JSON.stringify(searchPagination)}`);
    }

    const toggleResult = await runCLI(['heartbeat', 'toggle', hbId.toString(), '--json']);
    assertSuccess(toggleResult, 'Heartbeat toggle failed');

    const pausedHeartbeat = await waitForPausedHeartbeat(hbId, hbName);
    if (pausedHeartbeat.status !== 'paused' || pausedHeartbeat.is_active !== false) {
      throw new Error(`Unexpected paused heartbeat state: ${JSON.stringify(pausedHeartbeat)}`);
    }
  } finally {
    if (hbId) {
      await runCLI(['heartbeat', 'delete', hbId.toString(), '-y', '--json']);
    }
  }
}

export async function testHeartbeatRunsJsonEnvelope() {
  const timestamp = Date.now();
  const hbName = `E2E-HB-Runs-${timestamp}`;
  let hbId: number | undefined;
  let pingId: number | undefined;
  let pingKey: string | undefined;

  try {
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
    if (!hbId) throw new Error('Could not extract heartbeat ID from creation response');

    const getResult = await runCLI(['heartbeat', 'get', hbId.toString(), '--json']);
    assertSuccess(getResult, 'Heartbeat get failed');
    const parsedHeartbeat = JSON.parse(getResult.stdout);
    const heartbeat = parsedHeartbeat.data || parsedHeartbeat;
    pingKey = heartbeat.ping_key;
    if (!pingKey) throw new Error('Could not extract heartbeat ping key');

    const apiUrl = process.env.API_URL || process.env.OBS_API_URL || 'http://localhost:8080/api';
    const pingUrl = `${apiUrl.replace(/\/api\/?$/, '')}/ping/${pingKey}`;
    const pingResponse = await fetch(pingUrl, { method: 'POST' });
    if (!pingResponse.ok) {
      throw new Error(`Heartbeat ping failed with status ${pingResponse.status}`);
    }

    const runsResult = await runCLI([
      'heartbeat',
      'runs',
      hbId.toString(),
      '--limit',
      '5',
      '--json',
    ]);
    assertSuccess(runsResult, 'Heartbeat runs failed');
    assertStrictJSON(runsResult.stdout, 'heartbeat runs --json must output valid JSON envelope');
    const parsedRuns = JSON.parse(runsResult.stdout.trim()) as {
      data?: { runs?: Array<{ id?: number }> };
    };
    const runs = parsedRuns.data?.runs || [];
    pingId = runs[0]?.id;

    if (!pingId) {
      throw new Error('Expected at least one heartbeat ping in runs output');
    }
  } finally {
    if (hbId) {
      await runCLI(['heartbeat', 'delete', hbId.toString(), '-y', '--json']);
    }
  }
}

export async function testHeartbeatToggleMuted() {
  const timestamp = Date.now();
  const hbName = `E2E-HB-ToggleMuted-${timestamp}`;
  let hbId: number | undefined;

  try {
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
    const created = JSON.parse(createResult.stdout);
    hbId = created.id || created.data?.id;
    if (!hbId) throw new Error('Could not extract heartbeat ID');

    const muteResult = await runCLI(['heartbeat', 'toggle-muted', hbId.toString(), '--json']);
    assertSuccess(muteResult, 'heartbeat toggle-muted failed');
    assertJSON(muteResult.stdout, 'toggle-muted output should be JSON');
    const muteData = JSON.parse(muteResult.stdout) as {
      message?: string;
      data?: { message?: string };
    };
    const msg = muteData.message ?? muteData.data?.message;
    if (!msg) {
      throw new Error(
        `Expected message in toggle-muted response, got: ${JSON.stringify(muteData)}`
      );
    }

    const unmuteResult = await runCLI(['heartbeat', 'toggle-muted', hbId.toString(), '--json']);
    assertSuccess(unmuteResult, 'heartbeat toggle-muted (unmute) failed');
  } finally {
    if (hbId) {
      await runCLI(['heartbeat', 'delete', hbId.toString(), '-y', '--json']);
    }
  }
}

export async function testHeartbeatReset() {
  const timestamp = Date.now();
  const hbName = `E2E-HB-Reset-${timestamp}`;
  let hbId: number | undefined;

  try {
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
    const created = JSON.parse(createResult.stdout);
    hbId = created.id || created.data?.id;
    if (!hbId) throw new Error('Could not extract heartbeat ID');

    const resetResult = await runCLI(['heartbeat', 'reset', hbId.toString(), '--json']);
    assertSuccess(resetResult, 'heartbeat reset failed');
    assertJSON(resetResult.stdout, 'heartbeat reset output should be JSON');
    const resetData = JSON.parse(resetResult.stdout) as {
      id?: number;
      data?: { id?: number; heartbeat?: { id?: number } };
    };
    const returnedId = resetData.id ?? resetData.data?.id ?? resetData.data?.heartbeat?.id;
    if (!returnedId) {
      throw new Error(
        `Expected heartbeat object in reset response, got: ${JSON.stringify(resetData)}`
      );
    }
  } finally {
    if (hbId) {
      await runCLI(['heartbeat', 'delete', hbId.toString(), '-y', '--json']);
    }
  }
}
