import { runCLI, assertSuccess, assertJSON } from '../../lib/test-runner.js';

export async function testIncidentStateVerbs() {
  const timestamp = Date.now();
  const title = `E2E State Incident ${timestamp}`;
  let incidentId: number | undefined;

  try {
    console.log('      - Creating incident for state-verb test...');
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
    if (!incidentId) throw new Error('Could not extract incident ID');

    for (const verb of ['resolve', 'reopen', 'close'] as const) {
      console.log(`      - incident ${verb} ${incidentId}...`);
      const result = await runCLI(['incident', verb, incidentId.toString(), '--json']);
      assertSuccess(result, `Incident ${verb} failed`);
      assertJSON(result.stdout, `${verb} output should be JSON`);
    }

    console.log(`      - Deleting incident ${incidentId}...`);
    const deleteResult = await runCLI([
      'incident',
      'delete',
      incidentId.toString(),
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
