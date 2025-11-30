import { Command } from "commander";
import chalk from "chalk";
import { ConfigManager } from "../utils/config.js";
import { ApiClient } from "../utils/api-client.js";
import { OutputFormatter } from "../utils/output.js";

export const listCommand = new Command("list")
  .description("List all available tests")
  .option("-f, --format <format>", "Output format (table, json)", "table")
  .action(async (options) => {
    try {
      const apiKey = ConfigManager.getApiKey();
      if (!apiKey) {
        OutputFormatter.error(
          'Not authenticated. Please run "obs1 login" first.'
        );
        process.exit(1);
      }

      const apiClient = new ApiClient();
      OutputFormatter.progress("Fetching tests...");

      const tests = await apiClient.getTests();

      if (
        process.env.OBS1_JSON_OUTPUT === "true" ||
        options.format === "json"
      ) {
        OutputFormatter.formatJsonOutput(tests);
      } else {
        OutputFormatter.formatTestList(tests);
      }
    } catch (error: any) {
      OutputFormatter.error(OutputFormatter.formatError(error));
      process.exit(1);
    }
  });
