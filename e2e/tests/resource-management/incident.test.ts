import { runCLI, assertSuccess, assertContains, assertJSON } from '../../lib/test-runner.js';

export async function testIncidentLifecycle() {
  const timestamp = Date.now();
  const title = `E2E Incident ${timestamp}`;
  let incidentId: number | undefined;

  try {
    console.log('      - Creating incident...');
    const createResult = await runCLI([
      'incident',
      'create',
      '--title',
      title,
      '--priority',
      'HIGH',
      '--description',
      'E2E incident creation',
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
      'incident',
      'update',
      incidentId!.toString(),
      '--title',
      title,
      '--priority',
      'HIGH',
      '--description',
      'Updated via E2E',
      '--json',
    ]);
    assertSuccess(updateResult, 'Incident update failed');

    console.log(`      - Adding comment to incident ${incidentId}...`);
    const commentResult = await runCLI([
      'incident',
      'comment',
      incidentId!.toString(),
      '--message',
      'E2E test comment',
      '--json',
    ]);
    assertSuccess(commentResult, 'Incident comment failed');
    assertJSON(commentResult.stdout, 'Comment output should be JSON');

    console.log(`      - Deleting incident ${incidentId}...`);
    const deleteResult = await runCLI([
      'incident',
      'delete',
      incidentId!.toString(),
      '-y',
      '--json',
    ]);
    assertSuccess(deleteResult, 'Incident delete failed');
    incidentId = undefined;
  } finally {
    if (incidentId) {
      console.log(`      - [Cleanup] Deleting dangling incident ${incidentId}...`);
      await runCLI(['incident', 'delete', incidentId.toString(), '-y', '--json']);
    }
  }
}

export async function testIncidentAssignUnassign() {
  const timestamp = Date.now();
  const title = `E2E Assign Incident ${timestamp}`;
  let incidentId: number | undefined;

  try {
    console.log('      - Creating incident for assign test...');
    const createResult = await runCLI([
      'incident',
      'create',
      '--title',
      title,
      '--priority',
      'LOW',
      '--json',
    ]);
    assertSuccess(createResult, 'Incident creation failed');
    assertJSON(createResult.stdout, 'Create output should be JSON');
    const created = JSON.parse(createResult.stdout);
    incidentId = created.id || created.data?.id;

    // List incidents to get an open one
    const listResult = await runCLI(['incident', 'list', '--json']);
    assertSuccess(listResult, 'Incident list failed');
    assertContains(listResult.stdout, title);

    // We can only test assign if we have a user ID. Try using a dummy placeholder;
    // the test passes as long as assign returns success or a known error.
    // Since we can't create a user in e2e, we test unassign (assigned_to: null) which should always work.
    if (incidentId) {
      console.log(`      - Unassigning incident ${incidentId}...`);
      const unassignResult = await runCLI([
        'incident',
        'unassign',
        incidentId.toString(),
        '--json',
      ]);
      // Unassign should succeed (no user needed to unassign)
      assertSuccess(unassignResult, 'Incident unassign failed');
      assertJSON(unassignResult.stdout, 'Unassign output should be JSON');
    }

    console.log(`      - Deleting incident ${incidentId}...`);
    const deleteResult = await runCLI([
      'incident',
      'delete',
      incidentId!.toString(),
      '-y',
      '--json',
    ]);
    assertSuccess(deleteResult, 'Incident delete failed');
    incidentId = undefined;
  } finally {
    if (incidentId) {
      console.log(`      - [Cleanup] Deleting dangling incident ${incidentId}...`);
      await runCLI(['incident', 'delete', incidentId.toString(), '-y', '--json']);
    }
  }
}
