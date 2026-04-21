import { Command } from 'commander';
import { IConfigService } from '../interfaces/config.interface.js';
import { IApiClient } from '../interfaces/api-client.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';
import { writeFileSync } from 'fs';
import { UrlMonitor, ApiCheck, Heartbeat, Test } from '../types/index.js';

interface ExportConfig {
  monitors?: Partial<UrlMonitor>[];
  api_checks?: Partial<ApiCheck>[];
  heartbeats?: Partial<Heartbeat>[];
  ai_checks?: Partial<Test>[];
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
        const [monitors, apiChecks, heartbeats, aiChecks] = await Promise.all([
          apiClient.getUrlMonitors().catch(() => [] as UrlMonitor[]),
          apiClient.getApiChecks().catch(() => [] as ApiCheck[]),
          apiClient.getHeartbeats().catch(() => [] as Heartbeat[]),
          apiClient.getTests().catch(() => [] as Test[]),
        ]);

        const config: ExportConfig = {};

        // 1. Map Monitors
        if (monitors.length > 0) {
          config.monitors = monitors.map((m) => ({
            name: m.name,
            url: m.url,
            cron_expression: (m as any).interval || m.cron_expression,
            timeout_ms: m.timeout_ms,
            alert_on_failure: m.alert_on_failure,
          })) as any;
        }

        // 2. Map API Checks
        if (apiChecks.length > 0) {
          config.api_checks = apiChecks.map((c) => ({
            name: c.name,
            url: c.url,
            method: c.method,
            timeout_ms: c.timeout_ms,
            alert_on_failure: c.alert_on_failure,
          }));
        }

        // 3. Map Heartbeats
        if (heartbeats.length > 0) {
          config.heartbeats = heartbeats.map((h) => ({
            name: h.name,
            period: h.period,
            grace_period: h.grace_period,
            description: h.description,
          }));
        }

        // 4. Map AI Checks
        if (aiChecks.length > 0) {
          config.ai_checks = aiChecks.map((t) => ({
            name: t.name,
            url: t.url,
            prompt: t.prompt,
            description: t.description || '',
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
