import { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import { IConfigService } from "../interfaces/config.interface.js";
import { IApiClient } from "../interfaces/api-client.interface.js";
import { IOutputService } from "../interfaces/output.interface.js";

/**
 * Factory function to create heartbeat command
 */
export function createHeartbeatCommand(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService,
): Command {
  const heartbeat = new Command("heartbeat").description("Manage heartbeats");

  // LIST
  heartbeat
    .command("list")
    .description("List all heartbeats")
    .option("-f, --format <format>", "Output format (table, json)", "table")
    .option("-j, --json", "Output in JSON format")
    .action(async (options) => {
      if (
        process.env.OBS_JSON_OUTPUT === "true" ||
        options.format === "json" ||
        options.json
      ) {
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

        outputService.progress("Fetching heartbeats...");
        const heartbeats = await apiClient.getHeartbeats();

        if (
          process.env.OBS_JSON_OUTPUT === "true" ||
          options.format === "json"
        ) {
          outputService.formatJsonOutput(heartbeats);
        } else {
          outputService.formatHeartbeatList(
            heartbeats,
            process.env.OBS_VERBOSE === "true",
          );
        }
      } catch (error: any) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });

  // GET
  heartbeat
    .command("get <id>")
    .description("Get details of a heartbeat")
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

        const hbId = parseInt(id);
        if (isNaN(hbId)) {
          outputService.error("Invalid heartbeat ID.");
          process.exit(1);
        }

        outputService.progress(`Fetching heartbeat ${hbId}...`);
        const hbData = await apiClient.getHeartbeat(hbId);

        if (process.env.OBS_JSON_OUTPUT === "true") {
          outputService.formatJsonOutput(hbData);
        } else {
          outputService.formatHeartbeatList([hbData], true);
        }
      } catch (error: any) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });

  // CREATE
  heartbeat
    .command("create")
    .description("Create a new heartbeat")
    .option("-n, --name <name>", "Heartbeat name")
    .option("-p, --period <seconds>", "Expected period in seconds")
    .option("-g, --grace <seconds>", "Grace period in seconds")
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

        let { name, period, grace } = options;

        if (!name) {
          const answers = await inquirer.prompt([
            {
              type: "input",
              name: "name",
              message: "Heartbeat name:",
              validate: (val) => (val.trim() ? true : "Name is required"),
            },
            {
              type: "number",
              name: "period",
              message: "Expected period (seconds):",
              default: 300,
            },
            {
              type: "number",
              name: "grace",
              message: "Grace period (seconds):",
              default: 60,
            },
          ]);
          name = answers.name;
          period = answers.period;
          grace = answers.grace;
        }

        outputService.progress("Creating heartbeat...");
        const newHb = await apiClient.createHeartbeat({
          name,
          period: parseInt(period) || 300,
          grace_period: parseInt(grace) || 60,
          description: "Created via CLI",
        });

        if (process.env.OBS_JSON_OUTPUT === "true") {
          outputService.formatJsonOutput(newHb);
        } else {
          outputService.success(
            `Heartbeat "${newHb.name}" created! UUID: ${newHb.ping_key}`,
          );
          console.log(
            `\nTo ping this heartbeat, send a GET or POST request to:`,
          );
          console.log(
            chalk.cyan(
              `${configService.getApiUrl()}/heartbeats/ping/${newHb.ping_key}`,
            ),
          );
        }
      } catch (error: any) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });

  // UPDATE
  heartbeat
    .command("update <id>")
    .description("Update a heartbeat")
    .option("-n, --name <name>", "New heartbeat name")
    .option("-p, --period <seconds>", "New expected period in seconds")
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

        const hbId = parseInt(id);
        if (isNaN(hbId)) {
          outputService.error("Invalid heartbeat ID.");
          process.exit(1);
        }

        const { name, period } = options;
        if (!name && !period) {
          outputService.error(
            "Please provide at least one field to update (--name or --period).",
          );
          process.exit(1);
        }

        outputService.progress(`Updating heartbeat ${hbId}...`);
        const existing = await apiClient.getHeartbeat(hbId);

        const payload = {
          name: name || existing.name,
          period: period ? parseInt(period) : existing.period,
          description: existing.description || "Updated via CLI",
          grace_period: existing.grace_period || 60,
        };

        const updatedHb = await apiClient.updateHeartbeat(hbId, payload);

        if (process.env.OBS_JSON_OUTPUT === "true") {
          outputService.formatJsonOutput(updatedHb);
        } else {
          outputService.success(`Heartbeat ${hbId} updated successfully.`);
        }
      } catch (error: any) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });

  // DELETE
  heartbeat
    .command("delete <id>")
    .description("Delete a heartbeat")
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

        const hbId = parseInt(id);
        if (isNaN(hbId)) {
          outputService.error("Invalid heartbeat ID.");
          process.exit(1);
        }

        if (!options.yes) {
          const { confirm } = await inquirer.prompt([
            {
              type: "confirm",
              name: "confirm",
              message: `Are you sure you want to delete heartbeat ${hbId}?`,
              default: false,
            },
          ]);
          if (!confirm) return;
        }

        outputService.progress(`Deleting heartbeat ${hbId}...`);
        await apiClient.deleteHeartbeat(hbId);
        if (process.env.OBS_JSON_OUTPUT === "true") {
          outputService.formatJsonOutput({ success: true, id: hbId });
        } else {
          outputService.success(`Heartbeat ${hbId} deleted successfully.`);
        }
      } catch (error: any) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });

  // TOGGLE
  heartbeat
    .command("toggle <id>")
    .description("Pause or resume a heartbeat")
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

        const hbId = parseInt(id);
        if (isNaN(hbId)) {
          outputService.error("Invalid heartbeat ID.");
          process.exit(1);
        }

        outputService.progress(`Toggling heartbeat ${hbId}...`);
        const isActive = await apiClient.toggleHeartbeat(hbId);
        outputService.success(
          `Heartbeat ${hbId} is now ${isActive ? "ACTIVE" : "PAUSED"}.`,
        );
      } catch (error: any) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });

  return heartbeat;
}
