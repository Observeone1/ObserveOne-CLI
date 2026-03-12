import { Command } from 'commander';
import { IConfigService } from '../interfaces/config.interface.js';
import { IApiClient } from '../interfaces/api-client.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';
import { writeFileSync } from 'fs';
import { ApiCheck, Heartbeat, Test, UrlMonitor } from '../types/index.js';

type ExportMonitor = Pick<UrlMonitor, 'name' | 'url' | 'timeout_ms' | 'alert_on_failure'> & {
  interval?: string;
};
type ExportApiCheck = Pick<ApiCheck, 'name' | 'url' | 'method' | 'timeout_ms' | 'alert_on_failure'>;
type ExportHeartbeat = Pick<Heartbeat, 'name' | 'period'> & {
  grace?: number;
  description?: string;
};
type ExportAiCheck = Pick<Test, 'name' | 'url' | 'prompt'>;

interface ExportConfig {
  monitors?: ExportMonitor[];
  api_checks?: ExportApiCheck[];
  heartbeats?: ExportHeartbeat[];
  ai_checks?: ExportAiCheck[];
}

export function createExportCommand(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService
): Command {
  const exportCmd = new Command('export')
    .description('Export existing remote resources into a declarative JSON file')
    .option('-f, --file <path>', 'Path to save the JSON configuration file', 'observeone.json')
    .option('-j, --json', 'Output in JSON format')
    .action(async (options) => {
      if (process.env.OBS_JSON_OUTPUT === 'true' || options.json) {
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
        const [monitors, apiChecks, heartbeats, aiChecks] = await Promise.all([
          apiClient.getUrlMonitors().catch(() => []),
          apiClient.getApiChecks().catch(() => []),
          apiClient.getHeartbeats().catch(() => []),
          apiClient.getTests().catch(() => []),
        ]);

        const config: ExportConfig = {};

        // 1. Map Monitors
        if (monitors.length > 0) {
          config.monitors = monitors.map((m: UrlMonitor) => {
            const monitorConfig: ExportMonitor = {
              name: m.name,
              url: m.url,
              timeout_ms: m.timeout_ms,
              alert_on_failure: m.alert_on_failure,
            };

            if (m.cron_expression) {
              monitorConfig.interval = m.cron_expression;
            }

            return monitorConfig;
          });
        }

        // 2. Map API Checks
        if (apiChecks.length > 0) {
          config.api_checks = apiChecks.map((c: ApiCheck) => ({
            name: c.name,
            url: c.url,
            method: c.method,
            timeout_ms: c.timeout_ms,
            alert_on_failure: c.alert_on_failure,
          }));
        }

        // 3. Map Heartbeats
        if (heartbeats.length > 0) {
          config.heartbeats = heartbeats.map((h: Heartbeat) => {
            const heartbeatConfig: ExportHeartbeat = {
              name: h.name,
              period: h.period,
            };

            if (typeof h.grace_period === 'number') {
              heartbeatConfig.grace = h.grace_period;
            }

            if (h.description) {
              heartbeatConfig.description = h.description;
            }

            return heartbeatConfig;
          });
        }

        // 4. Map AI Checks
        if (aiChecks.length > 0) {
          config.ai_checks = aiChecks.map((t: Test) => ({
            name: t.name,
            url: t.url,
            prompt: t.prompt,
          }));
        }

        // Write to file
        const targetFile = options.file;
        writeFileSync(targetFile, JSON.stringify(config, null, 2));

        if (process.env.OBS_JSON_OUTPUT === 'true') {
          outputService.formatJsonOutput({
            success: true,
            file: targetFile,
            counts: {
              monitors: monitors.length,
              apiChecks: apiChecks.length,
              heartbeats: heartbeats.length,
              aiChecks: aiChecks.length,
            },
          });
        } else {
          outputService.success(`Exported existing resources to ${targetFile}`);
          console.log('');
          console.log(`  Monitors:   ${monitors.length}`);
          console.log(`  API Checks: ${apiChecks.length}`);
          console.log(`  Heartbeats: ${heartbeats.length}`);
          console.log(`  AI Checks:  ${aiChecks.length}`);
        }
      } catch (error: unknown) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });

  return exportCmd;
}
