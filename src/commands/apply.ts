import { Command } from 'commander';
import { IConfigService } from '../interfaces/config.interface.js';
import { IApiClient } from '../interfaces/api-client.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';
import { readFileSync, existsSync } from 'node:fs';
import ora, { Ora } from 'ora';
import {
  deepEqual,
  normalizeResource,
  diffObjects,
  fieldChanged,
  FieldDiff,
} from '../utils/deep-equal.js';
import {
  UrlMonitor,
  ApiCheck,
  Heartbeat,
  AlertChannel,
  StatusPage,
  Suite,
} from '../types/index.js';
import { ApplyConfig, normalizeApplyConfig } from '../utils/apply-config.js';

// Resources returned by the GET endpoints carry alert channels as a
// populated `channels` array; the create/update wire format expects
// `channel_ids` (array of numeric IDs). Normalize both sides to
// channel_ids for diff + update payloads. Input is `unknown` because
// the local-config and backend-response types declare different
// subsets of these fields (backend returns `channels`, local config
// uses `channel_ids`); we narrow at runtime.
const extractChannelIds = (r: unknown): string[] => {
  if (typeof r !== 'object' || r === null) return [];
  const obj = r as { channels?: unknown; channel_ids?: unknown };
  if (Array.isArray(obj.channels) && obj.channels.length > 0) {
    return obj.channels
      .filter(
        (c): c is { id: string } =>
          typeof c === 'object' && c !== null && typeof (c as { id?: unknown }).id === 'string'
      )
      .map((c) => c.id)
      .sort((a, b) => a.localeCompare(b));
  }
  if (Array.isArray(obj.channel_ids)) {
    return obj.channel_ids
      .filter((id): id is string => typeof id === 'string')
      .sort((a, b) => a.localeCompare(b));
  }
  return [];
};

// GET responses include DB-owned fields (id, created_at, api_check_id)
// on assertions; for diff purposes, compare only the authored shape.
// Accepts both local-config (`path?: string | undefined`) and backend
// (`path?: string | null`) shapes — both coerce to optional `path`.
type AssertionInput = {
  type: string;
  operator: string;
  path?: string | null | undefined;
  value: string;
};
const normalizeAssertions = (
  assertions: ReadonlyArray<AssertionInput> | undefined
): Array<{ type: string; operator: string; path?: string; value: string }> => {
  if (!Array.isArray(assertions)) return [];
  return assertions.map((a) => {
    const out: { type: string; operator: string; path?: string; value: string } = {
      type: a.type,
      operator: a.operator,
      value: a.value,
    };
    if (a.path !== null && a.path !== undefined) out.path = a.path;
    return out;
  });
};

