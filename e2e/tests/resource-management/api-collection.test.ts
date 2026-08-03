import {
  runCLI,
  assertSuccess,
  assertContains,
  assertJSON,
  assertFailure,
} from '../../lib/test-runner.js';

export async function testApiCollectionLifecycle() {
  const timestamp = Date.now();
  const name = `E2E-Collection-${timestamp}`;
  let collectionId: string | undefined;

  try {
    console.log('      - Creating API collection...');
    const createResult = await runCLI([
      'api-collection',
      'create',
      '--name',
      name,
      '--base-url',
      'https://api.example.com',
      '--header',
      'Authorization=Bearer test',
      '--json',
    ]);
    assertSuccess(createResult, 'API collection creation failed');
    assertJSON(createResult.stdout, 'Create output should be JSON');
    const created = JSON.parse(createResult.stdout);
    collectionId = created.id || created.data?.id;
    if (!collectionId) throw new Error('Could not extract collection ID from creation response');

    console.log('      - Listing API collections...');
    const listResult = await runCLI(['api-collection', 'list', '--json']);
    assertSuccess(listResult, 'API collection list failed');
    assertContains(listResult.stdout, name, 'Created collection name not found in list');

    console.log(`      - Getting API collection ${collectionId}...`);
    const getResult = await runCLI(['api-collection', 'get', collectionId, '--json']);
    assertSuccess(getResult, 'API collection get failed');
    const fetched = JSON.parse(getResult.stdout);
    const collection = fetched.data || fetched;
    if (collection.headers?.Authorization !== 'Bearer test') {
      throw new Error(`Expected header Authorization, got: ${JSON.stringify(collection.headers)}`);
    }

    console.log(`      - Updating API collection ${collectionId}...`);
    const updateResult = await runCLI([
      'api-collection',
      'update',
      collectionId,
      '--name',
      `${name}-Updated`,
      '--json',
    ]);
    assertSuccess(updateResult, 'API collection update failed');

    console.log(`      - Deleting API collection ${collectionId}...`);
    const deleteResult = await runCLI(['api-collection', 'delete', collectionId, '-y', '--json']);
    assertSuccess(deleteResult, 'API collection delete failed');
    collectionId = undefined;

    console.log('      - Verifying API collection deletion...');
    const verifyResult = await runCLI(['api-collection', 'get', name]);
    assertFailure(verifyResult, 'API collection should not be findable after deletion');
  } finally {
    if (collectionId) {
      console.log(`      - [Cleanup] Deleting dangling collection ${collectionId}...`);
      await runCLI(['api-collection', 'delete', collectionId, '-y', '--json']);
    }
  }
}
