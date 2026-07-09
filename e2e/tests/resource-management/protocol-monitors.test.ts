import {
  runCLI,
  assertSuccess,
  assertContains,
  assertJSON,
  assertFailure,
  assertStrictJSON,
} from '../../lib/test-runner.js';

type CreateArgs = string[];

/**
 * Shared CRUD lifecycle for the protocol-level monitor commands (SSL/TCP/UDP/DB).
 * IDs are UUID strings (the backend routes use requireUuidParam).
 */
async function runProtocolMonitorLifecycle(
  command: string,
  label: string,
  createArgs: CreateArgs,
  name: string
): Promise<void> {
  let monitorId: string | undefined;

  try {
    console.log(`      - Creating ${label} monitor...`);
    const createResult = await runCLI([command, 'create', ...createArgs, '--json']);
    assertSuccess(createResult, `${label} monitor creation failed`);
    assertJSON(createResult.stdout, 'Create output should be JSON');
    const created = JSON.parse(createResult.stdout);
    monitorId = created.id || created.data?.id;
    if (!monitorId) throw new Error(`Could not extract ${label} monitor ID from creation response`);

    console.log(`      - Listing ${label} monitors...`);
    const listResult = await runCLI([command, 'list', '--json']);
    assertSuccess(listResult, `${label} monitor list failed`);
    assertContains(listResult.stdout, name, `Created ${label} monitor name not found in list`);

    console.log(`      - Getting ${label} monitor ${monitorId}...`);
    const getResult = await runCLI([command, 'get', monitorId, '--json']);
    assertSuccess(getResult, `${label} monitor get failed`);
    const fetched = JSON.parse(getResult.stdout);
    const fetchedId = fetched.id || fetched.data?.id;
    if (fetchedId !== monitorId) {
      throw new Error(`Fetched ID ${fetchedId} does not match ${monitorId}`);
    }

    console.log(`      - Updating ${label} monitor ${monitorId}...`);
    const updateResult = await runCLI([
      command,
      'update',
      monitorId,
      '--description',
      `${label} updated from e2e`,
      '--json',
    ]);
    assertSuccess(updateResult, `${label} monitor update failed`);

    console.log(`      - Toggling ${label} monitor ${monitorId}...`);
    const toggleResult = await runCLI([command, 'toggle', monitorId, '--json']);
    assertSuccess(toggleResult, `${label} monitor toggle failed`);

    console.log(`      - Toggling mute for ${label} monitor ${monitorId}...`);
    const muteResult = await runCLI([command, 'toggle-muted', monitorId, '--json']);
    assertSuccess(muteResult, `${label} monitor toggle-muted failed`);
    assertJSON(muteResult.stdout, 'toggle-muted output should be JSON');

    console.log(`      - Deleting ${label} monitor ${monitorId}...`);
    const deleteResult = await runCLI([command, 'delete', monitorId, '-y', '--json']);
    assertSuccess(deleteResult, `${label} monitor delete failed`);
    monitorId = undefined;

    console.log(`      - Verifying ${label} monitor deletion...`);
    const verifyResult = await runCLI([command, 'get', name]);
    assertFailure(verifyResult, `${label} monitor should not be findable after deletion`);
  } finally {
    if (monitorId) {
      console.log(`      - [Cleanup] Deleting dangling ${label} monitor ${monitorId}...`);
      await runCLI([command, 'delete', monitorId, '-y', '--json']);
    }
  }
}

export async function testSslMonitorLifecycle() {
  const name = `E2E-SSL-${Date.now()}`;
  await runProtocolMonitorLifecycle(
    'ssl-monitor',
    'SSL',
    ['--name', name, '--hostname', 'example.com', '--warn-days', '14'],
    name
  );
}

export async function testTcpMonitorLifecycle() {
  const name = `E2E-TCP-${Date.now()}`;
  await runProtocolMonitorLifecycle(
    'tcp-monitor',
    'TCP',
    ['--name', name, '--host', 'example.com', '--port', '443'],
    name
  );
}

export async function testUdpMonitorLifecycle() {
  const name = `E2E-UDP-${Date.now()}`;
  await runProtocolMonitorLifecycle(
    'udp-monitor',
    'UDP',
    ['--name', name, '--host', '1.1.1.1', '--port', '53', '--expect-response'],
    name
  );
}

export async function testDbMonitorLifecycle() {
  const name = `E2E-DB-${Date.now()}`;
  await runProtocolMonitorLifecycle(
    'db-monitor',
    'Database',
    ['--name', name, '--host', 'db.example.com', '--port', '5432', '--protocol', 'postgres'],
    name
  );
}

export async function testDbMonitorRejectsBadProtocol() {
  const name = `E2E-DB-BadProto-${Date.now()}`;
  const result = await runCLI([
    'db-monitor',
    'create',
    '--name',
    name,
    '--host',
    'db.example.com',
    '--port',
    '5432',
    '--protocol',
    'mongodb',
  ]);
  assertFailure(result, 'db-monitor create with an invalid protocol should fail');
}

export async function testSslMonitorRunBadIdJsonEnvelope() {
  const result = await runCLI([
    'ssl-monitor',
    'run',
    '00000000-0000-0000-0000-000000000000',
    '--json',
  ]);
  assertStrictJSON(result.stdout, 'ssl-monitor run --json must output a valid JSON envelope');
  const parsed = JSON.parse(result.stdout.trim()) as { status?: string };
  if (parsed.status !== 'SUCCESS' && parsed.status !== 'ERROR') {
    throw new Error(`JSON envelope status must be SUCCESS or ERROR, got: ${parsed.status}`);
  }
}
