import { Command } from "commander";
import inquirer from "inquirer";
import { IConfigService } from "../interfaces/config.interface.js";
import { IApiClient } from "../interfaces/api-client.interface.js";
import { IOutputService } from "../interfaces/output.interface.js";

/**
 * Factory function to create check command (API Checks)
 */
export function createCheckCommand(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService,
): Command {
  const check = new Command("check").description("Manage API checks");

  // LIST
  check
    .command("list")
    .description("List all API checks")
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

        outputService.progress("Fetching API checks...");
        const checks = await apiClient.getApiChecks();

        if (
          process.env.OBS_JSON_OUTPUT === "true" ||
          options.format === "json"
        ) {
          outputService.formatJsonOutput(checks);
        } else {
          outputService.formatApiCheckList(
            checks,
            process.env.OBS_VERBOSE === "true",
          );
        }
      } catch (error: any) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });

  // GET
  check
    .command("get <id>")
    .description("Get details of an API check")
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

        const checkId = parseInt(id);
        if (isNaN(checkId)) {
          outputService.error("Invalid check ID.");
          process.exit(1);
        }

        outputService.progress(`Fetching API check ${checkId}...`);
        const checkData = await apiClient.getApiCheck(checkId);

        if (process.env.OBS_JSON_OUTPUT === "true") {
          outputService.formatJsonOutput(checkData);
        } else {
          outputService.formatApiCheckList([checkData], true);
        }
      } catch (error: any) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });

  // CREATE
  check
    .command("create")
    .description("Create a new API check")
    .option("-n, --name <name>", "Check name")
    .option("-u, --url <url>", "API URL")
    .option("-m, --method <method>", "HTTP method (GET, POST, etc.)", "GET")
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

        let { name, url, method } = options;

        if (!name || !url) {
          const answers = await inquirer.prompt([
            {
              type: "input",
              name: "name",
              message: "Check name:",
              when: !name,
              validate: (val) => (val.trim() ? true : "Name is required"),
            },
            {
              type: "input",
              name: "url",
              message: "API URL:",
              when: !url,
              validate: (val) => (val.trim() ? true : "URL is required"),
            },
            {
              type: "list",
              name: "method",
              message: "HTTP Method:",
              choices: [
                "GET",
                "POST",
                "PUT",
                "DELETE",
                "PATCH",
                "HEAD",
                "OPTIONS",
              ],
              when: !method || method === "GET",
              default: "GET",
            },
          ]);
          name = name || answers.name;
          url = url || answers.url;
          method = method || answers.method;
        }

        outputService.progress("Creating API check...");
        const newCheck = await apiClient.createApiCheck({
          name,
          url,
          method: method.toUpperCase(),
          timeout_ms: 30000,
          alert_on_failure: true,
        });

        if (process.env.OBS_JSON_OUTPUT === "true") {
          outputService.formatJsonOutput(newCheck);
        } else {
          outputService.success(
            `API check "${newCheck.name}" created successfully (ID: ${newCheck.id})`,
          );
        }
      } catch (error: any) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });

  // DELETE
  check
    .command("delete <id>")
    .description("Delete an API check")
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

        const checkId = parseInt(id);
        if (isNaN(checkId)) {
          outputService.error("Invalid check ID.");
          process.exit(1);
        }

        if (!options.yes) {
          const { confirm } = await inquirer.prompt([
            {
              type: "confirm",
              name: "confirm",
              message: `Are you sure you want to delete check ${checkId}?`,
              default: false,
            },
          ]);
          if (!confirm) return;
        }

        outputService.progress(`Deleting check ${checkId}...`);
        await apiClient.deleteApiCheck(checkId);
        outputService.success(`API check ${checkId} deleted successfully.`);
      } catch (error: any) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });

  // TOGGLE
  check
    .command("toggle <id>")
    .description("Pause or resume an API check")
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

        const checkId = parseInt(id);
        if (isNaN(checkId)) {
          outputService.error("Invalid check ID.");
          process.exit(1);
        }

        outputService.progress(`Toggling check ${checkId}...`);
        const isActive = await apiClient.toggleApiCheck(checkId);
        outputService.success(
          `API check ${checkId} is now ${isActive ? "ACTIVE" : "PAUSED"}.`,
        );
      } catch (error: any) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });

  // UPDATE
  check
    .command("update <id>")
    .description("Update an API check")
    .option("-n, --name <name>", "New check name")
    .option("-u, --url <url>", "New API URL")
    .option("-m, --method <method>", "New HTTP method")
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

        const checkId = parseInt(id);
        if (isNaN(checkId)) {
          outputService.error("Invalid check ID.");
          process.exit(1);
        }

        const { name, url, method } = options;
        if (!name && !url && !method) {
          outputService.error(
            "Please provide at least one field to update (--name, --url, or --method).",
          );
          process.exit(1);
        }

        outputService.progress(`Updating check ${checkId}...`);
        const existing = await apiClient.getApiCheck(checkId);

        const payload = {
          name: name || existing.name,
          url: url || existing.url,
          method: method ? method.toUpperCase() : existing.method || "GET",
          timeout_ms: existing.timeout_ms || 30000,
          alert_on_failure: existing.alert_on_failure ?? true,
        };

        const updatedCheck = await apiClient.updateApiCheck(checkId, payload);

        if (process.env.OBS_JSON_OUTPUT === "true") {
          outputService.formatJsonOutput(updatedCheck);
        } else {
          outputService.success(`API check ${checkId} updated successfully.`);
        }
      } catch (error: any) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });

  return check;
}
