import { runCLI, assertSuccess } from '../../lib/test-runner.js';

export interface StatusPageMonitorFixture {
  pageId: number;
  monitorId: number;
  entryId: number;
}

/** Create a status page, attach a URL monitor, and return IDs for follow-up assertions. */
export async function createStatusPageWithMonitor(opts: {
  pageName: string;
  slug: string;
  monitorName: string;
  monitorUrl: string;
}): Promise<StatusPageMonitorFixture> {
  const createPageResult = await runCLI([
    'status-page',
    'create',
    '--name',
    opts.pageName,
    '--slug',
    opts.slug,
    '--json',
  ]);
  assertSuccess(createPageResult, 'Status page creation failed');
  const createdPage = JSON.parse(createPageResult.stdout);
  const pageId = createdPage.id || createdPage.data?.id;
  if (!pageId) throw new Error('Could not extract status page ID');

  const createMonitorResult = await runCLI([
    'url-monitor',
    'create',
    '--name',
    opts.monitorName,
    '--url',
    opts.monitorUrl,
    '--interval',
    '*/10 * * * *',
    '--json',
  ]);
  assertSuccess(createMonitorResult, 'Monitor creation failed');
  const createdMonitor = JSON.parse(createMonitorResult.stdout);
  const monitorId = createdMonitor.id || createdMonitor.data?.id;
  if (!monitorId) throw new Error('Could not extract monitor ID');

  const addResult = await runCLI([
    'status-page',
    'add-monitor',
    pageId.toString(),
    monitorId.toString(),
    '--type',
    'url-monitor',
    '--name',
    opts.monitorName,
    '--json',
  ]);
  assertSuccess(addResult, 'status-page add-monitor failed');
  const addData = JSON.parse(addResult.stdout) as {
    id?: number;
    data?: { id?: number; status_page_monitor?: { id?: number } };
  };
  const entryId = addData.data?.status_page_monitor?.id ?? addData.data?.id ?? addData.id;
  if (!entryId) {
    throw new Error(`Expected entry id in add-monitor response, got: ${addResult.stdout}`);
  }

  return { pageId, monitorId, entryId };
}

export async function cleanupStatusPageAndMonitor(
  pageId?: number,
  monitorId?: number
): Promise<void> {
  if (monitorId) {
    await runCLI(['url-monitor', 'delete', monitorId.toString(), '-y', '--json']);
  }
  if (pageId) {
    await runCLI(['status-page', 'delete', pageId.toString(), '-y', '--json']);
  }
}
