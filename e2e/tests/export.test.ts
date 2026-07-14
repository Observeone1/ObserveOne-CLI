import { runCLI, assertSuccess, assertJSON } from '../lib/test-runner.js';
import { ResourcePreview } from '../lib/types.js';
import { unlinkSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

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
    // v1.25.0: monitors carry a bundle-local surrogate `id` so a status
    // page's `monitor_id` reference resolves on import.
    if (typeof (foundMonitor as { id?: unknown }).id !== 'string') {
      throw new Error('Exported monitor must carry its bundle-local `id`');
    }

    const foundCheck = exportedData.api_checks?.find((c: ResourcePreview) => c.name === checkName);
    if (!foundCheck) {
      throw new Error('Created test API check was not found in exported file');
    }
    if (typeof (foundCheck as { id?: unknown }).id !== 'string') {
      throw new Error('Exported api_check must carry its bundle-local `id`');
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
    // v1.25.0 contract: alert channels now carry a bundle-local surrogate
    // `id` (so monitors' `channel_ids` resolve on import), but all other
    // DB-owned fields (created_at, user_id, ...) are still stripped.
    const ac = data.alert_channels.find((c: ResourcePreview) => c.name === channelName);
    if (typeof (ac as { id?: unknown }).id !== 'string') {
      throw new Error('Alert channel export must carry its bundle-local `id`');
    }
    if ('created_at' in ac) {
      throw new Error('Alert channel export should still strip DB-owned `created_at`');
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
 * E2E: v1.25.0 — suite scripts are inlined by DEFAULT (lossless export);
 * `--no-scripts` opts out; the legacy `--include-scripts` flag is still
 * accepted as a no-op (CI back-compat). Asserts the well-formedness of any
 * inlined scripts and that `--no-scripts` produces script-free suites.
 */
export async function testExportIncludeScripts() {
  const timestamp = Date.now();
  const defaultFile = join(process.cwd(), `e2e-export-default-${timestamp}.json`);
  const noScriptsFile = join(process.cwd(), `e2e-export-noscripts-${timestamp}.json`);
  const legacyFile = join(process.cwd(), `e2e-export-legacy-${timestamp}.json`);

  try {
    // 1. Default export — scripts included, no flag needed.
    const def = await runCLI(['export', '-f', defaultFile, '--json']);
    assertSuccess(def, 'default export failed');
    assertJSON(def.stdout, 'default export output should be JSON');
    if (JSON.parse(def.stdout).data?.scriptsIncluded !== true) {
      throw new Error('Default export must report scriptsIncluded=true');
    }
    const defaultData = JSON.parse(readFileSync(defaultFile, 'utf-8'));
    if (!Array.isArray(defaultData.suites)) {
      throw new Error('Expected suites array in default export');
    }
    const suitesWithTests = defaultData.suites.filter(
      (s: { tests?: unknown[] }) => Array.isArray(s.tests) && s.tests.length > 0
    );
    for (const s of suitesWithTests) {
      for (const t of s.tests) {
        if (typeof t.name !== 'string' || typeof t.script !== 'string' || !t.script.length) {
          throw new Error(
            `Inlined suite test missing name/script: ${JSON.stringify(t).slice(0, 200)}`
          );
        }
      }
    }
    console.log(
      suitesWithTests.length > 0
        ? `      - default export inlined scripts for ${suitesWithTests.length} suite(s) ✓`
        : '      - no suites with tests in this env; default-shape assertion only'
    );

    // 2. --no-scripts — suites must carry no `tests`.
    const no = await runCLI(['export', '-f', noScriptsFile, '--no-scripts', '--json']);
    assertSuccess(no, 'export --no-scripts failed');
    if (JSON.parse(no.stdout).data?.scriptsIncluded !== false) {
      throw new Error('--no-scripts export must report scriptsIncluded=false');
    }
    const noData = JSON.parse(readFileSync(noScriptsFile, 'utf-8'));
    const leaked = (noData.suites ?? []).filter(
      (s: { tests?: unknown[] }) => Array.isArray(s.tests) && s.tests.length > 0
    );
    if (leaked.length > 0) {
      throw new Error(
        `--no-scripts must not inline tests, found ${leaked.length} suite(s) with tests`
      );
    }
    console.log('      - --no-scripts produced script-free suites ✓');

    // 3. Legacy --include-scripts still accepted (no-op, back-compat).
    const legacy = await runCLI(['export', '-f', legacyFile, '--include-scripts', '--json']);
    assertSuccess(legacy, 'legacy --include-scripts flag should still be accepted');
    console.log('      - legacy --include-scripts accepted (no-op) ✓');
  } finally {
    for (const f of [defaultFile, noScriptsFile, legacyFile]) {
      if (existsSync(f)) unlinkSync(f);
    }
  }
}

/**
 * E2E (the actual proof for Gap 3): export → delete → apply the exported
 * resource back. This exercises apply's *create* path with the bundle-local
 * surrogate `id` present in the file. If the `id` leaked into the backend
 * create payload it would 400; a clean re-create proves it is stripped at
 * the normalize chokepoint. Scoped to a minimal {monitors,alert_channels}
 * file so the shared test backend isn't mass-mutated.
 */
export async function testExportApplyRoundTrip() {
  const timestamp = Date.now();
  const fullExportFile = join(process.cwd(), `e2e-roundtrip-full-${timestamp}.json`);
  const minimalFile = join(process.cwd(), `e2e-roundtrip-min-${timestamp}.json`);
  const monitorName = `E2E-RoundTrip-Monitor-${timestamp}`;
  const channelName = `e2e-roundtrip-ch-${timestamp}`;

  const extractList = (raw: string): Array<Record<string, unknown>> => {
    const p = JSON.parse(raw);
    const v = p?.data ?? p;
    if (Array.isArray(v)) return v; // alert-channel list: data is the array
    if (Array.isArray(v?.items)) return v.items; // monitor list: data.items
    if (Array.isArray(v?.monitors)) return v.monitors;
    if (Array.isArray(v?.alert_channels)) return v.alert_channels;
    return [];
  };
  const deleteAllByName = async (kind: 'monitor' | 'alert-channel', name: string) => {
    try {
      const list = await runCLI([kind, 'list', '--json']);
      for (const r of extractList(list.stdout)) {
        if (r.name === name && typeof r.id === 'string') {
          await runCLI([kind, 'delete', String(r.id), '-y', '--json']);
        }
      }
    } catch {
      /* best-effort cleanup */
    }
  };

  try {
    // Seed a monitor + an alert channel (the two id-bearing, ref-bearing types).
    await runCLI([
      'monitor',
      'create',
      '--name',
      monitorName,
      '--url',
      'https://example.com/roundtrip',
      '--interval',
      '*/10 * * * *',
      '--json',
    ]);
    await runCLI([
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

    // Export, then carve out just our two resources (still carrying `id`).
    const exportResult = await runCLI(['export', '-f', fullExportFile, '--json']);
    assertSuccess(exportResult, 'round-trip export failed');
    const exported = JSON.parse(readFileSync(fullExportFile, 'utf-8'));
    const m = (exported.monitors ?? []).find((x: ResourcePreview) => x.name === monitorName);
    const c = (exported.alert_channels ?? []).find((x: ResourcePreview) => x.name === channelName);
    if (!m || typeof (m as { id?: unknown }).id !== 'string') {
      throw new Error('Round-trip export missing monitor or its surrogate id');
    }
    if (!c || typeof (c as { id?: unknown }).id !== 'string') {
      throw new Error('Round-trip export missing alert channel or its surrogate id');
    }
    writeFileSync(minimalFile, JSON.stringify({ monitors: [m], alert_channels: [c] }, null, 2));

    // Delete the originals so apply must take the CREATE path.
    await deleteAllByName('monitor', monitorName);
    await deleteAllByName('alert-channel', channelName);

    // Apply the file that still contains the surrogate `id`s.
    const applyResult = await runCLI(['apply', minimalFile, '--json']);
    assertSuccess(applyResult, 'round-trip apply failed — surrogate id may have leaked to backend');
    const summary = JSON.parse(applyResult.stdout).data?.summary;
    if (!summary) {
      throw new Error('apply did not return a summary');
    }
    if (summary.monitors.errors > 0 || summary.alertChannels.errors > 0) {
      throw new Error(
        `Round-trip apply errored (id leaked into create?): ${JSON.stringify({
          monitors: summary.monitors,
          alertChannels: summary.alertChannels,
        })}`
      );
    }
    if (summary.monitors.created < 1 || summary.alertChannels.created < 1) {
      throw new Error(
        `Round-trip apply should re-create the deleted resources: ${JSON.stringify({
          monitors: summary.monitors,
          alertChannels: summary.alertChannels,
        })}`
      );
    }
    console.log('      - export → delete → apply re-creates cleanly (no id leak) ✓');
  } finally {
    for (const f of [fullExportFile, minimalFile]) {
      if (existsSync(f)) unlinkSync(f);
    }
    console.log('      - [Cleanup] Removing round-trip test resources...');
    await deleteAllByName('monitor', monitorName);
    await deleteAllByName('alert-channel', channelName);
  }
}
