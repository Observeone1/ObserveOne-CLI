import { runCLI, assertSuccess, assertContains, assertJSON } from '../../lib/test-runner.js';
import { cleanupStatusPageAndMonitor, createStatusPageWithMonitor } from './status-page-helpers.js';

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
    const fixture = await createStatusPageWithMonitor({
      pageName,
      slug,
      monitorName,
      monitorUrl: `https://example.com/e2e-sp-${timestamp}`,
    });
    pageId = fixture.pageId;
    monitorId = fixture.monitorId;

    const removeResult = await runCLI([
      'status-page',
      'remove-monitor',
      pageId.toString(),
      fixture.entryId.toString(),
      '--json',
    ]);
    assertSuccess(removeResult, 'status-page remove-monitor failed');
    assertJSON(removeResult.stdout, 'remove-monitor output should be JSON');
  } finally {
    await cleanupStatusPageAndMonitor(pageId, monitorId);
    pageId = undefined;
    monitorId = undefined;
  }
}
