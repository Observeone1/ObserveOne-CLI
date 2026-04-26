import { runCLI, assertSuccess, assertContains, assertJSON } from '../lib/test-runner.js';
import { ResourcePreview } from '../lib/types.js';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';

export async function testApplyDryRun() {
  const timestamp = Date.now();
  const testConfigFile = join(process.cwd(), `e2e-obs-dryrun-${timestamp}.json`);

  const configContent = {
    monitors: [
      {
        name: `E2E-DryRun-Monitor-${timestamp}`,
        url: 'https://example.com/dry-run-test',
        interval: '*/10 * * * *',
        alert_on_failure: true,
      },
    ],
  };

  try {
    writeFileSync(testConfigFile, JSON.stringify(configContent, null, 2));

    // 1. Dry-run before resource exists — should show as "to create", no API write
    console.log('      - Running dry-run before create...');
    const dryRunCreate = await runCLI(['apply', testConfigFile, '--dry-run']);
    assertSuccess(dryRunCreate, 'Dry-run (pre-create) failed');
    assertContains(dryRunCreate.stdout, configContent.monitors[0].name);
    assertContains(dryRunCreate.stdout, 'to create');
    assertContains(dryRunCreate.stdout, 'Run without --dry-run to apply');

    // 2. Verify resource was NOT created (list should not contain it)
    console.log('      - Verifying dry-run made no writes...');
    const listAfterDry = await runCLI(['monitor', 'list', '--json']);
    const monitors =
      listAfterDry.exitCode === 0 ? (JSON.parse(listAfterDry.stdout).data?.items ?? []) : [];
    const exists = monitors.some((m: ResourcePreview) => m.name === configContent.monitors[0].name);
    if (exists) throw new Error('Dry-run should not have created the monitor');

    // 3. Real apply to create
    console.log('      - Running real apply to create...');
    const realApply = await runCLI(['apply', testConfigFile, '--json']);
    assertSuccess(realApply, 'Real apply failed');
    assertJSON(realApply.stdout, 'Apply output should be JSON');

    // 4. Dry-run after create with no changes — should show no changes
    console.log('      - Running dry-run with no changes...');
    const dryRunNoChange = await runCLI(['apply', testConfigFile, '--dry-run']);
    assertSuccess(dryRunNoChange, 'Dry-run (no-change) failed');
    assertContains(dryRunNoChange.stdout, 'No changes');

    // 5. Dry-run after modifying config — should show update diff
    console.log('      - Running dry-run with modification...');
    const modifiedConfig = {
      monitors: [{ ...configContent.monitors[0], interval: '*/30 * * * *' }],
    };
    writeFileSync(testConfigFile, JSON.stringify(modifiedConfig, null, 2));

    const dryRunUpdate = await runCLI(['apply', testConfigFile, '--dry-run']);
    assertSuccess(dryRunUpdate, 'Dry-run (update) failed');
    assertContains(dryRunUpdate.stdout, configContent.monitors[0].name);
    assertContains(dryRunUpdate.stdout, 'to update');
  } finally {
    if (existsSync(testConfigFile)) unlinkSync(testConfigFile);

    console.log('      - [Cleanup] Removing dry-run test monitor...');
    const listResult = await runCLI(['monitor', 'list', '--json']);
    if (listResult.exitCode === 0) {
      const monitors = JSON.parse(listResult.stdout).data?.items || [];
      const m = monitors.find((m: ResourcePreview) => m.name === configContent.monitors[0].name);
      if (m?.id) await runCLI(['monitor', 'delete', m.id.toString(), '-y', '--json']);
    }
  }
}

/**
 * E2E test for Declarative Apply Workflow
 */