const chunkArray = <T>(arr: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function extractApiError(err: unknown): string {
  const errorObj = err as {
    response?: { data?: { error?: string; message?: string } };
    message?: string;
  };
  return (
    errorObj.response?.data?.error ||
    errorObj.response?.data?.message ||
    errorObj.message ||
    'Unknown error'
  );
}

interface ApplyCtx {
  summary: ApplySummary;
  errors: string[];
  renameWarnings: string[];
  dryRunEntries: DryRunEntry[];
  isDryRun: boolean;
  logProgress: (msg: string) => void;
}

async function applyUrlMonitorItem(
  ctx: ApplyCtx,
  apiClient: IApiClient,
  monitorConfig: NonNullable<ApplyConfig['monitors']>[number],
  existingByName: Map<string, UrlMonitor>
): Promise<void> {
  const { summary, errors, renameWarnings, dryRunEntries, isDryRun, logProgress } = ctx;
  try {
    if (!monitorConfig.name || !monitorConfig.url) {
      throw new Error("Monitor must have 'name' and 'url'");
    }

    const existing = existingByName.get(monitorConfig.name);
    if (existing) {
      const localChannelIds = extractChannelIds(monitorConfig);
      const remoteChannelIds = extractChannelIds(existing);
      const remoteInterval = existing.interval;
      const remoteAlertOnFailure = existing.alert_on_failure ?? true;
      const normalizedLocal = normalizeResource(
        {
          name: monitorConfig.name,
          description: monitorConfig.description ?? '',
          url: monitorConfig.url,
          timeout_ms: monitorConfig.timeout_ms || 30000,
          interval: fieldChanged(monitorConfig.interval, remoteInterval)
            ? monitorConfig.interval
            : remoteInterval,
          alert_on_failure: fieldChanged(monitorConfig.alert_on_failure, remoteAlertOnFailure)
            ? monitorConfig.alert_on_failure
            : remoteAlertOnFailure,
          channel_ids: localChannelIds,
        },
        { timeout_ms: 30000, alert_on_failure: true, description: '' }
      );
      const normalizedRemote = normalizeResource(
        {
          name: existing.name,
          description: existing.description ?? '',
          url: existing.url,
          timeout_ms: existing.timeout_ms || 30000,
          interval: existing.interval,
          alert_on_failure: existing.alert_on_failure ?? true,
          channel_ids: remoteChannelIds,
        },
        { timeout_ms: 30000, alert_on_failure: true, description: '' }
      );

      if (deepEqual(normalizedLocal, normalizedRemote)) {
        logProgress(`Monitor unchanged: ${monitorConfig.name}`);
        summary.monitors.unchanged++;
        return;
      }

      summary.monitors.updated++;
      if (isDryRun) {
        dryRunEntries.push({
          type: 'update',
          resource: 'monitor',
          name: monitorConfig.name,
          diff: diffObjects(normalizedRemote, normalizedLocal),
        });
        return;
      }
      logProgress(`Updating monitor: ${monitorConfig.name}`);
      await apiClient.updateUrlMonitor(existing.id, {
        name: monitorConfig.name || existing.name,
        description: monitorConfig.description ?? existing.description ?? '',
        url: monitorConfig.url || existing.url,
        timeout_ms: monitorConfig.timeout_ms || existing.timeout_ms || 30000,
        interval: monitorConfig.interval || existing.interval,
        alert_on_failure: monitorConfig.alert_on_failure ?? existing.alert_on_failure ?? true,
        channel_ids: localChannelIds,
      });
      return;
    }

    summary.monitors.created++;
    const w = likelyRenameWarning('monitor', monitorConfig.name, Array.from(existingByName.keys()));
    if (w) renameWarnings.push(w);
    if (isDryRun) {
      dryRunEntries.push({ type: 'create', resource: 'monitor', name: monitorConfig.name });
      return;
    }
    logProgress(`Creating monitor: ${monitorConfig.name}`);
    await apiClient.createUrlMonitor({
      ...monitorConfig,
      timeout_ms: monitorConfig.timeout_ms || 30000,
    });
  } catch (err: unknown) {
    errors.push(`Monitor '${monitorConfig.name || 'unknown'}': ${extractApiError(err)}`);
    summary.monitors.errors++;
  }
}

async function applyApiCheckItem(
  ctx: ApplyCtx,
  apiClient: IApiClient,
  checkConfig: NonNullable<ApplyConfig['api_checks']>[number],
  existingByName: Map<string, ApiCheck>
): Promise<void> {
  const { summary, errors, renameWarnings, dryRunEntries, isDryRun, logProgress } = ctx;
  try {
    if (!checkConfig.name || !checkConfig.url) {
      throw new Error("API check must have 'name' and 'url'");
    }

    const existing = existingByName.get(checkConfig.name);
    if (existing) {
      const localChannelIds = extractChannelIds(checkConfig);
      const remoteChannelIds = extractChannelIds(existing);
      const localAssertions = normalizeAssertions(checkConfig.assertions);
      const remoteAssertions = normalizeAssertions(existing.assertions);
      const normalizedLocal = normalizeResource(
        {
          name: checkConfig.name,
          description: checkConfig.description ?? '',
          url: checkConfig.url,
          method: checkConfig.method?.toUpperCase() || 'GET',
          headers: checkConfig.headers ?? {},
          body: checkConfig.body ?? '',
          cron_expression:
            checkConfig.cron_expression ?? (checkConfig as { interval?: string }).interval ?? null,
          timeout_ms: checkConfig.timeout_ms || 30000,
          alert_on_failure: checkConfig.alert_on_failure ?? existing.alert_on_failure ?? true,
          channel_ids: localChannelIds,
          assertions: localAssertions,
        },
        { timeout_ms: 30000, alert_on_failure: true, method: 'GET', description: '', body: '' }
      );
      const normalizedRemote = normalizeResource(
        {
          name: existing.name,
          description: existing.description ?? '',
          url: existing.url,
          method: existing.method?.toUpperCase() || 'GET',
          headers: existing.headers ?? {},
          body: existing.body ?? '',
          cron_expression:
            existing.cron_expression ?? (existing as { interval?: string }).interval ?? null,
          timeout_ms: existing.timeout_ms || 30000,
          alert_on_failure: existing.alert_on_failure ?? true,
          channel_ids: remoteChannelIds,
          assertions: remoteAssertions,
        },
        { timeout_ms: 30000, alert_on_failure: true, method: 'GET', description: '', body: '' }
      );

      if (deepEqual(normalizedLocal, normalizedRemote)) {
        logProgress(`API check unchanged: ${checkConfig.name}`);
        summary.apiChecks.unchanged++;
        return;
      }

      summary.apiChecks.updated++;
      if (isDryRun) {
        dryRunEntries.push({
          type: 'update',
          resource: 'api-check',
          name: checkConfig.name,
          diff: diffObjects(normalizedRemote, normalizedLocal),
        });
        return;
      }
      logProgress(`Updating API check: ${checkConfig.name}`);
      const effectiveBody = checkConfig.body ?? existing.body;
      const effectiveCron =
        checkConfig.cron_expression ??
        (checkConfig as { interval?: string }).interval ??
        existing.cron_expression;
      await apiClient.updateApiCheck(existing.id, {
        name: checkConfig.name || existing.name,
        description: checkConfig.description ?? existing.description ?? '',
        url: checkConfig.url || existing.url,
        method: checkConfig.method?.toUpperCase() || existing.method || 'GET',
        headers: checkConfig.headers ?? existing.headers,
        ...(effectiveBody !== null && effectiveBody !== undefined && { body: effectiveBody }),
        ...(effectiveCron !== null &&
          effectiveCron !== undefined && { cron_expression: effectiveCron }),
        timeout_ms: checkConfig.timeout_ms || existing.timeout_ms || 30000,
        alert_on_failure: checkConfig.alert_on_failure ?? existing.alert_on_failure ?? true,
        channel_ids: localChannelIds,
        assertions: checkConfig.assertions ?? existing.assertions,
      });
      return;
    }

    summary.apiChecks.created++;
    const w = likelyRenameWarning('API check', checkConfig.name, Array.from(existingByName.keys()));
    if (w) renameWarnings.push(w);
    if (isDryRun) {
      dryRunEntries.push({ type: 'create', resource: 'api-check', name: checkConfig.name });
      return;
    }
    logProgress(`Creating API check: ${checkConfig.name}`);
    await apiClient.createApiCheck({
      ...checkConfig,
      timeout_ms: checkConfig.timeout_ms || 30000,
      method: checkConfig.method?.toUpperCase() || 'GET',
    });
  } catch (err: unknown) {
    errors.push(`API Check '${checkConfig.name || 'unknown'}': ${extractApiError(err)}`);
    summary.apiChecks.errors++;
  }
}

async function processUrlMonitors(
  ctx: ApplyCtx,
  apiClient: IApiClient,
  monitors: NonNullable<ApplyConfig['monitors']>,
  delayMs: number
): Promise<void> {
  const { logProgress } = ctx;
  logProgress('Fetching existing monitors...');
  const existingMonitors = await apiClient.getUrlMonitors();
  const hydratedMonitors = await Promise.all(
    existingMonitors.map((m) =>
      apiClient
        .getUrlMonitor(m.id)
        .then((detail) => ({ ...m, ...(detail as Partial<UrlMonitor>) }))
        .catch(() => m)
    )
  );
  const existingByName = new Map<string, UrlMonitor>(hydratedMonitors.map((m) => [m.name, m]));

  const chunks = chunkArray(monitors, 5);
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    await Promise.all(
      chunk.map((monitorConfig) =>
        applyUrlMonitorItem(ctx, apiClient, monitorConfig, existingByName)
      )
    );
    if (i < chunks.length - 1) await delay(delayMs);
  }
}

