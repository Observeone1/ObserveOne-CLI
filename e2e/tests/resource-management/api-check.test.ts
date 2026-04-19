import { runCLI, assertSuccess, assertContains, assertJSON } from '../../lib/test-runner.js';

export async function testApiCheckLifecycle() {
  const timestamp = Date.now();
  const checkName = `E2E-Check-${timestamp}`;
  const checkUrl = 'https://api.example.com/v1/health';
  let checkId: number | undefined;

  try {
    console.log('      - Creating API check...');
    const createResult = await runCLI([
      'check', 'create',
      '--name', checkName,
      '--url', checkUrl,
      '--method', 'GET',
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
      'check', 'update', checkId!.toString(),
      '--method', 'POST',
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