export async function testDeclarativeApply() {
  const timestamp = Date.now();
  const testConfigFile = join(process.cwd(), `e2e-obs-${timestamp}.json`);

  const configContent = {
    monitors: [
      {
        name: `E2E-Apply-Monitor-${timestamp}`,
        url: 'https://example.com/apply-test',
        interval: '*/10 * * * *',
        alert_on_failure: true,
      },
    ],
    api_checks: [
      {
        name: `E2E-Apply-Check-${timestamp}`,
        url: 'https://api.example.com/apply',
        method: 'GET',
      },
    ],
  };

  try {
    // 1. Create config file
    writeFileSync(testConfigFile, JSON.stringify(configContent, null, 2));

    // 2. Initial Apply (Create)
    console.log('      - Running initial apply (create)...');
    const createResult = await runCLI(['apply', testConfigFile, '--json']);
    assertSuccess(createResult, 'Initial apply failed');
    assertJSON(createResult.stdout, 'Apply output should be JSON');

    const parsedCreate = JSON.parse(createResult.stdout);
    if (parsedCreate.data?.summary?.monitors?.created !== 1) {
      throw new Error('Expected 1 monitor to be created');
    }
    if (parsedCreate.data?.summary?.apiChecks?.created !== 1) {
      throw new Error('Expected 1 API check to be created');
    }

    // 3. Second Apply (No-op - unchanged)
    console.log('      - Running second apply (unchanged - should skip updates)...');
    const updateResult = await runCLI(['apply', testConfigFile, '--json']);
    assertSuccess(updateResult, 'Second apply failed');

    const parsedUpdate = JSON.parse(updateResult.stdout);
    // With delta optimization, unchanged resources should be skipped (not updated)
    if (parsedUpdate.data?.summary?.monitors?.unchanged !== 1) {
      throw new Error('Expected 1 monitor to be unchanged (delta optimization)');
    }
    if (parsedUpdate.data?.summary?.apiChecks?.unchanged !== 1) {
      throw new Error('Expected 1 API check to be unchanged (delta optimization)');
    }
    // Verify no updates were made since config didn't change
    if (parsedUpdate.data?.summary?.monitors?.updated !== 0) {
      throw new Error('Expected 0 monitors updated (config unchanged)');
    }
    if (parsedUpdate.data?.summary?.apiChecks?.updated !== 0) {
      throw new Error('Expected 0 API checks updated (config unchanged)');
    }

    // 4. Third Apply with modification (should update only changed)
    console.log('      - Running third apply with modification...');
    const modifiedConfig = {
      ...configContent,
      monitors: [
        {
          ...configContent.monitors[0],
          interval: '*/15 * * * *', // Changed interval
        },
      ],
    };
    writeFileSync(testConfigFile, JSON.stringify(modifiedConfig, null, 2));

    const modifyResult = await runCLI(['apply', testConfigFile, '--json']);
    assertSuccess(modifyResult, 'Third apply (modify) failed');

    const parsedModify = JSON.parse(modifyResult.stdout);
    if (parsedModify.data?.summary?.monitors?.updated !== 1) {
      throw new Error('Expected 1 monitor to be updated after modification');
    }
    if (parsedModify.data?.summary?.apiChecks?.unchanged !== 1) {
      throw new Error('Expected 1 API check to remain unchanged');
    }

    // 5. Verify resources exist in list
    const listResult = await runCLI(['monitor', 'list', '--json']);
    assertContains(listResult.stdout, configContent.monitors[0].name);
  } finally {
    // Cleanup: Remove the file
    if (existsSync(testConfigFile)) {
      unlinkSync(testConfigFile);
    }

    // Cleanup: Delete the created resources from backend
    console.log('      - [Cleanup] Removing declarative resources...');

    // We have to list them to get IDs since apply doesn't return the raw IDs directly in the summary
    const monitorListResult = await runCLI(['monitor', 'list', '--json']);
    if (monitorListResult.exitCode === 0) {
      const monitors = JSON.parse(monitorListResult.stdout).data?.items || [];
      const m = monitors.find((m: ResourcePreview) => m.name === configContent.monitors[0].name);
      if (m && m.id) {
        await runCLI(['monitor', 'delete', m.id.toString(), '-y', '--json']);
      }
    }

    const checkListResult = await runCLI(['check', 'list', '--json']);
    if (checkListResult.exitCode === 0) {
      const checks = JSON.parse(checkListResult.stdout).data?.items || [];
      const c = checks.find((c: ResourcePreview) => c.name === configContent.api_checks[0].name);
      if (c && c.id) {
        await runCLI(['check', 'delete', c.id.toString(), '-y', '--json']);
      }
    }
  }
}

export async function testApplySingleResourceFile() {
  const timestamp = Date.now();
  const bareMonitorFile = join(process.cwd(), `e2e-apply-monitor-${timestamp}.json`);
  const wrappedHeartbeatFile = join(process.cwd(), `e2e-apply-heartbeat-${timestamp}.json`);

  const bareMonitor = {
    name: `E2E-Apply-Single-Monitor-${timestamp}`,
    url: `https://example.com/single-apply-${timestamp}`,
    interval: '*/20 * * * *',
    alert_on_failure: true,
  };

  const wrappedHeartbeat = {
    heartbeat: {
      name: `E2E-Apply-Single-Heartbeat-${timestamp}`,
      period: 600,
      grace_period: 60,
    },
  };

  try {
    writeFileSync(bareMonitorFile, JSON.stringify(bareMonitor, null, 2));
    writeFileSync(wrappedHeartbeatFile, JSON.stringify(wrappedHeartbeat, null, 2));

    const applyMonitor = await runCLI(['apply', bareMonitorFile, '--json']);
    assertSuccess(applyMonitor, 'Single-resource monitor apply failed');
    assertJSON(applyMonitor.stdout, 'Single-resource monitor apply should output JSON');
    const parsedMonitorApply = JSON.parse(applyMonitor.stdout);
    if (parsedMonitorApply.data?.summary?.monitors?.created !== 1) {
      throw new Error('Expected single monitor apply to create 1 monitor');
    }

    const applyHeartbeat = await runCLI(['apply', wrappedHeartbeatFile, '--json']);
    assertSuccess(applyHeartbeat, 'Wrapped heartbeat apply failed');
    assertJSON(applyHeartbeat.stdout, 'Wrapped heartbeat apply should output JSON');
    const parsedHeartbeatApply = JSON.parse(applyHeartbeat.stdout);
    if (parsedHeartbeatApply.data?.summary?.heartbeats?.created !== 1) {
      throw new Error('Expected wrapped heartbeat apply to create 1 heartbeat');
    }
  } finally {
    if (existsSync(bareMonitorFile)) unlinkSync(bareMonitorFile);
    if (existsSync(wrappedHeartbeatFile)) unlinkSync(wrappedHeartbeatFile);

    const monitorListResult = await runCLI(['monitor', 'list', '--json']);
    if (monitorListResult.exitCode === 0) {
      const monitors = JSON.parse(monitorListResult.stdout).data?.items || [];
      const monitor = monitors.find((m: ResourcePreview) => m.name === bareMonitor.name);
      if (monitor?.id) {
        await runCLI(['monitor', 'delete', monitor.id.toString(), '-y', '--json']);
      }
    }

    const heartbeatListResult = await runCLI(['heartbeat', 'list', '--json']);
    if (heartbeatListResult.exitCode === 0) {
      const heartbeats = JSON.parse(heartbeatListResult.stdout).data?.items || [];
      const heartbeat = heartbeats.find(
        (h: ResourcePreview) => h.name === wrappedHeartbeat.heartbeat.name
      );
      if (heartbeat?.id) {
        await runCLI(['heartbeat', 'delete', heartbeat.id.toString(), '-y', '--json']);
      }
    }
  }
}