async function processApiChecks(
  ctx: ApplyCtx,
  apiClient: IApiClient,
  apiChecks: NonNullable<ApplyConfig['api_checks']>,
  delayMs: number
): Promise<void> {
  const { logProgress } = ctx;
  logProgress('Fetching existing API checks...');
  const existingChecks = await apiClient.getApiChecks();
  const hydratedChecks = await Promise.all(
    existingChecks.map((c) =>
      apiClient
        .getApiCheck(c.id)
        .then((resp) => {
          const nested = (resp as { apiCheck?: ApiCheck }).apiCheck;
          return nested ? { ...c, ...nested } : { ...c, ...(resp as Partial<ApiCheck>) };
        })
        .catch(() => c)
    )
  );
  const existingByName = new Map<string, ApiCheck>(hydratedChecks.map((c) => [c.name, c]));

  const chunks = chunkArray(apiChecks, 5);
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    await Promise.all(
      chunk.map((checkConfig) => applyApiCheckItem(ctx, apiClient, checkConfig, existingByName))
    );
    if (i < chunks.length - 1) await delay(delayMs);
  }
}

async function applyAlertChannelItem(
  ctx: ApplyCtx,
  apiClient: IApiClient,
  chConfig: NonNullable<ApplyConfig['alert_channels']>[number],
  existingByName: Map<string, AlertChannel>
): Promise<void> {
  const { summary, errors, renameWarnings, dryRunEntries, isDryRun, logProgress } = ctx;
  try {
    if (!chConfig.name || !chConfig.type)
      throw new Error("Alert channel must have 'name' and 'type'");
    const existing = existingByName.get(chConfig.name);
    if (existing) {
      const normalizedLocal = normalizeResource(
        { name: chConfig.name, type: chConfig.type, config: chConfig.config ?? {} },
        {}
      );
      const normalizedRemote = normalizeResource(
        { name: existing.name, type: existing.type, config: existing.config ?? {} },
        {}
      );
      if (deepEqual(normalizedLocal, normalizedRemote)) {
        logProgress(`Alert channel unchanged: ${chConfig.name}`);
        summary.alertChannels.unchanged++;
        return;
      }
      summary.alertChannels.updated++;
      if (isDryRun) {
        dryRunEntries.push({
          type: 'update',
          resource: 'alert-channel',
          name: chConfig.name,
          diff: diffObjects(normalizedRemote, normalizedLocal),
        });
        return;
      }
      logProgress(`Updating alert channel: ${chConfig.name}`);
      await apiClient.updateAlertChannel(existing.id, chConfig);
      return;
    }
    summary.alertChannels.created++;
    const w = likelyRenameWarning(
      'alert channel',
      chConfig.name,
      Array.from(existingByName.keys())
    );
    if (w) renameWarnings.push(w);
    if (isDryRun) {
      dryRunEntries.push({ type: 'create', resource: 'alert-channel', name: chConfig.name });
      return;
    }
    logProgress(`Creating alert channel: ${chConfig.name}`);
    await apiClient.createAlertChannel(chConfig);
  } catch (err: unknown) {
    errors.push(`Alert channel '${chConfig.name || 'unknown'}': ${extractApiError(err)}`);
    summary.alertChannels.errors++;
  }
}

