import { Command } from 'commander';
import { IConfigService } from '../interfaces/config.interface.js';
import { IApiClient } from '../interfaces/api-client.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';
import { readFileSync, existsSync } from 'fs';
import ora, { Ora } from 'ora';
import { deepEqual, normalizeResource, diffObjects, FieldDiff } from '../utils/deep-equal.js';
import { UrlMonitor, ApiCheck, Heartbeat } from '../types/index.js';
import { ApplyConfig, normalizeApplyConfig } from '../utils/apply-config.js';

// Resources returned by the GET endpoints carry alert channels as a
// populated `channels` array; the create/update wire format expects
// `channel_ids` (array of numeric IDs). Normalize both sides to
// channel_ids for diff + update payloads.
const extractChannelIds = (r: {
  channels?: Array<{ id: number }> | undefined;
  channel_ids?: number[] | undefined;
}): number[] => {
  if (Array.isArray(r.channels) && r.channels.length > 0) {
    return r.channels.map((c) => c.id).sort((a, b) => a - b);
  }
  if (Array.isArray(r.channel_ids)) {
    return [...r.channel_ids].sort((a, b) => a - b);
  }
  return [];
};

// GET responses include DB-owned fields (id, created_at, api_check_id)
// on assertions; for diff purposes, compare only the authored shape.
const normalizeAssertions = (
  assertions:
    | Array<{ type: string; operator: string; path?: string | null; value: string }>
    | undefined
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
      'Apply configuration from a JSON file. Supports: obs.json (plural), {"monitor": {...}} (wrapped), {"type": "monitor", ...} (explicit), or bare monitor/check/heartbeat object.'
    )
    .argument('[file]', 'Path to the JSON configuration file')
    .option('-f, --file <path>', 'Path to the JSON configuration file')
    .option('-j, --json', 'Output in JSON format')
    .option('--dry-run', 'Preview changes without applying them')
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
                    const localChannelIds = extractChannelIds(monitorConfig as any);
                    const remoteChannelIds = extractChannelIds(existing as any);
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
                    const localChannelIds = extractChannelIds(checkConfig as any);
                    const remoteChannelIds = extractChannelIds(existing as any);
                    const localAssertions = normalizeAssertions(checkConfig.assertions as any);
                    const remoteAssertions = normalizeAssertions(existing.assertions as any);
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
            `  Monitors:   ${summary.monitors.created} created, ${summary.monitors.updated} updated, ${summary.monitors.unchanged} unchanged`
          );
          console.log(
            `  API Checks: ${summary.apiChecks.created} created, ${summary.apiChecks.updated} updated, ${summary.apiChecks.unchanged} unchanged`
          );
          console.log(
            `  Heartbeats: ${summary.heartbeats.created} created, ${summary.heartbeats.updated} updated, ${summary.heartbeats.unchanged} unchanged`
          );
          console.log(
            `  AI Checks:  ${summary.aiChecks.created} created, ${summary.aiChecks.updated} updated, ${summary.aiChecks.unchanged} unchanged`
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
