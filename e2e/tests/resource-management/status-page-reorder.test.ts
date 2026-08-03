import { runCLI, assertSuccess, assertJSON } from '../../lib/test-runner.js';
import { cleanupStatusPageAndMonitor, createStatusPageWithMonitor } from './status-page-helpers.js';

export async function testStatusPageReorder() {
  const timestamp = Date.now();
  const pageName = `E2E SP Reorder ${timestamp}`;
  const slug = `e2e-sp-reorder-${timestamp}`;
  const monitorName = `E2E-SP-Reorder-Mon-${timestamp}`;
  let pageId: number | undefined;
  let monitorId: number | undefined;

  try {
    const fixture = await createStatusPageWithMonitor({
      pageName,
      slug,
      monitorName,
      monitorUrl: `https://example.com/e2e-sp-reorder-${timestamp}`,
    });
    pageId = fixture.pageId;
    monitorId = fixture.monitorId;

    console.log(`      - Reordering entry ${fixture.entryId} on status page ${pageId}...`);
    const reorderResult = await runCLI([
      'status-page',
      'reorder',
      pageId.toString(),
      fixture.entryId.toString(),
      '--order',
      '2',
      '--json',
    ]);
    assertSuccess(reorderResult, 'status-page reorder failed');
    assertJSON(reorderResult.stdout, 'reorder output should be JSON');
  } finally {
    await cleanupStatusPageAndMonitor(pageId, monitorId);
    pageId = undefined;
    monitorId = undefined;
  }
}