async function processAlertChannels(
  ctx: ApplyCtx,
  apiClient: IApiClient,
  channels: NonNullable<ApplyConfig['alert_channels']>,
  delayMs: number
): Promise<void> {
  const { logProgress } = ctx;
  logProgress('Fetching existing alert channels...');
  const existingChannels = await apiClient.getAlertChannels();
  const existingByName = new Map<string, AlertChannel>(existingChannels.map((ch) => [ch.name, ch]));
  const chunks = chunkArray(channels, 5);
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    await Promise.all(
      chunk.map((chConfig) => applyAlertChannelItem(ctx, apiClient, chConfig, existingByName))
    );
    if (i < chunks.length - 1) await delay(delayMs);
  }
}

async function applyStatusPageItem(
  ctx: ApplyCtx,
  apiClient: IApiClient,
  spConfig: NonNullable<ApplyConfig['status_pages']>[number],
  existingBySlug: Map<string, StatusPage>
): Promise<void> {
  const { summary, errors, renameWarnings, dryRunEntries, isDryRun, logProgress } = ctx;
  try {
    if (!spConfig.slug || !spConfig.name) {
      throw new Error("Status page must have 'slug' and 'name'");
    }
    const existing = existingBySlug.get(spConfig.slug);
    if (existing) {
      const normalizedLocal = normalizeResource(
        {
          slug: spConfig.slug,
          name: spConfig.name,
          description: spConfig.description ?? existing.description ?? '',
          is_public: spConfig.is_public ?? existing.is_public ?? true,
          show_incident_history:
            spConfig.show_incident_history ?? existing.show_incident_history ?? true,
          show_uptime_percentage:
            spConfig.show_uptime_percentage ?? existing.show_uptime_percentage ?? true,
        },
        {
          description: '',
          is_public: true,
          show_incident_history: true,
          show_uptime_percentage: true,
        }
      );
      const normalizedRemote = normalizeResource(
        {
          slug: existing.slug,
          name: existing.name,
          description: existing.description ?? '',
          is_public: existing.is_public ?? true,
          show_incident_history: existing.show_incident_history ?? true,
          show_uptime_percentage: existing.show_uptime_percentage ?? true,
        },
        {
          description: '',
          is_public: true,
          show_incident_history: true,
          show_uptime_percentage: true,
        }
      );
      if (deepEqual(normalizedLocal, normalizedRemote)) {
        logProgress(`Status page unchanged: ${spConfig.slug}`);
        summary.statusPages.unchanged++;
        return;
      }
      summary.statusPages.updated++;
      if (isDryRun) {
        dryRunEntries.push({
          type: 'update',
          resource: 'status-page',
          name: spConfig.slug,
          diff: diffObjects(normalizedRemote, normalizedLocal),
        });
        return;
      }
      logProgress(`Updating status page: ${spConfig.slug}`);
      await apiClient.updateStatusPage(existing.id, spConfig);
      return;
    }
    summary.statusPages.created++;
    const w = likelyRenameWarning('status page', spConfig.slug, Array.from(existingBySlug.keys()));
    if (w) renameWarnings.push(w);
    if (isDryRun) {
      dryRunEntries.push({ type: 'create', resource: 'status-page', name: spConfig.slug });
      return;
    }
    logProgress(`Creating status page: ${spConfig.slug}`);
    await apiClient.createStatusPage(spConfig);
  } catch (err: unknown) {
    errors.push(`Status page '${spConfig.slug || 'unknown'}': ${extractApiError(err)}`);
    summary.statusPages.errors++;
  }
}

