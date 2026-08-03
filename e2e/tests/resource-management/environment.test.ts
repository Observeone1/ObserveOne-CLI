import {
  runCLI,
  assertSuccess,
  assertContains,
  assertJSON,
  assertFailure,
  assertStrictJSON,
} from '../../lib/test-runner.js';

export async function testEnvironmentLifecycle() {
  const timestamp = Date.now();
  const name = `E2E-Env-${timestamp}`;
  let envId: string | undefined;

  try {
    console.log('      - Creating environment...');
    const createResult = await runCLI([
      'environment',
      'create',
      '--name',
      name,
      '--base-url',
      'https://api.example.com',
      '--var',
      'REGION=us-east',
      '--var',
      'TIER=paid',
      '--json',
    ]);
    assertSuccess(createResult, 'Environment creation failed');
    assertJSON(createResult.stdout, 'Create output should be JSON');
    const created = JSON.parse(createResult.stdout);
    envId = created.id || created.data?.id;
    if (!envId) throw new Error('Could not extract environment ID from creation response');

    console.log('      - Listing environments...');
    const listResult = await runCLI(['environment', 'list', '--json']);
    assertSuccess(listResult, 'Environment list failed');
    assertContains(listResult.stdout, name, 'Created environment name not found in list');

    console.log(`      - Getting environment ${envId}...`);
    const getResult = await runCLI(['environment', 'get', envId, '--json']);
    assertSuccess(getResult, 'Environment get failed');
    const fetched = JSON.parse(getResult.stdout);
    const env = fetched.data || fetched;
    if ((env.id || fetched.id) !== envId) {
      throw new Error(`Fetched environment ID does not match ${envId}`);
    }
    if (env.variables?.REGION !== 'us-east') {
      throw new Error(`Expected variable REGION=us-east, got: ${JSON.stringify(env.variables)}`);
    }

    console.log(`      - Updating environment ${envId} (name only, vars must survive)...`);
    const updateResult = await runCLI([
      'environment',
      'update',
      envId,
      '--name',
      `${name}-Updated`,
      '--json',
    ]);
    assertSuccess(updateResult, 'Environment update failed');

    const getAfterUpdate = await runCLI(['environment', 'get', envId, '--json']);
    assertSuccess(getAfterUpdate, 'Environment fetch after update failed');
    const afterUpdate = JSON.parse(getAfterUpdate.stdout);
    const updatedEnv = afterUpdate.data || afterUpdate;
    if (updatedEnv.variables?.REGION !== 'us-east') {
      throw new Error('Variables were wiped by a name-only update');
    }

    console.log(`      - Setting secrets for environment ${envId}...`);
    const secretsResult = await runCLI([
      'environment',
      'secrets',
      envId,
      '--secret',
      'API_TOKEN=super-secret',
      '--json',
    ]);
    assertSuccess(secretsResult, 'Environment secrets update failed');
    assertStrictJSON(secretsResult.stdout, 'secrets --json must output a valid JSON envelope');
    const secretsParsed = JSON.parse(secretsResult.stdout.trim()) as {
      data?: { secret_keys?: string[] };
    };
    const secretKeys = secretsParsed.data?.secret_keys || [];
    if (!secretKeys.includes('API_TOKEN')) {
      throw new Error(`Expected API_TOKEN in secret_keys, got: ${JSON.stringify(secretKeys)}`);
    }
    // The secret value must never come back from the API.
    if (secretsResult.stdout.includes('super-secret')) {
      throw new Error('Secret value leaked in secrets response');
    }
    const getAfterSecrets = await runCLI(['environment', 'get', envId, '--json']);
    if (getAfterSecrets.stdout.includes('super-secret')) {
      throw new Error('Secret value leaked in environment get response');
    }

    console.log(`      - Deleting environment ${envId}...`);
    const deleteResult = await runCLI(['environment', 'delete', envId, '-y', '--json']);
    assertSuccess(deleteResult, 'Environment delete failed');
    envId = undefined;

    console.log('      - Verifying environment deletion...');
    const verifyResult = await runCLI(['environment', 'get', name]);
    assertFailure(verifyResult, 'Environment should not be findable after deletion');
  } finally {
    if (envId) {
      console.log(`      - [Cleanup] Deleting dangling environment ${envId}...`);
      await runCLI(['environment', 'delete', envId, '-y', '--json']);
    }
  }
}

export async function testEnvironmentSecretsRequiresPair() {
  const result = await runCLI(['environment', 'secrets', '00000000-0000-0000-0000-000000000000']);
  assertFailure(result, 'environment secrets with no --secret should fail');
}
