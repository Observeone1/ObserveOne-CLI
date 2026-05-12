import { runCLI, assertSuccess, assertJSON } from '../lib/test-runner.js';
import { ResourcePreview } from '../lib/types.js';
import { unlinkSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * E2E test for Declarative Export Workflow
 */
export async function testDeclarativeExport() {
  const timestamp = Date.now();
  const testExportFile = join(process.cwd(), `e2e-export-${timestamp}.json`);
  const monitorName = `E2E-Export-Monitor-${timestamp}`;
  const checkName = `E2E-Export-Check-${timestamp}`;

  let monitorId: number | undefined;
  let checkId: number | undefined;

  try {
    // 1. Create a monitor to export
    const createMonResult = await runCLI([
      'monitor',
      'create',
      '--name',
      monitorName,
      '--url',
      'https://example.com/export-test',
      '--interval',
      '*/10 * * * *',
      '--json',
    ]);
    monitorId = JSON.parse(createMonResult.stdout).data?.id;

    // 2. Create an API check to export
    const createCheckResult = await runCLI([
      'check',
      'create',
      '--name',
      checkName,
      '--url',
      'https://api.example.com/export',
      '--method',
      'GET',
      '--json',
    ]);
    checkId = JSON.parse(createCheckResult.stdout).data?.id;

    // 3. Run Export
    console.log('      - Running export...');
    const exportResult = await runCLI(['export', '-f', testExportFile, '--json']);
    assertSuccess(exportResult, 'Export failed');
    assertJSON(exportResult.stdout, 'Export output should be JSON');

    // 4. Verify the exported file
    if (!existsSync(testExportFile)) {
      throw new Error(`Export file ${testExportFile} was not created`);
    }

    const exportedData = JSON.parse(readFileSync(testExportFile, 'utf-8'));

    // Check if our test resources made it into the exported config
    const foundMonitor = exportedData.monitors?.find(
      (m: ResourcePreview) => m.name === monitorName
    );
    if (!foundMonitor) {
      throw new Error('Created test monitor was not found in exported file');
    }
    if (foundMonitor.url !== 'https://example.com/export-test') {
      throw new Error('Exported monitor URL mismatch');
    }

    const foundCheck = exportedData.api_checks?.find((c: ResourcePreview) => c.name === checkName);
    if (!foundCheck) {
      throw new Error('Created test API check was not found in exported file');
    }
  } finally {
    // Cleanup: Remove the exported file
    if (existsSync(testExportFile)) {
      unlinkSync(testExportFile);
    }

    // Cleanup: Delete the created resources from backend
    console.log('      - [Cleanup] Removing export test resources...');
    if (monitorId) {
      await runCLI(['monitor', 'delete', monitorId.toString(), '-y', '--json']);
    }
    if (checkId) {
      await runCLI(['check', 'delete', checkId.toString(), '-y', '--json']);
    }
  }
}

/**
 * E2E: export must include alert-channels, status-pages, incidents, suites
 * (the four resource types added in v1.17.0). Verifies the round-trip surface
 * is complete — anyone with these resources can snapshot config-as-code.
 */
export async function testDeclarativeExportExtendedCoverage() {
  const timestamp = Date.now();
  const testExportFile = join(process.cwd(), `e2e-export-extended-${timestamp}.json`);
  const channelName = `e2e-export-channel-${timestamp}`;
  const statusPageSlug = `e2e-export-sp-${timestamp}`;
  const statusPageName = `E2E Export SP ${timestamp}`;
  const incidentTitle = `E2E Export Incident ${timestamp}`;

  let channelId: number | undefined;
  let statusPageId: number | undefined;
  let incidentId: number | undefined;

  try {
    // 1. Create alert channel (webhook — no real delivery)
    const createChannelResult = await runCLI([
      'alert-channel',
      'create',
      '--name',
      channelName,
      '--type',
      'webhook',
      '--webhook-url',
      'https://example.invalid/sink',
      '--json',
    ]);
    const channelPayload = JSON.parse(createChannelResult.stdout);
    channelId = channelPayload?.alert_channel?.id ?? channelPayload?.data?.id ?? channelPayload?.id;

    // 2. Create status page
    const createSPResult = await runCLI([
      'status-page',
      'create',
      '--slug',
      statusPageSlug,
      '--name',
      statusPageName,
      '--json',
    ]);
    const spPayload = JSON.parse(createSPResult.stdout);
    statusPageId = spPayload?.status_page?.id ?? spPayload?.data?.id ?? spPayload?.id;

    // 3. Create incident
    const createIncResult = await runCLI([
      'incident',
      'create',
      '--title',
      incidentTitle,
      '--priority',
      'LOW',
      '--json',
    ]);
    const incPayload = JSON.parse(createIncResult.stdout);
    incidentId = incPayload?.incident?.id ?? incPayload?.data?.id ?? incPayload?.id;

    // 4. Run export
    console.log('      - Running export (extended coverage)...');
    const exportResult = await runCLI(['export', '-f', testExportFile, '--json']);
    assertSuccess(exportResult, 'Export failed');
    assertJSON(exportResult.stdout, 'Export output should be JSON');

    if (!existsSync(testExportFile)) {
      throw new Error(`Export file ${testExportFile} was not created`);
    }
    const data = JSON.parse(readFileSync(testExportFile, 'utf-8'));

    // 5. Assert each new top-level key is present and contains our test resource
    if (!Array.isArray(data.alert_channels)) {
      throw new Error('Expected `alert_channels` array in export');
    }
    if (!data.alert_channels.find((c: ResourcePreview) => c.name === channelName)) {
      throw new Error('Created alert channel missing from export');
    }
    // Strip-DB-fields sanity check
    const ac = data.alert_channels.find((c: ResourcePreview) => c.name === channelName);
    if ('id' in ac || 'created_at' in ac) {
      throw new Error('Alert channel export should strip DB-owned fields (id, created_at)');
    }

    if (!Array.isArray(data.status_pages)) {
      throw new Error('Expected `status_pages` array in export');
    }
    if (!data.status_pages.find((s: ResourcePreview) => s.slug === statusPageSlug)) {
      throw new Error('Created status page missing from export');
    }

    if (!Array.isArray(data.incidents)) {
      throw new Error('Expected `incidents` array in export');
    }
    if (!data.incidents.find((i: ResourcePreview) => i.title === incidentTitle)) {
      throw new Error('Created incident missing from export');
    }

    if (!Array.isArray(data.suites)) {
      throw new Error('Expected `suites` array in export (may be empty)');
    }
  } finally {
    if (existsSync(testExportFile)) {
      unlinkSync(testExportFile);
    }
    console.log('      - [Cleanup] Removing extended export test resources...');
    if (incidentId) {
      await runCLI(['incident', 'delete', incidentId.toString(), '-y', '--json']);
    }
    if (statusPageId) {
      await runCLI(['status-page', 'delete', statusPageId.toString(), '-y', '--json']);
    }
    if (channelId) {
      await runCLI(['alert-channel', 'delete', channelId.toString(), '-y', '--json']);
    }
  }
}

/**
 * E2E: --include-scripts inlines suite Playwright scripts under suites[].tests.
 * Verifies the flag is accepted, JSON is well-formed, and any suite with
 * test_count > 0 surfaces inlined tests. Skips the inline-content assertion
 * when no suites with tests exist (test env may have none).
 */
export async function testExportIncludeScripts() {
  const timestamp = Date.now();
  const testExportFile = join(process.cwd(), `e2e-export-scripts-${timestamp}.json`);

  try {
    const result = await runCLI(['export', '-f', testExportFile, '--include-scripts', '--json']);
    assertSuccess(result, 'export --include-scripts failed');
    assertJSON(result.stdout, 'export --include-scripts output should be JSON');

    if (!existsSync(testExportFile)) {
      throw new Error(`Export file ${testExportFile} was not created`);
    }
    const exported = JSON.parse(readFileSync(testExportFile, 'utf-8'));
    if (!Array.isArray(exported.suites)) {
      throw new Error('Expected suites array in --include-scripts export');
    }

    const suitesWithTests = exported.suites.filter(
      (s: { tests?: unknown[] }) => Array.isArray(s.tests) && s.tests.length > 0
    );
    if (suitesWithTests.length > 0) {
      for (const s of suitesWithTests) {
        for (const t of s.tests) {
          if (typeof t.name !== 'string' || typeof t.script !== 'string' || !t.script.length) {
            throw new Error(
              `Inlined suite test missing name/script: ${JSON.stringify(t).slice(0, 200)}`
            );
          }
        }
      }
      console.log(`      - ${suitesWithTests.length} suite(s) with inlined scripts ✓`);
    } else {
      console.log('      - no suites with tests in this env; flag-shape only assertion');
    }
  } finally {
    if (existsSync(testExportFile)) {
      unlinkSync(testExportFile);
    }
  }
}