async function processStatusPages(
  ctx: ApplyCtx,
  apiClient: IApiClient,
  pages: NonNullable<ApplyConfig['status_pages']>,
  delayMs: number
): Promise<void> {
  const { logProgress } = ctx;
  logProgress('Fetching existing status pages...');
  const existingPages = await apiClient.getStatusPages();
  const existingBySlug = new Map<string, StatusPage>(existingPages.map((sp) => [sp.slug, sp]));

  const chunks = chunkArray(pages, 5);
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    await Promise.all(
      chunk.map((spConfig) => applyStatusPageItem(ctx, apiClient, spConfig, existingBySlug))
    );
    if (i < chunks.length - 1) await delay(delayMs);
  }
}

async function applySuiteItem(
  ctx: ApplyCtx,
  apiClient: IApiClient,
  outputService: IOutputService,
  suiteConfig: NonNullable<ApplyConfig['suites']>[number],
  existingByName: Map<string, Suite>
): Promise<void> {
  const { summary, errors, dryRunEntries, isDryRun, logProgress } = ctx;
  try {
    if (!suiteConfig.suite_name || !suiteConfig.target_url) {
      throw new Error("Suite must have 'suite_name' and 'target_url'");
    }
    const existing = existingByName.get(suiteConfig.suite_name);
    if (existing) {
      const localInstructions =
        suiteConfig.planner_instructions ?? existing.planner_instructions ?? null;
      const normalizedLocal = normalizeResource(
        {
          suite_name: suiteConfig.suite_name,
          target_url: suiteConfig.target_url,
          cron_expression: suiteConfig.cron_expression ?? '',
          schedule_active: suiteConfig.schedule_active ?? false,
          is_public: suiteConfig.is_public ?? false,
          allow_form_submit: suiteConfig.allow_form_submit ?? false,
          planner_instructions: localInstructions,
        },
        {
          cron_expression: '',
          schedule_active: false,
          is_public: false,
          allow_form_submit: false,
          planner_instructions: null,
        }
      );
      const normalizedRemote = normalizeResource(
        {
          suite_name: existing.suite_name,
          target_url: existing.target_url,
          cron_expression: existing.cron_expression ?? '',
          schedule_active: existing.schedule_active ?? false,
          is_public: existing.is_public ?? false,
          allow_form_submit: existing.allow_form_submit ?? false,
          planner_instructions: existing.planner_instructions ?? null,
        },
        {
          cron_expression: '',
          schedule_active: false,
          is_public: false,
          allow_form_submit: false,
          planner_instructions: null,
        }
      );
      if (deepEqual(normalizedLocal, normalizedRemote)) {
        logProgress(`Suite unchanged: ${suiteConfig.suite_name}`);
        summary.suites.unchanged++;
        return;
      }
      summary.suites.updated++;
      if (isDryRun) {
        dryRunEntries.push({
          type: 'update',
          resource: 'suite',
          name: suiteConfig.suite_name,
          diff: diffObjects(normalizedRemote, normalizedLocal),
        });
        return;
      }
      logProgress(`Updating suite: ${suiteConfig.suite_name}`);
      await apiClient.updateSuite(existing.id, {
        suite_name: suiteConfig.suite_name,
        target_url: suiteConfig.target_url,
        planner_instructions: localInstructions,
      });
      return;
    }
    outputService.warning(
      `Suite '${suiteConfig.suite_name}' not found. Suites must be created via \`obs suite generate\` — skipping.`
    );
    summary.suites.errors++;
  } catch (err: unknown) {
    errors.push(`Suite '${suiteConfig.suite_name || 'unknown'}': ${extractApiError(err)}`);
    summary.suites.errors++;
  }
}

async function processSuites(
  ctx: ApplyCtx,
  apiClient: IApiClient,
  outputService: IOutputService,
  suites: NonNullable<ApplyConfig['suites']>,
  delayMs: number
): Promise<void> {
  const { logProgress } = ctx;
  logProgress('Fetching existing suites...');
  const existingSuites = await apiClient.listSuites();
  const existingByName = new Map<string, Suite>(existingSuites.map((s) => [s.suite_name, s]));

  const chunks = chunkArray(suites, 5);
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    await Promise.all(
      chunk.map((suiteConfig) =>
        applySuiteItem(ctx, apiClient, outputService, suiteConfig, existingByName)
      )
    );
    if (i < chunks.length - 1) await delay(delayMs);
  }
}

