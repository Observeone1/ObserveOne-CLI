import {
  runCLI,
  assertSuccess,
  assertContains,
  assertJSON,
  assertFailure,
} from '../../lib/test-runner.js';

export async function testProjectLifecycle() {
  const timestamp = Date.now();
  const name = `E2E-Project-${timestamp}`;
  let projectId: string | undefined;

  try {
    console.log('      - Creating project...');
    const createResult = await runCLI([
      'project',
      'create',
      '--name',
      name,
      '--description',
      'Created from e2e',
      '--json',
    ]);
    assertSuccess(createResult, 'Project creation failed');
    assertJSON(createResult.stdout, 'Create output should be JSON');
    const created = JSON.parse(createResult.stdout);
    projectId = created.id || created.data?.id;
    if (!projectId) throw new Error('Could not extract project ID from creation response');

    console.log('      - Listing projects...');
    const listResult = await runCLI(['project', 'list', '--json']);
    assertSuccess(listResult, 'Project list failed');
    assertContains(listResult.stdout, name, 'Created project name not found in list');

    console.log(`      - Getting project ${projectId}...`);
    const getResult = await runCLI(['project', 'get', projectId, '--json']);
    assertSuccess(getResult, 'Project get failed');

    console.log(`      - Updating project ${projectId}...`);
    const updateResult = await runCLI([
      'project',
      'update',
      projectId,
      '--description',
      'Updated from e2e',
      '--json',
    ]);
    assertSuccess(updateResult, 'Project update failed');

    console.log(`      - Deleting project ${projectId}...`);
    const deleteResult = await runCLI(['project', 'delete', projectId, '-y', '--json']);
    assertSuccess(deleteResult, 'Project delete failed');
    projectId = undefined;

    console.log('      - Verifying project deletion...');
    const verifyResult = await runCLI(['project', 'get', name]);
    assertFailure(verifyResult, 'Project should not be findable after deletion');
  } finally {
    if (projectId) {
      console.log(`      - [Cleanup] Deleting dangling project ${projectId}...`);
      await runCLI(['project', 'delete', projectId, '-y', '--json']);
    }
  }
}
