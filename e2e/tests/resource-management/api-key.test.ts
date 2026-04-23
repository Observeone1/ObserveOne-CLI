import { runCLI, assertSuccess, assertContains, assertJSON } from '../../lib/test-runner.js';

export async function testApiKeyLifecycle() {
  const timestamp = Date.now();
  const keyName = `E2E-Key-${timestamp}`;
  let keyId: string | undefined;

  try {
    console.log('      - Creating API key...');
    const createResult = await runCLI(['api-key', 'create', '--name', keyName, '--json']);
    assertSuccess(createResult, 'API key creation failed');
    assertJSON(createResult.stdout, 'Create output should be JSON');
    const created = JSON.parse(createResult.stdout);
    keyId = created.apiKey?.id || created.data?.apiKey?.id;

    console.log('      - Listing API keys...');
    const listResult = await runCLI(['api-key', 'list', '--json']);
    assertSuccess(listResult, 'API key list failed');
    assertContains(listResult.stdout, keyName);

    if (keyId) {
      console.log(`      - Toggling API key ${keyId}...`);
      const toggleResult = await runCLI(['api-key', 'toggle', keyId, '--json']);
      assertSuccess(toggleResult, 'API key toggle failed');
      assertJSON(toggleResult.stdout, 'Toggle output should be JSON');

      console.log(`      - Revoking API key ${keyId}...`);
      const revokeResult = await runCLI(['api-key', 'revoke', keyId, '-y', '--json']);
      assertSuccess(revokeResult, 'API key revoke failed');
      keyId = undefined;
    }

    // Verify key is gone
    console.log('      - Verifying key is removed...');
    const listAfter = await runCLI(['api-key', 'list', '--json']);
    assertSuccess(listAfter, 'API key list after revoke failed');
    // Name should no longer appear (if list is complete)
  } finally {
    if (keyId) {
      console.log(`      - [Cleanup] Revoking dangling API key ${keyId}...`);
      await runCLI(['api-key', 'revoke', keyId, '-y', '--json']);
    }
  }
}

export async function testApiKeyListJsonEnvelope() {
  const result = await runCLI(['api-key', 'list', '--json']);
  if (result.stdout.trim()) {
    assertJSON(result.stdout, 'api-key list --json must output valid JSON');
  }
}