async function applyHeartbeatItem(
  ctx: ApplyCtx,
  apiClient: IApiClient,
  hbConfig: NonNullable<ApplyConfig['heartbeats']>[number],
  existingByName: Map<string, Heartbeat>
): Promise<void> {
  const { summary, errors, renameWarnings, dryRunEntries, isDryRun, logProgress } = ctx;
  try {
    if (!hbConfig.name || !hbConfig.period) {
      throw new Error("Heartbeat must have 'name' and 'period'");
    }

    const existing = existingByName.get(hbConfig.name);
    if (existing) {
      const normalizedLocal = normalizeResource(
        {
          name: hbConfig.name,
          period: hbConfig.period,
          grace_period: hbConfig.grace_period || 60,
        },
        { grace_period: 60 }
      );
      const normalizedRemote = normalizeResource(
        {
          name: existing.name,
          period: existing.period,
          grace_period: existing.grace_period || 60,
        },
        { grace_period: 60 }
      );

      if (deepEqual(normalizedLocal, normalizedRemote)) {
        logProgress(`Heartbeat unchanged: ${hbConfig.name}`);
        summary.heartbeats.unchanged++;
        return;
      }

      summary.heartbeats.updated++;
      if (isDryRun) {
        dryRunEntries.push({
          type: 'update',
          resource: 'heartbeat',
          name: hbConfig.name,
          diff: diffObjects(normalizedRemote, normalizedLocal),
        });
        return;
      }
      logProgress(`Updating heartbeat: ${hbConfig.name}`);
      await apiClient.updateHeartbeat(existing.id, {
        ...hbConfig,
        name: hbConfig.name || existing.name,
        period: hbConfig.period || existing.period,
        description: hbConfig.description ?? existing.description ?? '',
        grace_period: hbConfig.grace_period ?? existing.grace_period ?? 60,
      });
      return;
    }

    summary.heartbeats.created++;
    const w = likelyRenameWarning('heartbeat', hbConfig.name, Array.from(existingByName.keys()));
    if (w) renameWarnings.push(w);
    if (isDryRun) {
      dryRunEntries.push({ type: 'create', resource: 'heartbeat', name: hbConfig.name });
      return;
    }
    logProgress(`Creating heartbeat: ${hbConfig.name}`);
    await apiClient.createHeartbeat({
      ...hbConfig,
      name: hbConfig.name,
      period: hbConfig.period,
      description: hbConfig.description ?? '',
      grace_period: hbConfig.grace_period ?? 60,
    });
  } catch (err: unknown) {
    errors.push(`Heartbeat '${hbConfig.name || 'unknown'}': ${extractApiError(err)}`);
    summary.heartbeats.errors++;
  }
}

async function processHeartbeats(
  ctx: ApplyCtx,
  apiClient: IApiClient,
  heartbeats: NonNullable<ApplyConfig['heartbeats']>,
  delayMs: number
): Promise<void> {
  const { logProgress } = ctx;
  logProgress('Fetching existing heartbeats...');
  const existingHeartbeats = await apiClient.getHeartbeats();
  const existingByName = new Map<string, Heartbeat>(existingHeartbeats.map((h) => [h.name, h]));

  const chunks = chunkArray(heartbeats, 5);
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    await Promise.all(
      chunk.map((hbConfig) => applyHeartbeatItem(ctx, apiClient, hbConfig, existingByName))
    );
    if (i < chunks.length - 1) await delay(delayMs);
  }
}

/**
 * Apply matches existing resources by name/slug only, so a rename in the file
 * looks like a brand-new resource: a duplicate is created and the original is
 * orphaned (still running) with no signal. When we decide to CREATE (no match),
 * surface the existing names so a likely rename is visible. Returns null when
 * there are no existing resources of this type (nothing a rename could be).
 */
export function likelyRenameWarning(
  kind: string,
  newName: string,
  existingNames: string[]
): string | null {
  if (existingNames.length === 0) return null;
  return (
    `Creating new ${kind} "${newName}" — no existing ${kind} matched by name. ` +
    `If this is a rename, the original is left untouched (and still running). ` +
    `Existing ${kind}s: ${existingNames.join(', ')}.`
  );
}

interface ResourceSummary {
  created: number;
  updated: number;
  unchanged: number;
  errors: number;
}

interface ApplySummary {
  monitors: ResourceSummary;
  apiChecks: ResourceSummary;
  heartbeats: ResourceSummary;
  alertChannels: ResourceSummary;
  statusPages: ResourceSummary;
  suites: ResourceSummary;
}

interface DryRunEntry {
  type: 'create' | 'update';
  resource: string;
  name: string;
  diff?: Record<string, FieldDiff>;
}

