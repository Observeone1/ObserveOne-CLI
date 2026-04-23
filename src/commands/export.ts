import { Command } from 'commander';
import { IConfigService } from '../interfaces/config.interface.js';
import { IApiClient } from '../interfaces/api-client.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';
import { writeFileSync } from 'fs';
import { UrlMonitor, ApiCheck, Heartbeat } from '../types/index.js';

interface ExportConfig {
  monitors?: Partial<UrlMonitor>[];
  api_checks?: Partial<ApiCheck>[];
  heartbeats?: Partial<Heartbeat>[];
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
    .action(async (options: Record<string, unknown>) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true' || options.json === true;
      if (isJson) {
        outputService.enableJsonMode();
      }

      try {
        const apiKey = configService.getApiKey();
        if (!apiKey) {
          outputService.error('Not authenticated. Please run "obs login" first.');
          process.exit(1);
        }

        outputService.progress('Fetching existing resources from backend...');

        // Fetch all resources
        const [monitors, apiChecks, heartbeats] = await Promise.all([
          apiClient.getUrlMonitors().catch(() => [] as UrlMonitor[]),
          apiClient.getApiChecks().catch(() => [] as ApiCheck[]),
          apiClient.getHeartbeats().catch(() => [] as Heartbeat[]),
        ]);

        const config: ExportConfig = {};

        // Helper: GET responses populate `channels` as full objects;
        // CREATE/UPDATE wire format expects `channel_ids` as numeric IDs.
        const extractChannelIds = (r: {
          channels?: Array<{ id: number }> | undefined;
          channel_ids?: number[] | undefined;
        }): number[] | undefined => {
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
              channels?: Array<{ id: number }>;
              cron_expression?: string;
            };
            const channel_ids = extractChannelIds(extended);
            return {
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
              channels?: Array<{ id: number }>;
              interval?: string;
            };
            const channel_ids = extractChannelIds(extended);
            const assertions = stripAssertionDbFields(c.assertions);
            return {
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

        // 3. Map Heartbeats
        if (heartbeats.length > 0) {
          config.heartbeats = heartbeats.map((h) => ({
            name: h.name,
            ...(h.description !== undefined && { description: h.description }),
            period: h.period,
            grace_period: h.grace_period,
          }));
        }

        // Write to file
        const targetFile = options.file as string;
        writeFileSync(targetFile, JSON.stringify(config, null, 2));

        if (isJson) {
          outputService.formatJsonOutput({
            success: true,
            file: targetFile,
            counts: {
              monitors: monitors.length,
              apiChecks: apiChecks.length,
              heartbeats: heartbeats.length,
            },
          });
        } else {
          outputService.success(`Exported existing resources to ${targetFile}`);
          console.log('');
          console.log(`  Monitors:   ${monitors.length}`);
          console.log(`  API Checks: ${apiChecks.length}`);
          console.log(`  Heartbeats: ${heartbeats.length}`);
        }
      } catch (error: unknown) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });

  return exportCmd;
}
