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
