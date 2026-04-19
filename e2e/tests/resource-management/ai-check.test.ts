import { runCLI, assertSuccess, assertJSON } from '../../lib/test-runner.js';

export async function testAiCheckLifecycle() {
  const timestamp = Date.now();
  const aiName = `E2E-AI-${timestamp}`;
  const aiUrl = 'https://example.com';
  const aiPrompt = 'Check if the title is Example Domain';
  let aiId: number | undefined;

  try {
    console.log('      - Creating AI check...');
    const createResult = await runCLI([
      'ai-check', 'create',
      '--name', aiName,
      '--url', aiUrl,
      '--prompt', aiPrompt,
      '--json',
    ]);
    assertSuccess(createResult, 'AI check creation failed');
    assertJSON(createResult.stdout, 'Create output should be JSON');
    const createdAi = JSON.parse(createResult.stdout);
    aiId = createdAi.id || createdAi.data?.id;

    console.log(`      - Getting AI check ${aiId}...`);
    const getResult = await runCLI(['ai-check', 'get', aiId!.toString(), '--json']);
    assertSuccess(getResult, 'AI check get failed');

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
