import { runCLI, assertSuccess, assertJSON } from '../../lib/test-runner.js';

export async function testStatusPageReorder() {
  const timestamp = Date.now();
  const pageName = `E2E SP Reorder ${timestamp}`;
  const slug = `e2e-sp-reorder-${timestamp}`;
  const monitorName = `E2E-SP-Reorder-Mon-${timestamp}`;
  let pageId: number | undefined;
  let monitorId: number | undefined;

  try {
    const createPageResult = await runCLI([
      'status-page',
      'create',
      '--name',
      pageName,
      '--slug',
      slug,
      '--json',
    ]);
    assertSuccess(createPageResult, 'Status page creation failed');
    const createdPage = JSON.parse(createPageResult.stdout);
    pageId = createdPage.id || createdPage.data?.id;
    if (!pageId) throw new Error('Could not extract status page ID');

    const createMonitorResult = await runCLI([
      'url-monitor',
      'create',
      '--name',
      monitorName,
      '--url',
      `https://example.com/e2e-sp-reorder-${timestamp}`,
      '--interval',
      '*/10 * * * *',
      '--json',
    ]);
    assertSuccess(createMonitorResult, 'Monitor creation failed');
    const createdMonitor = JSON.parse(createMonitorResult.stdout);
    monitorId = createdMonitor.id || createdMonitor.data?.id;
    if (!monitorId) throw new Error('Could not extract monitor ID');

    const addResult = await runCLI([
      'status-page',
      'add-monitor',
      pageId.toString(),
      monitorId.toString(),
      '--type',
      'url-monitor',
      '--name',
      monitorName,
      '--json',
    ]);
    assertSuccess(addResult, 'status-page add-monitor failed');
    const addData = JSON.parse(addResult.stdout) as {
      id?: number;
      data?: { id?: number; status_page_monitor?: { id?: number } };
    };
    const entryId = addData.data?.status_page_monitor?.id ?? addData.data?.id ?? addData.id;
    if (!entryId)
      throw new Error(`Expected entry id in add-monitor response, got: ${addResult.stdout}`);

    console.log(`      - Reordering entry ${entryId} on status page ${pageId}...`);
    const reorderResult = await runCLI([
      'status-page',
      'reorder',
      pageId.toString(),
      entryId.toString(),
      '--order',
      '2',
      '--json',
    ]);
    assertSuccess(reorderResult, 'status-page reorder failed');
    assertJSON(reorderResult.stdout, 'reorder output should be JSON');
  } finally {
    if (monitorId) {
      await runCLI(['url-monitor', 'delete', monitorId.toString(), '-y', '--json']);
    }
    if (pageId) {
      await runCLI(['status-page', 'delete', pageId.toString(), '-y', '--json']);
    }
  }
}
