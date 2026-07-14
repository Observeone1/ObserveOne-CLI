import { Command } from 'commander';
import { IConfigService } from '../interfaces/config.interface.js';
import { IApiClient } from '../interfaces/api-client.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';
import { writeFileSync } from 'node:fs';
import {
  UrlMonitor,
  ApiCheck,
  Heartbeat,
  AlertChannel,
  StatusPage,
  Incident,
  Suite,
} from '../types/index.js';

interface ExportConfig {
  monitors?: Partial<UrlMonitor>[];
  api_checks?: Partial<ApiCheck>[];
  heartbeats?: Partial<Heartbeat>[];
  alert_channels?: Partial<AlertChannel>[];
  status_pages?: Array<Partial<StatusPage> & { monitors?: unknown[] }>;
  incidents?: Partial<Incident>[];
  suites?: Array<Partial<Suite> & { tests?: Array<{ name: string; script: string }> }>;
}

export function createExportCommand(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService
): Command {
  const exportCmd = new Command('export')
    .description('Export existing remote resources into a declarative JSON file')
    .option('-f, --file <path>', 'Path to save the JSON configuration file', 'obs.json')
    .option('-j, --json', 'Output in JSON format')
    .option('--no-scripts', "Exclude each suite's generated Playwright test scripts")
    .option(
      '--include-scripts',
      '[deprecated] Scripts are now included by default; this flag is a no-op'
    )
    .addHelpText(
      'after',
      `
Examples:
  $ obs export                         # saves all resources (incl. suite scripts) to obs.json
  $ obs export -f my-stack.json        # saves to a custom file name
  $ obs export --json                  # outputs the config JSON to stdout
  $ obs export --no-scripts            # omit suite Playwright scripts (lighter, config-only)
`
    )
    .action(async (options: Record<string, unknown>) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true' || options.json === true;
      if (isJson) {
        outputService.enableJsonMode();
      }
      // Lossless by default. Commander maps `--no-scripts` to options.scripts=false;
      // the deprecated `--include-scripts` is intentionally ignored (now a no-op).
      const includeScripts = options.scripts !== false;

      try {
        const apiKey = configService.getApiKey();
        if (!apiKey) {
          outputService.error('Not authenticated. Please run "obs login" first.');
          process.exit(1);
        }

        outputService.progress('Fetching existing resources from backend...');

        // Fetch list endpoints first, then hydrate with per-resource detail calls
        // so we capture fields the list omits (notably `channels` and `interval`
        // on monitors). List-only export would silently drop those fields.
        const [
          monitorList,
          apiCheckList,
          heartbeats,
          alertChannels,
          statusPageList,
          incidents,
          suites,
        ] = await Promise.all([
          apiClient.getUrlMonitors().catch(() => [] as UrlMonitor[]),
          apiClient.getApiChecks().catch(() => [] as ApiCheck[]),
          apiClient.getHeartbeats().catch(() => [] as Heartbeat[]),
          apiClient.getAlertChannels().catch(() => [] as AlertChannel[]),
          apiClient.getStatusPages().catch(() => [] as StatusPage[]),
          apiClient.getIncidents().catch(() => [] as Incident[]),
          apiClient.listSuites().catch(() => [] as Suite[]),
        ]);

        // Status pages need hydration: list endpoint omits attached monitors.
        const statusPages = await Promise.all(
          statusPageList.map((sp) =>
            apiClient
              .getStatusPage(sp.id)
              .then((detail) => ({ ...sp, ...(detail as Partial<StatusPage>) }))
              .catch(() => sp)
          )
        );

        const [monitors, apiChecks] = await Promise.all([
          Promise.all(
            monitorList.map((m) =>
              apiClient
                .getUrlMonitor(m.id)
                .then((detail) => ({ ...m, ...(detail as Partial<UrlMonitor>) }))
                .catch(() => m)
            )
          ),
          Promise.all(
            apiCheckList.map((c) =>
              apiClient
                .getApiCheck(c.id)
                .then((resp) => {
                  // getApiCheck returns { apiCheck, ...stats }; merge the nested shape.
                  const nested = (resp as { apiCheck?: ApiCheck }).apiCheck;
                  return nested ? { ...c, ...nested } : { ...c, ...(resp as Partial<ApiCheck>) };
                })
                .catch(() => c)
            )
          ),
        ]);

        const config: ExportConfig = {};

        // Helper: GET responses populate `channels` as full objects;
        // CREATE/UPDATE wire format expects `channel_ids` as numeric IDs.
        const extractChannelIds = (r: {
          channels?: Array<{ id: string }> | undefined;
          channel_ids?: string[] | undefined;
        }): string[] | undefined => {
          if (Array.isArray(r.channels) && r.channels.length > 0) {
            return r.channels.map((c) => c.id);
          }
          return r.channel_ids;
        };

        // Helper: GET responses include DB-owned fields (id, created_at,
        // api_check_id) on assertions; apply wire format takes only the
        // authored fields.
        const stripAssertionDbFields = <T extends { type?: unknown }>(
          assertions: T[] | undefined
        ): Array<Pick<T, 'type'> & Record<string, unknown>> | undefined => {
          if (!Array.isArray(assertions) || assertions.length === 0) return undefined;
          return assertions.map((a) => {
            const { type, operator, path, value } = a as unknown as {
              type: string;
              operator: string;
              path?: string | null;
              value: string;
            };
            const authored: Record<string, unknown> = { type, operator, value };
            if (path !== null && path !== undefined) authored.path = path;
            return authored as Pick<T, 'type'> & Record<string, unknown>;
          });
        };

        // 1. Map Monitors
        if (monitors.length > 0) {
          config.monitors = monitors.map((m) => {
            const extended = m as UrlMonitor & {
              channels?: Array<{ id: string }>;
              cron_expression?: string;
            };
            const channel_ids = extractChannelIds(extended);
            return {
              // Bundle-local surrogate key: lets status_pages[].monitors[].monitor_id
              // resolve to this monitor on import. Not a real id in any target.
              ...(m.id !== undefined && { id: m.id }),
              name: m.name,
              ...(m.description !== undefined && { description: m.description }),
              url: m.url,
              interval: m.interval || extended.cron_expression,
              timeout_ms: m.timeout_ms,
              alert_on_failure: m.alert_on_failure,
              ...(channel_ids !== undefined && channel_ids.length > 0 && { channel_ids }),
            };
          }) as Partial<UrlMonitor>[];
        }

        // 2. Map API Checks
        if (apiChecks.length > 0) {
          config.api_checks = apiChecks.map((c) => {
            const extended = c as ApiCheck & {
              channels?: Array<{ id: string }>;
              interval?: string;
            };
            const channel_ids = extractChannelIds(extended);
            const assertions = stripAssertionDbFields(c.assertions);
            return {
              // Bundle-local surrogate key (see monitors): resolves
              // status_pages[].monitors[].monitor_id on import.
              ...(c.id !== undefined && { id: c.id }),
              name: c.name,
              ...(c.description !== undefined && { description: c.description }),
              url: c.url,
              method: c.method,
              ...(c.headers !== undefined && { headers: c.headers }),
              ...(c.body !== undefined && c.body !== null && { body: c.body }),
              timeout_ms: c.timeout_ms,
              ...(c.cron_expression !== undefined || extended.interval !== undefined
                ? { cron_expression: c.cron_expression || extended.interval }
                : {}),
              alert_on_failure: c.alert_on_failure,
              ...(channel_ids !== undefined && channel_ids.length > 0 && { channel_ids }),
              ...(assertions !== undefined && { assertions }),
            } as Partial<ApiCheck>;
          });
        }

        // 3. Map Heartbeats. ping_key rides along so the self-host import
        // can re-use it as the heartbeat token — preserves the public ping
        // URL across migration, so services that POST to /heartbeat/:token
        // don't silently stop working.
        if (heartbeats.length > 0) {
          config.heartbeats = heartbeats.map((h) => ({
            name: h.name,
            ...(h.description !== undefined && { description: h.description }),
            period: h.period,
            grace_period: h.grace_period,
            ping_key: h.ping_key,
            alert_on_failure: h.alert_on_failure,
          }));
        }

        // 4. Map Alert Channels
        if (alertChannels.length > 0) {
          config.alert_channels = alertChannels.map((c) => ({
            // Bundle-local surrogate key: lets monitors/api_checks `channel_ids`
            // resolve to this channel on import. Not a real id in any target.
            ...(c.id !== undefined && { id: c.id }),
            name: c.name,
            type: c.type,
            config: c.config,
          }));
        }

        // 5. Map Status Pages (with attached monitors)
        if (statusPages.length > 0) {
          config.status_pages = statusPages.map((sp) => {
            const extended = sp as StatusPage & {
              monitors?: Array<{
                monitor_type?: string;
                monitor_id?: number;
                display_name?: string;
                display_order?: number;
              }>;
            };
            const monitorEntries =
              Array.isArray(extended.monitors) && extended.monitors.length > 0
                ? extended.monitors.map((m) => ({
                    monitor_type: m.monitor_type,
                    monitor_id: m.monitor_id,
                    display_name: m.display_name,
                    ...(m.display_order !== undefined && { display_order: m.display_order }),
                  }))
                : undefined;
            return {
              slug: sp.slug,
              name: sp.name,
              ...(sp.description !== undefined && { description: sp.description }),
              ...(sp.logo_url !== undefined && { logo_url: sp.logo_url }),
              ...(sp.custom_domain !== undefined && { custom_domain: sp.custom_domain }),
              is_public: sp.is_public,
              show_incident_history: sp.show_incident_history,
              show_uptime_percentage: sp.show_uptime_percentage,
              ...(sp.theme_primary_color !== undefined && {
                theme_primary_color: sp.theme_primary_color,
              }),
              ...(sp.theme_background_color !== undefined && {
                theme_background_color: sp.theme_background_color,
              }),
              ...(monitorEntries !== undefined && { monitors: monitorEntries }),
            };
          });
        }

        // 6. Map Incidents
        // Incidents are runtime state, not config; included as a backup/audit
        // artifact. `obs apply` does not currently re-create incidents.
        if (incidents.length > 0) {
          config.incidents = incidents.map((i) => ({
            title: i.title,
            ...(i.description !== undefined && { description: i.description }),
            status: i.status,
            priority: i.priority,
            ...(i.assigned_to !== undefined &&
              i.assigned_to !== null && { assigned_to: i.assigned_to }),
            ...(i.team_id !== undefined && { team_id: i.team_id }),
          }));
        }

        // 7. Map Suites
        if (suites.length > 0) {
          const scriptsBySuiteId: Record<string, Array<{ name: string; script: string }>> = {};
          if (includeScripts) {
            await Promise.all(
              suites
                .filter((s) => s.test_count > 0)
                .map(async (s) => {
                  try {
                    const resp = await apiClient.getSuiteScripts(s.id);
                    scriptsBySuiteId[s.id] = resp.tests.map((t) => ({
                      name: t.name,
                      script: t.code,
                    }));
                  } catch {
                    scriptsBySuiteId[s.id] = [];
                  }
                })
            );
          }
          config.suites = suites.map((s) => ({
            suite_name: s.suite_name,
            target_url: s.target_url,
            cron_expression: s.cron_expression,
            schedule_active: s.schedule_active,
            max_tests: s.max_tests,
            is_public: s.is_public,
            allow_form_submit: s.allow_form_submit,
            ...(Array.isArray(s.secret_keys) &&
              s.secret_keys.length > 0 && { secret_keys: s.secret_keys }),
            ...(includeScripts &&
              scriptsBySuiteId[s.id]?.length && { tests: scriptsBySuiteId[s.id] }),
          }));
        }

        // Write to file
        const targetFile = options.file as string;
        writeFileSync(targetFile, JSON.stringify(config, null, 2));

        if (isJson) {
          outputService.formatJsonOutput({
            success: true,
            file: targetFile,
            scriptsIncluded: includeScripts,
            counts: {
              monitors: monitors.length,
              apiChecks: apiChecks.length,
              heartbeats: heartbeats.length,
              alertChannels: alertChannels.length,
              statusPages: statusPages.length,
              incidents: incidents.length,
              suites: suites.length,
            },
          });
        } else {
          outputService.success(`Exported existing resources to ${targetFile}`);
          console.log('');
          console.log(`  Monitors:       ${monitors.length}`);
          console.log(`  API Checks:     ${apiChecks.length}`);
          console.log(`  Heartbeats:     ${heartbeats.length}`);
          console.log(`  Alert Channels: ${alertChannels.length}`);
          console.log(`  Status Pages:   ${statusPages.length}`);
          console.log(`  Incidents:      ${incidents.length}`);
          console.log(`  Suites:         ${suites.length}`);
          console.log('');
          console.log(
            `  Suite scripts:  ${includeScripts ? 'included' : 'excluded (--no-scripts)'}`
          );
        }
      } catch (error: unknown) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });

  return exportCmd;
}
