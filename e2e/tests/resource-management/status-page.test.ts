import { runCLI, assertSuccess, assertContains, assertJSON } from '../../lib/test-runner.js';

export async function testStatusPageLifecycle() {
  const timestamp = Date.now();
  const pageName = `E2E Status ${timestamp}`;
  const slug = `e2e-status-${timestamp}`;
  let pageId: number | undefined;

  try {
    console.log('      - Creating status page...');
    const createResult = await runCLI([
      'status-page',
      'create',
      '--name',
      pageName,
      '--slug',
      slug,
      '--json',
    ]);
    assertSuccess(createResult, 'Status page creation failed');
    assertJSON(createResult.stdout, 'Create output should be JSON');
    const createdPage = JSON.parse(createResult.stdout);
    pageId = createdPage.id || createdPage.data?.id;

    console.log('      - Listing status pages...');
    const listResult = await runCLI(['status-page', 'list', '--json']);
    assertSuccess(listResult, 'Status page list failed');
    assertContains(listResult.stdout, slug);

    console.log(`      - Getting status page ${pageId}...`);
    const getResult = await runCLI(['status-page', 'get', pageId!.toString(), '--json']);
    assertSuccess(getResult, 'Status page get failed');

    console.log(`      - Updating status page ${pageId}...`);
    const updateResult = await runCLI([
      'status-page',
      'update',
      pageId!.toString(),
      '--name',
      pageName,
      '--slug',
      slug,
      '--description',
      'Updated via E2E',
      '--json',
    ]);
    assertSuccess(updateResult, 'Status page update failed');

    console.log(`      - Deleting status page ${pageId}...`);
    const deleteResult = await runCLI([
      'status-page',
      'delete',
      pageId!.toString(),
      '-y',
      '--json',
    ]);
    assertSuccess(deleteResult, 'Status page delete failed');
    pageId = undefined;
  } finally {
    if (pageId) {
      console.log(`      - [Cleanup] Deleting dangling status page ${pageId}...`);
      await runCLI(['status-page', 'delete', pageId.toString(), '-y', '--json']);
    }
  }
}

export async function testStatusPageAddRemoveMonitor() {
  const timestamp = Date.now();
  const pageName = `E2E Status Monitor ${timestamp}`;
  const slug = `e2e-sp-mon-${timestamp}`;
  const monitorName = `E2E-SP-Monitor-${timestamp}`;
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
      `https://example.com/e2e-sp-${timestamp}`,
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
    assertJSON(addResult.stdout, 'add-monitor output should be JSON');
    const addData = JSON.parse(addResult.stdout) as {
      id?: number;
      data?: { id?: number; status_page_monitor?: { id?: number } };
    };
    const entryId = addData.data?.status_page_monitor?.id ?? addData.data?.id ?? addData.id;
    if (!entryId)
      throw new Error(`Expected entry id in add-monitor response, got: ${addResult.stdout}`);

    const removeResult = await runCLI([
      'status-page',
      'remove-monitor',
      pageId.toString(),
      entryId.toString(),
      '--json',
    ]);
    assertSuccess(removeResult, 'status-page remove-monitor failed');
    assertJSON(removeResult.stdout, 'remove-monitor output should be JSON');
  } finally {
    if (monitorId) {
      await runCLI(['url-monitor', 'delete', monitorId.toString(), '-y', '--json']);
    }
    if (pageId) {
      await runCLI(['status-page', 'delete', pageId.toString(), '-y', '--json']);
    }
  }
}
