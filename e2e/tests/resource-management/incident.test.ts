import { runCLI, assertSuccess, assertContains, assertJSON } from '../../lib/test-runner.js';

export async function testIncidentLifecycle() {
  const timestamp = Date.now();
  const title = `E2E Incident ${timestamp}`;
  let incidentId: number | undefined;

  try {
    console.log('      - Creating incident...');
    const createResult = await runCLI([
      'incident', 'create',
      '--title', title,
      '--priority', 'HIGH',
      '--description', 'E2E incident creation',
      '--json',
    ]);
    assertSuccess(createResult, 'Incident creation failed');
    assertJSON(createResult.stdout, 'Create output should be JSON');
    const createdIncident = JSON.parse(createResult.stdout);
    incidentId = createdIncident.id || createdIncident.data?.id;

    console.log('      - Listing incidents...');
    const listResult = await runCLI(['incident', 'list', '--json']);
    assertSuccess(listResult, 'Incident list failed');
    assertContains(listResult.stdout, title);

    console.log(`      - Getting incident ${incidentId}...`);
    const getResult = await runCLI(['incident', 'get', incidentId!.toString(), '--json']);
    assertSuccess(getResult, 'Incident get failed');

    console.log(`      - Updating incident ${incidentId}...`);
    const updateResult = await runCLI([
      'incident', 'update', incidentId!.toString(),
      '--title', title,
      '--priority', 'HIGH',
      '--description', 'Updated via E2E',
      '--json',
    ]);
    assertSuccess(updateResult, 'Incident update failed');

    console.log(`      - Deleting incident ${incidentId}...`);
    const deleteResult = await runCLI(['incident', 'delete', incidentId!.toString(), '-y', '--json']);
    assertSuccess(deleteResult, 'Incident delete failed');
    incidentId = undefined;
  } finally {
    if (incidentId) {
      console.log(`      - [Cleanup] Deleting dangling incident ${incidentId}...`);
      await runCLI(['incident', 'delete', incidentId.toString(), '-y', '--json']);
    }
  }
}