function printDryRun(entries: DryRunEntry[], summary: ApplySummary): void {
  const chalk = {
    green: (s: string) => `\x1b[32m${s}\x1b[0m`,
    red: (s: string) => `\x1b[31m${s}\x1b[0m`,
    yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
    bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
    dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  };

  if (entries.length === 0) {
    console.log(chalk.dim('  No changes. Everything is up to date.'));
    return;
  }

  for (const entry of entries) {
    if (entry.type === 'create') {
      console.log(chalk.green(`+ ${entry.resource} "${entry.name}"  (new)`));
    } else {
      console.log(chalk.yellow(`~ ${entry.resource} "${entry.name}"`));
      if (entry.diff) {
        for (const [key, { from, to }] of Object.entries(entry.diff)) {
          console.log(chalk.red(`    - ${key}: ${JSON.stringify(from)}`));
          console.log(chalk.green(`    + ${key}: ${JSON.stringify(to)}`));
        }
      }
    }
    console.log('');
  }

  const totals = [
    ['Monitors', summary.monitors],
    ['API Checks', summary.apiChecks],
    ['Heartbeats', summary.heartbeats],
    ['Alert Channels', summary.alertChannels],
    ['Status Pages', summary.statusPages],
    ['Suites', summary.suites],
  ] as const;

  for (const [label, s] of totals) {
    if (s.created + s.updated + s.unchanged > 0) {
      console.log(
        `  ${label}: ${s.created} to create, ${s.updated} to update, ${s.unchanged} unchanged`
      );
    }
  }
  console.log('');
  console.log(chalk.dim('  Run without --dry-run to apply.'));
}

function resolveApplyConfigFile(
  fileArg: string | undefined,
  options: Record<string, unknown>,
  outputService: IOutputService
): string {
  let targetFile = (options.file as string) || fileArg || 'obs.json';
  if (existsSync(targetFile)) return targetFile;

  if (fileArg === 'obs.json' && existsSync('observeone.json')) {
    return 'observeone.json';
  }
  if (!options.file && !fileArg && existsSync('observeone.json')) {
    return 'observeone.json';
  }

  outputService.error(`Configuration file not found: ${targetFile}`);
  process.exit(1);
}

function loadApplyConfigFromFile(
  targetFile: string,
  spinner: Ora | null,
  outputService: IOutputService
): ApplyConfig {
  const fileContent = readFileSync(targetFile, 'utf-8');
  let rawConfig: unknown;
  try {
    rawConfig = JSON.parse(fileContent);
  } catch (e: unknown) {
    const err = e as Error;
    if (spinner) spinner.fail('Invalid JSON');
    outputService.error(`Invalid JSON in ${targetFile}: ${err.message}`);
    process.exit(1);
  }

  try {
    return normalizeApplyConfig(rawConfig);
  } catch (e: unknown) {
    const err = e as Error;
    if (spinner) spinner.fail('Invalid apply config');
    outputService.error(err.message);
    process.exit(1);
  }
}

async function applyAllResourceSections(
  ctx: ApplyCtx,
  config: ApplyConfig,
  apiClient: IApiClient,
  outputService: IOutputService,
  delayMs: number
): Promise<void> {
  if (config.monitors && Array.isArray(config.monitors)) {
    await processUrlMonitors(ctx, apiClient, config.monitors, delayMs);
  }
  if (config.api_checks && Array.isArray(config.api_checks)) {
    await processApiChecks(ctx, apiClient, config.api_checks, delayMs);
  }
  if (config.heartbeats && Array.isArray(config.heartbeats)) {
    await processHeartbeats(ctx, apiClient, config.heartbeats, delayMs);
  }
  if (config.incidents && Array.isArray(config.incidents) && config.incidents.length > 0) {
    outputService.warning(
      'Incidents are runtime state and cannot be applied. Use `obs incident create` to manage incidents directly.'
    );
  }
  if (config.alert_channels && Array.isArray(config.alert_channels)) {
    await processAlertChannels(ctx, apiClient, config.alert_channels, delayMs);
  }
  if (config.status_pages && Array.isArray(config.status_pages)) {
    await processStatusPages(ctx, apiClient, config.status_pages, delayMs);
  }
  if (config.suites && Array.isArray(config.suites)) {
    await processSuites(ctx, apiClient, outputService, config.suites, delayMs);
  }
}

function emitDryRunResult(
  isJson: boolean,
  dryRunEntries: DryRunEntry[],
  summary: ApplySummary,
  outputService: IOutputService
): void {
  if (isJson) {
    outputService.formatJsonOutput({ dry_run: true, changes: dryRunEntries, summary });
    return;
  }
  console.log('');
  printDryRun(dryRunEntries, summary);
}

