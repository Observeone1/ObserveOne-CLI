import { Command } from "commander";
import { IConfigService } from "../interfaces/config.interface.js";
import { IApiClient } from "../interfaces/api-client.interface.js";
import { IOutputService } from "../interfaces/output.interface.js";
import { readFileSync, existsSync } from "fs";
import ora from "ora";
import chalk from "chalk";

const chunkArray = <T>(arr: T[], size: number): T[][] => {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createApplyCommand(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService,
): Command {
  const apply = new Command("apply")
    .description("Apply configuration from a JSON file (declarative workflow)")
    .argument("[file]", "Path to the JSON configuration file")
    .option("-f, --file <path>", "Path to the JSON configuration file")
    .option("-j, --json", "Output in JSON format")
    .action(async (fileArg, options) => {
      const isVerbose = process.env.OBS_VERBOSE === "true";
      const isJson = process.env.OBS_JSON_OUTPUT === "true" || options.json;

      if (isJson) {
        outputService.enableJsonMode();
      }

      let spinner: any = null;

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
          outputService.error(
            'Not authenticated. Please run "obs login" first.',
          );
          process.exit(1);
        }

        // Try to read the file
        let targetFile = options.file || fileArg || "obs.json";
        if (!existsSync(targetFile)) {
          if (fileArg === "obs.json" && existsSync("observeone.json")) {
            targetFile = "observeone.json";
          } else if (
            !options.file &&
            !fileArg &&
            existsSync("observeone.json")
          ) {
            targetFile = "observeone.json";
          } else {
            outputService.error(`Configuration file not found: ${targetFile}`);
            process.exit(1);
          }
        }

        if (!isVerbose && !isJson) {
          spinner = ora("Applying declarative configuration...").start();
        }

        logProgress(`Reading configuration from ${targetFile}...`);
        const fileContent = readFileSync(targetFile, "utf-8");
        let config: any;
        try {
          config = JSON.parse(fileContent);
        } catch (e: any) {
          if (spinner) spinner.fail("Invalid JSON");
          outputService.error(`Invalid JSON in ${targetFile}: ${e.message}`);
          process.exit(1);
        }

        const summary = {
          monitors: { created: 0, updated: 0, errors: 0 },
          apiChecks: { created: 0, updated: 0, errors: 0 },
          heartbeats: { created: 0, updated: 0, errors: 0 },
          aiChecks: { created: 0, updated: 0, errors: 0 },
        };

        const errors: string[] = [];
        const delayMs = 1000; // 1 second between chunks to respect 100 req/min rate limit

        // 1. Process URL Monitors
        if (config.monitors && Array.isArray(config.monitors)) {
          logProgress("Fetching existing monitors...");
          const existingMonitors = await apiClient.getUrlMonitors();
          const existingByName = new Map(
            existingMonitors.map((m: any) => [m.name, m]),
          );

          const chunks = chunkArray(config.monitors, 5);
          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i] as any[];
            await Promise.all(
              chunk.map(async (monitorConfig: any) => {
                try {
                  if (!monitorConfig.name || !monitorConfig.url) {
                    throw new Error("Monitor must have 'name' and 'url'");
                  }

                  const existing = existingByName.get(monitorConfig.name);
                  if (existing) {
                    logProgress(`Updating monitor: ${monitorConfig.name}`);
                    await apiClient.updateUrlMonitor(
                      existing.id || existing.data?.id,
                      {
                        name: monitorConfig.name || existing.name,
                        url: monitorConfig.url || existing.url,
                        timeout_ms:
                          monitorConfig.timeout_ms ||
                          existing.timeout_ms ||
                          30000,
                        cron_expression:
                          monitorConfig.interval ||
                          monitorConfig.cron_expression ||
                          existing.interval ||
                          existing.cron_expression,
                        alert_on_failure:
                          monitorConfig.alert_on_failure ??
                          existing.alert_on_failure ??
                          true,
                      },
                    );
                    summary.monitors.updated++;
                  } else {
                    logProgress(`Creating monitor: ${monitorConfig.name}`);
                    await apiClient.createUrlMonitor({
                      ...monitorConfig,
                      timeout_ms: monitorConfig.timeout_ms || 30000,
                      cron_expression:
                        monitorConfig.interval || monitorConfig.cron_expression,
                    });
                    summary.monitors.created++;
                  }
                } catch (err: any) {
                  const details =
                    err.response?.data?.error ||
                    err.response?.data?.message ||
                    err.message;
                  errors.push(
                    `Monitor '${monitorConfig.name || "unknown"}': ${details}`,
                  );
                  summary.monitors.errors++;
                }
              }),
            );
            if (i < chunks.length - 1) await delay(delayMs);
          }
        }

        // 2. Process API Checks
        if (config.api_checks && Array.isArray(config.api_checks)) {
          logProgress("Fetching existing API checks...");
          const existingChecks = await apiClient.getApiChecks();
          const existingByName = new Map(
            existingChecks.map((c: any) => [c.name, c]),
          );

          const chunks = chunkArray(config.api_checks, 5);
          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i] as any[];
            await Promise.all(
              chunk.map(async (checkConfig: any) => {
                try {
                  if (!checkConfig.name || !checkConfig.url) {
                    throw new Error("API check must have 'name' and 'url'");
                  }

                  const existing = existingByName.get(checkConfig.name);
                  if (existing) {
                    logProgress(`Updating API check: ${checkConfig.name}`);
                    await apiClient.updateApiCheck(
                      existing.id || existing.data?.id,
                      {
                        name: checkConfig.name || existing.name,
                        url: checkConfig.url || existing.url,
                        method:
                          checkConfig.method?.toUpperCase() ||
                          existing.method ||
                          "GET",
                        timeout_ms:
                          checkConfig.timeout_ms ||
                          existing.timeout_ms ||
                          30000,
                        alert_on_failure:
                          checkConfig.alert_on_failure ??
                          existing.alert_on_failure ??
                          true,
                      },
                    );
                    summary.apiChecks.updated++;
                  } else {
                    logProgress(`Creating API check: ${checkConfig.name}`);
                    await apiClient.createApiCheck({
                      ...checkConfig,
                      timeout_ms: checkConfig.timeout_ms || 30000,
                      method: checkConfig.method?.toUpperCase() || "GET",
                    });
                    summary.apiChecks.created++;
                  }
                } catch (err: any) {
                  const details =
                    err.response?.data?.error ||
                    err.response?.data?.message ||
                    err.message;
                  errors.push(
                    `API Check '${checkConfig.name || "unknown"}': ${details}`,
                  );
                  summary.apiChecks.errors++;
                }
              }),
            );
            if (i < chunks.length - 1) await delay(delayMs);
          }
        }

        // 3. Process Heartbeats
        if (config.heartbeats && Array.isArray(config.heartbeats)) {
          logProgress("Fetching existing heartbeats...");
          const existingHeartbeats = await apiClient.getHeartbeats();
          const existingByName = new Map(
            existingHeartbeats.map((h: any) => [h.name, h]),
          );

          const chunks = chunkArray(config.heartbeats, 5);
          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i] as any[];
            await Promise.all(
              chunk.map(async (hbConfig: any) => {
                try {
                  if (!hbConfig.name || !hbConfig.period) {
                    throw new Error("Heartbeat must have 'name' and 'period'");
                  }

                  const existing = existingByName.get(hbConfig.name);
                  if (existing) {
                    logProgress(`Updating heartbeat: ${hbConfig.name}`);
                    await apiClient.updateHeartbeat(
                      existing.id || existing.data?.id,
                      {
                        name: hbConfig.name || existing.name,
                        period: hbConfig.period || existing.period,
                        description: existing.description || "Updated via CLI",
                        grace_period:
                          hbConfig.grace ||
                          hbConfig.grace_period ||
                          existing.grace_period ||
                          60,
                      },
                    );
                    summary.heartbeats.updated++;
                  } else {
                    logProgress(`Creating heartbeat: ${hbConfig.name}`);
                    await apiClient.createHeartbeat({
                      name: hbConfig.name,
                      period: hbConfig.period,
                    });
                    summary.heartbeats.created++;
                  }
                } catch (err: any) {
                  const details =
                    err.response?.data?.error ||
                    err.response?.data?.message ||
                    err.message;
                  errors.push(
                    `Heartbeat '${hbConfig.name || "unknown"}': ${details}`,
                  );
                  summary.heartbeats.errors++;
                }
              }),
            );
            if (i < chunks.length - 1) await delay(delayMs);
          }
        }

        // 4. Process AI Checks
        if (config.ai_checks && Array.isArray(config.ai_checks)) {
          logProgress("Fetching existing AI checks...");
          const existingAiChecks = await apiClient.getTests();
          const existingByName = new Map(
            existingAiChecks.map((t: any) => [t.name, t]),
          );

          const chunks = chunkArray(config.ai_checks, 5);
          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i] as any[];
            await Promise.all(
              chunk.map(async (aiConfig: any) => {
                try {
                  if (!aiConfig.name || !aiConfig.url || !aiConfig.prompt) {
                    throw new Error(
                      "AI check must have 'name', 'url', and 'prompt'",
                    );
                  }

                  const existing = existingByName.get(aiConfig.name);
                  if (existing) {
                    logProgress(`Updating AI check: ${aiConfig.name}`);
                    await apiClient.updateTest(
                      existing.id || existing.data?.id,
                      {
                        name: aiConfig.name || existing.name,
                        url: aiConfig.url || existing.url,
                        prompt: aiConfig.prompt || existing.prompt,
                        description:
                          aiConfig.description || existing.description || "",
                      },
                    );
                    summary.aiChecks.updated++;
                  } else {
                    logProgress(`Creating AI check: ${aiConfig.name}`);
                    await apiClient.createTest({
                      name: aiConfig.name,
                      url: aiConfig.url,
                      prompt: aiConfig.prompt,
                      description: aiConfig.description || "Created via CLI",
                    });
                    summary.aiChecks.created++;
                  }
                } catch (err: any) {
                  const details =
                    err.response?.data?.error ||
                    err.response?.data?.message ||
                    err.message;
                  errors.push(
                    `AI Check '${aiConfig.name || "unknown"}': ${details}`,
                  );
                  summary.aiChecks.errors++;
                }
              }),
            );
            if (i < chunks.length - 1) await delay(delayMs);
          }
        }

        if (spinner) {
          spinner.stop();
        }

        if (isJson) {
          outputService.formatJsonOutput({
            summary,
            errors: errors.length > 0 ? errors : undefined,
          });
        } else {
          outputService.success("Apply completed.");
          console.log("");
          console.log(
            `  Monitors:   ${summary.monitors.created} created, ${summary.monitors.updated} updated`,
          );
          console.log(
            `  API Checks: ${summary.apiChecks.created} created, ${summary.apiChecks.updated} updated`,
          );
          console.log(
            `  Heartbeats: ${summary.heartbeats.created} created, ${summary.heartbeats.updated} updated`,
          );
          console.log(
            `  AI Checks:  ${summary.aiChecks.created} created, ${summary.aiChecks.updated} updated`,
          );

          if (errors.length > 0) {
            console.log("");
            outputService.error("Some resources failed to apply:");
            errors.forEach((e) => console.log(`  - ${e}`));
            process.exit(1); // Exit with error if any resource failed
          }
        }
      } catch (error: any) {
        if (spinner) spinner.stop();
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });

  return apply;
}
