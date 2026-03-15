import {
  runCLI,
  assertSuccess,
  assertContains,
  assertJSON,
} from '../lib/test-runner.js';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';

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
      const monitors = JSON.parse(monitorListResult.stdout).data || [];
      const m = monitors.find((m: any) => m.name === configContent.monitors[0].name);
      if (m && m.id) {
        await runCLI(['monitor', 'delete', m.id.toString(), '-y', '--json']);
      }
    }

    const checkListResult = await runCLI(['check', 'list', '--json']);
    if (checkListResult.exitCode === 0) {
      const checks = JSON.parse(checkListResult.stdout).data || [];
      const c = checks.find((c: any) => c.name === configContent.api_checks[0].name);
      if (c && c.id) {
        await runCLI(['check', 'delete', c.id.toString(), '-y', '--json']);
      }
    }
  }
}
