import {
  runCLI,
  assertSuccess,
  assertContains,
  assertJSON,
  assertFailure,
  assertStrictJSON,
} from '../../lib/test-runner.js';

function parseListEnvelope(output: string) {
  assertStrictJSON(output, 'check list --json must output valid JSON envelope');
  return JSON.parse(output.trim()) as {
    data?: {
      items?: Array<{ id?: number; name?: string; status?: string; is_active?: boolean }>;
      pagination?: { page?: number; limit?: number; total?: number; totalPages?: number };
    };
  };
}

export async function testApiCheckLifecycle() {
  const timestamp = Date.now();
  const checkName = `E2E-Check-${timestamp}`;
  const checkUrl = 'https://api.example.com/v1/health';
  let checkId: number | undefined;

  try {
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
    assertJSON(createResult.stdout, 'Create output should be JSON');
    const createdCheck = JSON.parse(createResult.stdout);
    checkId = createdCheck.id || createdCheck.data?.id;

    console.log('      - Listing API checks...');
    const listResult = await runCLI(['check', 'list', '--json']);
    assertSuccess(listResult, 'API check list failed');
    assertContains(listResult.stdout, checkName);

    console.log(`      - Getting API check ${checkId}...`);
    const getResult = await runCLI(['check', 'get', checkId!.toString(), '--json']);
    assertSuccess(getResult, 'API check get failed');

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

export async function testApiCheckRunBadIdFails() {
  const result = await runCLI(['check', 'run', '999999999']);
  assertFailure(result, 'obs check run with unknown ID should fail');
}

export async function testApiCheckRunInvalidIdFails() {
  const result = await runCLI(['check', 'run', 'not-a-number']);
  assertFailure(result, 'obs check run with non-numeric ID should fail');
}

export async function testApiCheckRunJsonEnvelope() {
  const result = await runCLI(['check', 'run', '999999999', '--json']);
  assertStrictJSON(result.stdout, 'check run --json must output valid JSON envelope');
  const parsed = JSON.parse(result.stdout.trim()) as { status?: string };
  if (parsed.status !== 'SUCCESS' && parsed.status !== 'ERROR') {
    throw new Error(`JSON envelope status must be SUCCESS or ERROR, got: ${parsed.status}`);
  }
}

export async function testApiCheckRunsJsonEnvelope() {
  const timestamp = Date.now();
  const checkName = `E2E-Check-Runs-${timestamp}`;
  let checkId: number | undefined;
  let executionId: number | undefined;

  try {
    const createResult = await runCLI([
      'check',
      'create',
      '--name',
      checkName,
      '--url',
      `https://api.example.com/v1/runs/${timestamp}`,
      '--method',
      'GET',
      '--json',
    ]);
    assertSuccess(createResult, 'API check creation failed');
    const createdCheck = JSON.parse(createResult.stdout);
    checkId = createdCheck.id || createdCheck.data?.id;
    if (!checkId) throw new Error('Could not extract API check ID from creation response');

    const runResult = await runCLI(['check', 'run', checkId.toString(), '--json']);
    assertSuccess(runResult, 'API check run failed');
    assertStrictJSON(runResult.stdout, 'check run --json must output valid JSON envelope');
    const parsedRun = JSON.parse(runResult.stdout.trim()) as {
      data?: { executions?: Array<{ execution_id?: number }> };
    };
    executionId = parsedRun.data?.executions?.[0]?.execution_id;
    if (!executionId) throw new Error('Could not extract API check execution ID');

    const runsResult = await runCLI([
      'check',
      'runs',
      checkId.toString(),
      '--limit',
      '5',
      '--json',
    ]);
    assertSuccess(runsResult, 'API check runs failed');
    assertStrictJSON(runsResult.stdout, 'check runs --json must output valid JSON envelope');
    const parsedRuns = JSON.parse(runsResult.stdout.trim()) as {
      data?: { runs?: Array<{ id?: number }> };
    };
    const runs = parsedRuns.data?.runs || [];

    if (!runs.some((run) => run.id === executionId)) {
      throw new Error(`API check execution ${executionId} not found in runs output`);
    }
  } finally {
    if (checkId) {
      await runCLI(['check', 'delete', checkId.toString(), '-y', '--json']);
    }
  }
}

export async function testApiCheckListFiltersJsonEnvelope() {
  const timestamp = Date.now();
  const checkName = `E2E-Check-List-${timestamp}`;
  const checkUrl = `https://api.example.com/v1/health/${timestamp}`;
  let checkId: number | undefined;

  try {
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
    if (!checkId) throw new Error('Could not extract API check ID from creation response');

    const searchResult = await runCLI([
      'check',
      'list',
      '--search',
      checkName,
      '--limit',
      '5',
      '--page',
      '1',
      '--json',
    ]);
    assertSuccess(searchResult, 'Filtered API check list failed');
    const searchEnvelope = parseListEnvelope(searchResult.stdout);
    const searchItems = searchEnvelope.data?.items || [];
    const searchPagination = searchEnvelope.data?.pagination;

    if (!searchItems.some((item) => item.id === checkId)) {
      throw new Error(`Created API check ${checkId} not found in filtered search results`);
    }
    if (searchPagination?.page !== 1 || searchPagination?.limit !== 5) {
      throw new Error(`Unexpected pagination: ${JSON.stringify(searchPagination)}`);
    }

    const pausedResult = await runCLI([
      'check',
      'list',
      '--status',
      'paused',
      '--is-active',
      'false',
      '--search',
      checkName,
      '--json',
    ]);
    assertSuccess(pausedResult, 'Paused filtered API check list failed');
    const pausedEnvelope = parseListEnvelope(pausedResult.stdout);
    const pausedItems = pausedEnvelope.data?.items || [];
    const pausedCheck = pausedItems.find((item) => item.id === checkId);

    if (!pausedCheck) {
      throw new Error(`Paused API check ${checkId} not found in filtered results`);
    }
    if (pausedCheck.status !== 'paused' || pausedCheck.is_active !== false) {
      throw new Error(`Unexpected paused API check state: ${JSON.stringify(pausedCheck)}`);
    }
  } finally {
    if (checkId) {
      await runCLI(['check', 'delete', checkId.toString(), '-y', '--json']);
    }
  }
}

export async function testApiCheckFieldParity() {
  const timestamp = Date.now();
  const checkName = `E2E-Check-Parity-${timestamp}`;
  let checkId: number | undefined;

  try {
    const createResult = await runCLI([
      'check',
      'create',
      '--name',
      checkName,
      '--url',
      `https://api.example.com/parity/${timestamp}`,
      '--method',
      'GET',
      '--header',
      'Authorization=Bearer test-token',
      '--header',
      'X-Trace-Id=e2e-parity',
      '--assertion',
      '{"type":"status_code","operator":"equals","value":"200"}',
      '--assertion',
      '{"type":"json_path","operator":"equals","path":"$.status","value":"\\"ok\\""}',
      '--json',
    ]);
    assertSuccess(createResult, 'API check parity create failed');
    const createdCheck = JSON.parse(createResult.stdout);
    checkId = createdCheck.id || createdCheck.data?.id;
    if (!checkId) throw new Error('Could not extract API check ID');

    const getResult = await runCLI(['check', 'get', checkId.toString(), '--json']);
    assertSuccess(getResult, 'API check parity get failed');
    const parsedCheck = JSON.parse(getResult.stdout);
    const check = parsedCheck.data || parsedCheck;

    if (check.headers?.Authorization !== 'Bearer test-token') {
      throw new Error(
        `Expected Authorization header to persist, got ${JSON.stringify(check.headers)}`
      );
    }
    if (check.headers?.['X-Trace-Id'] !== 'e2e-parity') {
      throw new Error(
        `Expected X-Trace-Id header to persist, got ${JSON.stringify(check.headers)}`
      );
    }
    if (!Array.isArray(check.assertions) || check.assertions.length !== 2) {
      throw new Error(`Expected 2 API check assertions, got ${JSON.stringify(check.assertions)}`);
    }

    const updateResult = await runCLI([
      'check',
      'update',
      checkId.toString(),
      '--header',
      'Authorization=Bearer updated-token',
      '--assertion',
      '{"type":"json_path","operator":"equals","path":"$.status","value":"ok"}',
      '--json',
    ]);
    assertSuccess(updateResult, 'API check parity update failed');

    const getUpdatedResult = await runCLI(['check', 'get', checkId.toString(), '--json']);
    assertSuccess(getUpdatedResult, 'Updated API check fetch failed');
    const parsedUpdatedCheck = JSON.parse(getUpdatedResult.stdout);
    const updatedCheck = parsedUpdatedCheck.data || parsedUpdatedCheck;

    if (updatedCheck.headers?.Authorization !== 'Bearer updated-token') {
      throw new Error(
        `Expected updated Authorization header, got ${JSON.stringify(updatedCheck.headers)}`
      );
    }
    if (!Array.isArray(updatedCheck.assertions) || updatedCheck.assertions.length !== 1) {
      throw new Error(
        `Expected updated assertions to be replaced, got ${JSON.stringify(updatedCheck.assertions)}`
      );
    }
    if (updatedCheck.assertions[0]?.type !== 'json_path') {
      throw new Error(
        `Expected json_path assertion after update, got ${JSON.stringify(updatedCheck.assertions)}`
      );
    }
  } finally {
    if (checkId) {
      await runCLI(['check', 'delete', checkId.toString(), '-y', '--json']);
    }
  }
}

export async function testApiCheckShortFlags() {
  const timestamp = Date.now();
  const checkName = `E2E-ShortFlags-${timestamp}`;
  const checkUrl = 'https://api.example.com/health';

  console.log('      - Creating API check with short assertion flags...');
  await runCLI([
    'check',
    'create',
    '--name',
    checkName,
    '--url',
    checkUrl,
    '--status-code',
    '200',
    '--response-time-under',
    '3000',
    '--text-contains',
    'ok',
    '--json',
  ]);
}

export async function testApiCheckBodyAndRetry() {
  const timestamp = Date.now();
  const checkName = `E2E-BodyRetry-${timestamp}`;
  const checkUrl = 'https://api.example.com/post';

  console.log('      - Creating API check with --body and retry flags...');
  await runCLI([
    'check',
    'create',
    '--name',
    checkName,
    '--url',
    checkUrl,
    '--method',
    'POST',
    '--body',
    '{"key":"value"}',
    '--retry-count',
    '3',
    '--retry-interval',
    '1000',
    '--json',
  ]);
}

export async function testCheckToggleMuted() {
  const timestamp = Date.now();
  const checkName = `E2E-Check-ToggleMuted-${timestamp}`;
  let checkId: number | undefined;

  try {
    const createResult = await runCLI([
      'check',
      'create',
      '--name',
      checkName,
      '--url',
      `https://example.com/e2e-mute-${timestamp}`,
      '--json',
    ]);
    assertSuccess(createResult, 'API check creation failed');
    const created = JSON.parse(createResult.stdout);
    checkId = created.id || created.data?.id;
    if (!checkId) throw new Error('Could not extract check ID');

    const muteResult = await runCLI(['check', 'toggle-muted', checkId.toString(), '--json']);
    assertSuccess(muteResult, 'check toggle-muted failed');
    assertJSON(muteResult.stdout, 'toggle-muted output should be JSON');
    const muteData = JSON.parse(muteResult.stdout);
    const isMuted = muteData.is_muted ?? muteData.data?.is_muted;
    if (typeof isMuted !== 'boolean') {
      throw new Error(`Expected boolean is_muted, got: ${JSON.stringify(muteData)}`);
    }

    const unmuteResult = await runCLI(['check', 'toggle-muted', checkId.toString(), '--json']);
    assertSuccess(unmuteResult, 'check toggle-muted (unmute) failed');
  } finally {
    if (checkId) {
      await runCLI(['check', 'delete', checkId.toString(), '-y', '--json']);
    }
  }
}
