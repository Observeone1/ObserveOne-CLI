import { Command } from 'commander';
import { IConfigService } from '../interfaces/config.interface.js';
import { IApiClient } from '../interfaces/api-client.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';
import { readFileSync, existsSync } from 'fs';
import ora, { Ora } from 'ora';
import { deepEqual, normalizeResource, diffObjects, FieldDiff } from '../utils/deep-equal.js';
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
const extractChannelIds = (r: unknown): number[] => {
  if (typeof r !== 'object' || r === null) return [];
  const obj = r as { channels?: unknown; channel_ids?: unknown };
  if (Array.isArray(obj.channels) && obj.channels.length > 0) {
    return obj.channels
      .filter(
        (c): c is { id: number } =>
          typeof c === 'object' && c !== null && typeof (c as { id?: unknown }).id === 'number'
      )
      .map((c) => c.id)
      .sort((a, b) => a - b);
  }
  if (Array.isArray(obj.channel_ids)) {
    return obj.channel_ids
      .filter((id): id is number => typeof id === 'number')
      .sort((a, b) => a - b);
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
  aiChecks: ResourceSummary;
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
    ['AI Checks', summary.aiChecks],
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
      const isVerbose = process.env.OBS_VERBOSE === 'true';
      const isJson = process.env.OBS_JSON_OUTPUT === 'true' || options.json === true;
      const isDryRun = options.dryRun === true;

      if (isJson) {
        outputService.enableJsonMode();
      }

      let spinner: Ora | null = null;

      const logProgress = (msg: string) => {
        if (isVerbose && !isJson) {
          outputService.progress(msg);
        } else if (spinner) {
          spinner.text = msg;
        }
      };

      try {
        const apiKey = configService.getApiKey();
        if (!apiKey) {
          outputService.error('Not authenticated. Please run "obs login" first.');
          process.exit(1);
        }

        // Try to read the file
        let targetFile = (options.file as string) || fileArg || 'obs.json';
        if (!existsSync(targetFile)) {
          if (fileArg === 'obs.json' && existsSync('observeone.json')) {
            targetFile = 'observeone.json';
          } else if (!options.file && !fileArg && existsSync('observeone.json')) {
            targetFile = 'observeone.json';
          } else {
            outputService.error(`Configuration file not found: ${targetFile}`);
            process.exit(1);
          }
        }

        if (!isVerbose && !isJson) {
          spinner = ora('Applying declarative configuration...').start();
        }

        logProgress(`Reading configuration from ${targetFile}...`);
        const fileContent = readFileSync(targetFile, 'utf-8');
        let rawConfig: unknown;
        let config: ApplyConfig;
        try {
          rawConfig = JSON.parse(fileContent);
        } catch (e: unknown) {
          const err = e as Error;
          if (spinner) spinner.fail('Invalid JSON');
          outputService.error(`Invalid JSON in ${targetFile}: ${err.message}`);
          process.exit(1);
        }

        try {
          config = normalizeApplyConfig(rawConfig);
        } catch (e: unknown) {
          const err = e as Error;
          if (spinner) spinner.fail('Invalid apply config');
          outputService.error(err.message);
          process.exit(1);
        }

        const summary: ApplySummary = {
          monitors: { created: 0, updated: 0, unchanged: 0, errors: 0 },
          apiChecks: { created: 0, updated: 0, unchanged: 0, errors: 0 },
          heartbeats: { created: 0, updated: 0, unchanged: 0, errors: 0 },
          aiChecks: { created: 0, updated: 0, unchanged: 0, errors: 0 },
          alertChannels: { created: 0, updated: 0, unchanged: 0, errors: 0 },
          statusPages: { created: 0, updated: 0, unchanged: 0, errors: 0 },
          suites: { created: 0, updated: 0, unchanged: 0, errors: 0 },
        };

        const errors: string[] = [];
        const dryRunEntries: DryRunEntry[] = [];
        const delayMs = 1000; // 1 second between chunks to respect 100 req/min rate limit

        // 1. Process URL Monitors
        if (config.monitors && Array.isArray(config.monitors)) {
          logProgress('Fetching existing monitors...');
          const existingMonitors = await apiClient.getUrlMonitors();
          // Detail-hydrate so the existing map has channels populated for diff.
          const hydratedMonitors = await Promise.all(
            existingMonitors.map((m) =>
              apiClient
                .getUrlMonitor(m.id)
                .then((detail) => ({ ...m, ...(detail as Partial<UrlMonitor>) }))
                .catch(() => m)
            )
          );
          const existingByName = new Map<string, UrlMonitor>(
            hydratedMonitors.map((m) => [m.name, m])
          );

          const chunks = chunkArray(config.monitors, 5);
          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i]!;
            await Promise.all(
              chunk.map(async (monitorConfig) => {
                try {
                  if (!monitorConfig.name || !monitorConfig.url) {
                    throw new Error("Monitor must have 'name' and 'url'");
                  }

                  const existing = existingByName.get(monitorConfig.name);
                  if (existing) {
                    const localChannelIds = extractChannelIds(monitorConfig);
                    const remoteChannelIds = extractChannelIds(existing);
                    // Normalize both objects for comparison
                    const normalizedLocal = normalizeResource(
                      {
                        name: monitorConfig.name,
                        description: monitorConfig.description ?? '',
                        url: monitorConfig.url,
                        timeout_ms: monitorConfig.timeout_ms || 30000,
                        interval: monitorConfig.interval,
                        alert_on_failure: monitorConfig.alert_on_failure ?? true,
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

                    // Skip update if no changes
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
                      alert_on_failure:
                        monitorConfig.alert_on_failure ?? existing.alert_on_failure ?? true,
                      channel_ids: localChannelIds,
                    });
                  } else {
                    summary.monitors.created++;
                    if (isDryRun) {
                      dryRunEntries.push({
                        type: 'create',
                        resource: 'monitor',
                        name: monitorConfig.name!,
                      });
                      return;
                    }
                    logProgress(`Creating monitor: ${monitorConfig.name}`);
                    await apiClient.createUrlMonitor({
                      ...monitorConfig,
                      timeout_ms: monitorConfig.timeout_ms || 30000,
                    });
                  }
                } catch (err: unknown) {
                  const errorObj = err as {
                    response?: { data?: { error?: string; message?: string } };
                    message?: string;
                  };
                  const details =
                    errorObj.response?.data?.error ||
                    errorObj.response?.data?.message ||
                    errorObj.message;
                  errors.push(`Monitor '${monitorConfig.name || 'unknown'}': ${details}`);
                  summary.monitors.errors++;
                }
              })
            );
            if (i < chunks.length - 1) await delay(delayMs);
          }
        }

        // 2. Process API Checks
        if (config.api_checks && Array.isArray(config.api_checks)) {
          logProgress('Fetching existing API checks...');
          const existingChecks = await apiClient.getApiChecks();
          // Detail-hydrate for channel_ids (list omits the channels join).
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

          const chunks = chunkArray(config.api_checks, 5);
          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i]!;
            await Promise.all(
              chunk.map(async (checkConfig) => {
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
                    // Normalize both objects for comparison
                    const normalizedLocal = normalizeResource(
                      {
                        name: checkConfig.name,
                        description: checkConfig.description ?? '',
                        url: checkConfig.url,
                        method: checkConfig.method?.toUpperCase() || 'GET',
                        headers: checkConfig.headers ?? {},
                        body: checkConfig.body ?? '',
                        cron_expression:
                          checkConfig.cron_expression ??
                          (checkConfig as { interval?: string }).interval ??
                          null,
                        timeout_ms: checkConfig.timeout_ms || 30000,
                        alert_on_failure:
                          checkConfig.alert_on_failure ?? existing.alert_on_failure ?? true,
                        channel_ids: localChannelIds,
                        assertions: localAssertions,
                      },
                      {
                        timeout_ms: 30000,
                        alert_on_failure: true,
                        method: 'GET',
                        description: '',
                        body: '',
                      }
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
                          existing.cron_expression ??
                          (existing as { interval?: string }).interval ??
                          null,
                        timeout_ms: existing.timeout_ms || 30000,
                        alert_on_failure: existing.alert_on_failure ?? true,
                        channel_ids: remoteChannelIds,
                        assertions: remoteAssertions,
                      },
                      {
                        timeout_ms: 30000,
                        alert_on_failure: true,
                        method: 'GET',
                        description: '',
                        body: '',
                      }
                    );

                    // Skip update if no changes
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
                      // Backend zod rejects null for body/cron_expression;
                      // omit when the value would be null so the schema's
                      // optional/nullable rules accept the payload.
                      ...(effectiveBody !== null &&
                        effectiveBody !== undefined && { body: effectiveBody }),
                      ...(effectiveCron !== null &&
                        effectiveCron !== undefined && { cron_expression: effectiveCron }),
                      timeout_ms: checkConfig.timeout_ms || existing.timeout_ms || 30000,
                      alert_on_failure:
                        checkConfig.alert_on_failure ?? existing.alert_on_failure ?? true,
                      channel_ids: localChannelIds,
                      assertions: checkConfig.assertions ?? existing.assertions,
                    });
                  } else {
                    summary.apiChecks.created++;
                    if (isDryRun) {
                      dryRunEntries.push({
                        type: 'create',
                        resource: 'api-check',
                        name: checkConfig.name!,
                      });
                      return;
                    }
                    logProgress(`Creating API check: ${checkConfig.name}`);
                    await apiClient.createApiCheck({
                      ...checkConfig,
                      timeout_ms: checkConfig.timeout_ms || 30000,
                      method: checkConfig.method?.toUpperCase() || 'GET',
                    });
                  }
                } catch (err: unknown) {
                  const errorObj = err as {
                    response?: { data?: { error?: string; message?: string } };
                    message?: string;
                  };
                  const details =
                    errorObj.response?.data?.error ||
                    errorObj.response?.data?.message ||
                    errorObj.message;
                  errors.push(`API Check '${checkConfig.name || 'unknown'}': ${details}`);
                  summary.apiChecks.errors++;
                }
              })
            );
            if (i < chunks.length - 1) await delay(delayMs);
          }
        }

        // 3. Process Heartbeats
        if (config.heartbeats && Array.isArray(config.heartbeats)) {
          logProgress('Fetching existing heartbeats...');
          const existingHeartbeats = await apiClient.getHeartbeats();
          const existingByName = new Map<string, Heartbeat>(
            existingHeartbeats.map((h) => [h.name, h])
          );

          const chunks = chunkArray(config.heartbeats, 5);
          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i]!;
            await Promise.all(
              chunk.map(async (hbConfig) => {
                try {
                  if (!hbConfig.name || !hbConfig.period) {
                    throw new Error("Heartbeat must have 'name' and 'period'");
                  }

                  const existing = existingByName.get(hbConfig.name);
                  if (existing) {
                    // Normalize both objects for comparison
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

                    // Skip update if no changes
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
                  } else {
                    summary.heartbeats.created++;
                    if (isDryRun) {
                      dryRunEntries.push({
                        type: 'create',
                        resource: 'heartbeat',
                        name: hbConfig.name!,
                      });
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
                  }
                } catch (err: unknown) {
                  const errorObj = err as {
                    response?: { data?: { error?: string; message?: string } };
                    message?: string;
                  };
                  const details =
                    errorObj.response?.data?.error ||
                    errorObj.response?.data?.message ||
                    errorObj.message;
                  errors.push(`Heartbeat '${hbConfig.name || 'unknown'}': ${details}`);
                  summary.heartbeats.errors++;
                }
              })
            );
            if (i < chunks.length - 1) await delay(delayMs);
          }
        }

        // 4. Browser checks are currently disabled
        if (config.ai_checks && Array.isArray(config.ai_checks) && config.ai_checks.length > 0) {
          outputService.warning(
            'Browser checks are currently disabled. Skipping ai_checks entries.'
          );
        }

        // 5. Incidents are export-only (runtime state, not config)
        if (config.incidents && Array.isArray(config.incidents) && config.incidents.length > 0) {
          outputService.warning(
            'Incidents are runtime state and cannot be applied. Use `obs incident create` to manage incidents directly.'
          );
        }

        // 6. Process Alert Channels
        if (config.alert_channels && Array.isArray(config.alert_channels)) {
          logProgress('Fetching existing alert channels...');
          const existingChannels = await apiClient.getAlertChannels();
          const existingByName = new Map<string, AlertChannel>(
            existingChannels.map((c) => [c.name, c])
          );

          const chunks = chunkArray(config.alert_channels, 5);
          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i]!;
            await Promise.all(
              chunk.map(async (chConfig) => {
                try {
                  if (!chConfig.name || !chConfig.type) {
                    throw new Error("Alert channel must have 'name' and 'type'");
                  }

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
                  } else {
                    summary.alertChannels.created++;
                    if (isDryRun) {
                      dryRunEntries.push({
                        type: 'create',
                        resource: 'alert-channel',
                        name: chConfig.name!,
                      });
                      return;
                    }
                    logProgress(`Creating alert channel: ${chConfig.name}`);
                    await apiClient.createAlertChannel(chConfig);
                  }
                } catch (err: unknown) {
                  const errorObj = err as {
                    response?: { data?: { error?: string; message?: string } };
                    message?: string;
                  };
                  const details =
                    errorObj.response?.data?.error ||
                    errorObj.response?.data?.message ||
                    errorObj.message;
                  errors.push(`Alert channel '${chConfig.name || 'unknown'}': ${details}`);
                  summary.alertChannels.errors++;
                }
              })
            );
            if (i < chunks.length - 1) await delay(delayMs);
          }
        }

        // 7. Process Status Pages (top-level metadata only; monitors managed via obs status-page add/remove-monitor)
        if (config.status_pages && Array.isArray(config.status_pages)) {
          logProgress('Fetching existing status pages...');
          const existingPages = await apiClient.getStatusPages();
          const existingBySlug = new Map<string, StatusPage>(
            existingPages.map((sp) => [sp.slug, sp])
          );

          const chunks = chunkArray(config.status_pages, 5);
          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i]!;
            await Promise.all(
              chunk.map(async (spConfig) => {
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
                        description: spConfig.description ?? '',
                        is_public: spConfig.is_public ?? true,
                        show_incident_history: spConfig.show_incident_history ?? true,
                        show_uptime_percentage: spConfig.show_uptime_percentage ?? true,
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
                  } else {
                    summary.statusPages.created++;
                    if (isDryRun) {
                      dryRunEntries.push({
                        type: 'create',
                        resource: 'status-page',
                        name: spConfig.slug!,
                      });
                      return;
                    }
                    logProgress(`Creating status page: ${spConfig.slug}`);
                    await apiClient.createStatusPage(spConfig);
                  }
                } catch (err: unknown) {
                  const errorObj = err as {
                    response?: { data?: { error?: string; message?: string } };
                    message?: string;
                  };
                  const details =
                    errorObj.response?.data?.error ||
                    errorObj.response?.data?.message ||
                    errorObj.message;
                  errors.push(`Status page '${spConfig.slug || 'unknown'}': ${details}`);
                  summary.statusPages.errors++;
                }
              })
            );
            if (i < chunks.length - 1) await delay(delayMs);
          }
        }

        // 8. Process Suites (top-level metadata only; tests are AI-generated and not applied)
        if (config.suites && Array.isArray(config.suites)) {
          logProgress('Fetching existing suites...');
          const existingSuites = await apiClient.listSuites();
          const existingByName = new Map<string, Suite>(
            existingSuites.map((s) => [s.suite_name, s])
          );

          const chunks = chunkArray(config.suites, 5);
          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i]!;
            await Promise.all(
              chunk.map(async (suiteConfig) => {
                try {
                  if (!suiteConfig.suite_name || !suiteConfig.target_url) {
                    throw new Error("Suite must have 'suite_name' and 'target_url'");
                  }

                  const existing = existingByName.get(suiteConfig.suite_name);
                  if (existing) {
                    const normalizedLocal = normalizeResource(
                      {
                        suite_name: suiteConfig.suite_name,
                        target_url: suiteConfig.target_url,
                        cron_expression: suiteConfig.cron_expression ?? '',
                        schedule_active: suiteConfig.schedule_active ?? false,
                        is_public: suiteConfig.is_public ?? false,
                        allow_form_submit: suiteConfig.allow_form_submit ?? false,
                      },
                      {
                        cron_expression: '',
                        schedule_active: false,
                        is_public: false,
                        allow_form_submit: false,
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
                      },
                      {
                        cron_expression: '',
                        schedule_active: false,
                        is_public: false,
                        allow_form_submit: false,
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
                    });
                  } else {
                    // Suites require AI generation — apply cannot create them headlessly.
                    outputService.warning(
                      `Suite '${suiteConfig.suite_name}' not found. Suites must be created via \`obs suite generate\` — skipping.`
                    );
                    summary.suites.errors++;
                  }
                } catch (err: unknown) {
                  const errorObj = err as {
                    response?: { data?: { error?: string; message?: string } };
                    message?: string;
                  };
                  const details =
                    errorObj.response?.data?.error ||
                    errorObj.response?.data?.message ||
                    errorObj.message;
                  errors.push(`Suite '${suiteConfig.suite_name || 'unknown'}': ${details}`);
                  summary.suites.errors++;
                }
              })
            );
            if (i < chunks.length - 1) await delay(delayMs);
          }
        }

        if (spinner) {
          spinner.stop();
        }

        if (isDryRun) {
          console.log('');
          printDryRun(dryRunEntries, summary);
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
            `  AI Checks:      ${summary.aiChecks.created} created, ${summary.aiChecks.updated} updated, ${summary.aiChecks.unchanged} unchanged`
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
      } catch (error: unknown) {
        if (spinner) spinner.stop();
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });

  return apply;
}
