import { Command } from "commander";
import inquirer from "inquirer";
import { IConfigService } from "../interfaces/config.interface.js";
import { IApiClient } from "../interfaces/api-client.interface.js";
import { IOutputService } from "../interfaces/output.interface.js";

/**
 * Factory function to create monitor command
 */
export function createMonitorCommand(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService,
): Command {
  const monitor = new Command("monitor").description("Manage URL monitors");

  // LIST
  monitor
    .command("list")
    .description("List all URL monitors")
    .option("-f, --format <format>", "Output format (table, json)", "table")
    .action(async (options) => {
      if (process.env.OBS_JSON_OUTPUT === "true" || options.format === "json") {
        outputService.enableJsonMode();
      }
      try {
        const apiKey = configService.getApiKey();
        if (!apiKey) {
          outputService.error(
            'Not authenticated. Please run "obs login" first.',
          );
          process.exit(1);
        }

        outputService.progress("Fetching URL monitors...");
        const monitors = await apiClient.getUrlMonitors();

        if (
          process.env.OBS_JSON_OUTPUT === "true" ||
          options.format === "json"
        ) {
          outputService.formatJsonOutput(monitors);
        } else {
          outputService.formatMonitorList(
            monitors,
            process.env.OBS_VERBOSE === "true",
          );
        }
      } catch (error: any) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });

  // GET
  monitor
    .command("get <id>")
    .description("Get details of a URL monitor")
    .option("-j, --json", "Output in JSON format")
    .action(async (id, options) => {
      if (process.env.OBS_JSON_OUTPUT === "true" || options.json) {
        outputService.enableJsonMode();
      }
      try {
        const apiKey = configService.getApiKey();
        if (!apiKey) {
          outputService.error(
            'Not authenticated. Please run "obs login" first.',
          );
          process.exit(1);
        }

        const monitorId = parseInt(id);
        if (isNaN(monitorId)) {
          outputService.error("Invalid monitor ID.");
          process.exit(1);
        }

        if (process.env.OBS_JSON_OUTPUT === "true") {
          outputService.enableJsonMode();
        }

        outputService.progress(`Fetching monitor ${monitorId}...`);
        const monitorData = await apiClient.getUrlMonitor(monitorId);

        if (process.env.OBS_JSON_OUTPUT === "true") {
          outputService.formatJsonOutput(monitorData);
        } else {
          outputService.formatMonitorList([monitorData], true);
        }
      } catch (error: any) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });

  // CREATE
  monitor
    .command("create")
    .description("Create a new URL monitor")
    .option("-n, --name <name>", "Monitor name")
    .option("-u, --url <url>", "URL to monitor")
    .option(
      "-i, --interval <cron>",
      "Cron expression for interval (e.g. '*/5 * * * *')",
    )
    .option("--no-alerts", "Disable alerts on failure")
    .option("-j, --json", "Output in JSON format")
    .action(async (options) => {
      if (process.env.OBS_JSON_OUTPUT === "true" || options.json) {
        outputService.enableJsonMode();
      }
      try {
        const apiKey = configService.getApiKey();
        if (!apiKey) {
          outputService.error(
            'Not authenticated. Please run "obs login" first.',
          );
          process.exit(1);
        }

        let { name, url, interval, alerts } = options;

        // Interactive prompts if missing critical fields
        if (!name || !url) {
          const answers = await inquirer.prompt([
            {
              type: "input",
              name: "name",
              message: "Monitor name:",
              when: !name,
              validate: (val) => (val.trim() ? true : "Name is required"),
            },
            {
              type: "input",
              name: "url",
              message: "URL to monitor:",
              when: !url,
              validate: (val) => {
                try {
                  new URL(val);
                  return true;
                } catch {
                  return "Please enter a valid URL (e.g. https://example.com)";
                }
              },
            },
            {
              type: "input",
              name: "interval",
              message: "Cron interval (default: Every 5 mins):",
              when: !interval,
              default: "*/5 * * * *",
            },
          ]);
          name = name || answers.name;
          url = url || answers.url;
          interval = interval || answers.interval;
        }

        outputService.progress("Creating URL monitor...");
        const newMonitor = await apiClient.createUrlMonitor({
          name,
          url,
          cron_expression: interval || "*/5 * * * *",
          alert_on_failure: alerts !== false,
          timeout_ms: 30000,
        });

        if (process.env.OBS_JSON_OUTPUT === "true") {
          outputService.formatJsonOutput(newMonitor);
        } else {
          outputService.success(
            `Monitor "${newMonitor.name}" created successfully (ID: ${newMonitor.id})`,
          );
        }
      } catch (error: any) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });

  // DELETE
  monitor
    .command("delete <id>")
    .description("Delete a URL monitor")
    .option("-y, --yes", "Skip confirmation prompt")
    .option("-j, --json", "Output in JSON format")
    .action(async (id, options) => {
      if (process.env.OBS_JSON_OUTPUT === "true" || options.json) {
        outputService.enableJsonMode();
      }
      try {
        const apiKey = configService.getApiKey();
        if (!apiKey) {
          outputService.error(
            'Not authenticated. Please run "obs login" first.',
          );
          process.exit(1);
        }

        const monitorId = parseInt(id);
        if (isNaN(monitorId)) {
          outputService.error("Invalid monitor ID.");
          process.exit(1);
        }

        if (!options.yes) {
          const { confirm } = await inquirer.prompt([
            {
              type: "confirm",
              name: "confirm",
              message: `Are you sure you want to delete monitor ${monitorId}?`,
              default: false,
            },
          ]);
          if (!confirm) {
            outputService.info("Deletion cancelled.");
            return;
          }
        }

        outputService.progress(`Deleting monitor ${monitorId}...`);
        await apiClient.deleteUrlMonitor(monitorId);

        if (process.env.OBS_JSON_OUTPUT === "true") {
          outputService.formatJsonOutput({ success: true, id: monitorId });
        } else {
          outputService.success(`Monitor ${monitorId} deleted successfully.`);
        }
      } catch (error: any) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });

  // UPDATE
  monitor
    .command("update <id>")
    .description("Update a URL monitor")
    .option("-n, --name <name>", "New monitor name")
    .option("-u, --url <url>", "New URL")
    .option("-i, --interval <cron>", "New cron interval")
    .option("-j, --json", "Output in JSON format")
    .action(async (id, options) => {
      if (process.env.OBS_JSON_OUTPUT === "true" || options.json) {
        outputService.enableJsonMode();
      }
      try {
        const apiKey = configService.getApiKey();
        if (!apiKey) {
          outputService.error(
            'Not authenticated. Please run "obs login" first.',
          );
          process.exit(1);
        }

        const monitorId = parseInt(id);
        if (isNaN(monitorId)) {
          outputService.error("Invalid monitor ID.");
          process.exit(1);
        }

        const { name, url, interval } = options;
        if (!name && !url && !interval) {
          outputService.error(
            "Please provide at least one field to update (--name, --url, or --interval).",
          );
          process.exit(1);
        }

        outputService.progress(`Updating monitor ${monitorId}...`);
        const existing = await apiClient.getUrlMonitor(monitorId);

        const payload = {
          name: name || existing.name,
          url: url || existing.url,
          timeout_ms: existing.timeout_ms || 30000,
          cron_expression:
            interval || (existing as any).interval || existing.cron_expression,
          alert_on_failure: existing.alert_on_failure ?? true,
        };

        const updatedMonitor = await apiClient.updateUrlMonitor(
          monitorId,
          payload,
        );

        if (process.env.OBS_JSON_OUTPUT === "true") {
          outputService.formatJsonOutput(updatedMonitor);
        } else {
          outputService.success(`Monitor ${monitorId} updated successfully.`);
        }
      } catch (error: any) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });

  // TOGGLE
  monitor
    .command("toggle <id>")
    .description("Pause or resume a URL monitor")
    .option("-j, --json", "Output in JSON format")
    .action(async (id, options) => {
      if (process.env.OBS_JSON_OUTPUT === "true" || options.json) {
        outputService.enableJsonMode();
      }
      try {
        const apiKey = configService.getApiKey();
        if (!apiKey) {
          outputService.error(
            'Not authenticated. Please run "obs login" first.',
          );
          process.exit(1);
        }

        const monitorId = parseInt(id);
        if (isNaN(monitorId)) {
          outputService.error("Invalid monitor ID.");
          process.exit(1);
        }

        if (process.env.OBS_JSON_OUTPUT === "true") {
          outputService.enableJsonMode();
        }

        outputService.progress(`Toggling monitor ${monitorId}...`);
        const isActive = await apiClient.toggleUrlMonitor(monitorId);

        if (process.env.OBS_JSON_OUTPUT === "true") {
          outputService.formatJsonOutput({
            id: monitorId,
            is_active: isActive,
          });
        } else {
          outputService.success(
            `Monitor ${monitorId} is now ${isActive ? "ACTIVE" : "PAUSED"}.`,
          );
        }
      } catch (error: any) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });

  return monitor;
}