function emitApplySuccessSummary(
  summary: ApplySummary,
  errors: string[],
  outputService: IOutputService
): void {
  outputService.success('Apply completed.');
  console.log('');
  console.log(
    `  Monitors:       ${summary.monitors.created} created, ${summary.monitors.updated} updated, ${summary.monitors.unchanged} unchanged`
  );
  console.log(
    `  API Checks:     ${summary.apiChecks.created} created, ${summary.apiChecks.updated} updated, ${summary.apiChecks.unchanged} unchanged`
  );
  console.log(
    `  Heartbeats:     ${summary.heartbeats.created} created, ${summary.heartbeats.updated} updated, ${summary.heartbeats.unchanged} unchanged`
  );
  console.log(
    `  Alert Channels: ${summary.alertChannels.created} created, ${summary.alertChannels.updated} updated, ${summary.alertChannels.unchanged} unchanged`
  );
  console.log(
    `  Status Pages:   ${summary.statusPages.created} created, ${summary.statusPages.updated} updated, ${summary.statusPages.unchanged} unchanged`
  );
  console.log(
    `  Suites:         ${summary.suites.created} created, ${summary.suites.updated} updated, ${summary.suites.unchanged} unchanged`
  );

  if (errors.length > 0) {
    console.log('');
    outputService.error('Some resources failed to apply:');
    errors.forEach((e) => console.log(`  - ${e}`));
    process.exit(1);
  }
}

async function runApply(
  fileArg: string | undefined,
  options: Record<string, unknown>,
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService
): Promise<void> {
  const isVerbose = process.env.OBS_VERBOSE === 'true';
  const isJson = process.env.OBS_JSON_OUTPUT === 'true' || options.json === true;
  const isDryRun = options.dryRun === true;
  if (isJson) outputService.enableJsonMode();
  let spinner: Ora | null = null;
  const logProgress = (msg: string) => {
    if (isVerbose && !isJson) outputService.progress(msg);
    else if (spinner) spinner.text = msg;
  };
  try {
    const apiKey = configService.getApiKey();
    if (!apiKey) {
      outputService.error('Not authenticated. Please run "obs login" first.');
      process.exit(1);
    }

    // Try to read the file
    const targetFile = resolveApplyConfigFile(fileArg, options, outputService);

    if (!isVerbose && !isJson) {
      spinner = ora('Applying declarative configuration...').start();
    }

    logProgress(`Reading configuration from ${targetFile}...`);
    const config = loadApplyConfigFromFile(targetFile, spinner, outputService);

    const summary: ApplySummary = {
      monitors: { created: 0, updated: 0, unchanged: 0, errors: 0 },
      apiChecks: { created: 0, updated: 0, unchanged: 0, errors: 0 },
      heartbeats: { created: 0, updated: 0, unchanged: 0, errors: 0 },
      alertChannels: { created: 0, updated: 0, unchanged: 0, errors: 0 },
      statusPages: { created: 0, updated: 0, unchanged: 0, errors: 0 },
      suites: { created: 0, updated: 0, unchanged: 0, errors: 0 },
    };

    const errors: string[] = [];
    const renameWarnings: string[] = [];
    const dryRunEntries: DryRunEntry[] = [];
    const delayMs = 1000; // 1 second between chunks to respect 100 req/min rate limit

    const ctx: ApplyCtx = {
      summary,
      errors,
      renameWarnings,
      dryRunEntries,
      isDryRun,
      logProgress,
    };

    await applyAllResourceSections(ctx, config, apiClient, outputService, delayMs);

    if (spinner) {
      spinner.stop();
    }

    // Surface likely-rename warnings on stderr only — never in the JSON
    // payload (stdout). Flushed after the spinner stops so they don't
    // interleave with ora's stderr output; covers dry-run too.
    renameWarnings.forEach((w) => console.error(w));

    if (isDryRun) {
      emitDryRunResult(isJson, dryRunEntries, summary, outputService);
      return;
    }

    if (isJson) {
      outputService.formatJsonOutput({
        summary,
        errors: errors.length > 0 ? errors : undefined,
      });
      if (errors.length > 0) {
        process.exit(1);
      }
    } else {
      emitApplySuccessSummary(summary, errors, outputService);
    }
  } catch (error: unknown) {
    if (spinner) spinner.stop();
    outputService.error(outputService.formatError(error));
    process.exit(1);
  }
}

export function createApplyCommand(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService
): Command {
  const apply = new Command('apply')
    .description(
      'Apply configuration from a JSON file. Supports obs.json with monitors, api_checks, heartbeats, alert_channels, status_pages, suites, and incidents. Also accepts wrapped ({"monitor": {...}}), explicit ({"type": "monitor", ...}), or bare single-resource files (bare form supports monitor/check/heartbeat only).'
    )
    .argument('[file]', 'Path to the JSON configuration file')
    .option('-f, --file <path>', 'Path to the JSON configuration file')
    .option('-j, --json', 'Output in JSON format')
    .option('--dry-run', 'Preview changes without applying them')
    .addHelpText(
      'after',
      `
Examples:
  $ obs apply                          # applies obs.json in current directory
  $ obs apply my-stack.json            # applies a custom file
  $ obs apply obs.json --dry-run       # preview changes without applying
  $ obs apply monitor.json --json      # machine-readable output
`
    )
    .action(async (fileArg: string | undefined, options: Record<string, unknown>) => {
      await runApply(fileArg, options, configService, apiClient, outputService);
    });

  return apply;
}
