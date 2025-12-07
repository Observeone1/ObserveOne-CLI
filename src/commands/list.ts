import { Command } from "commander";
import { Container } from "../di/container.js";
import {
  CONFIG_SERVICE,
  API_CLIENT,
  OUTPUT_SERVICE,
  PROCESS,
} from "../di/service-tokens.js";
import { IConfigService } from "../interfaces/config.interface.js";
import { IApiClient } from "../interfaces/api-client.interface.js";
import { IOutputService } from "../interfaces/output.interface.js";
import { IProcessService } from "../interfaces/process.interface.js";

/**
 * Factory function to create list command with DI
 */
export function createListCommand(container: Container): Command {
  const configService = container.resolve<IConfigService>(CONFIG_SERVICE);
  const apiClient = container.resolve<IApiClient>(API_CLIENT);
  const outputService = container.resolve<IOutputService>(OUTPUT_SERVICE);
  const processService = container.resolve<IProcessService>(PROCESS);

  return new Command("list")
    .description("List all available tests")
    .option("-f, --format <format>", "Output format (table, json)", "table")
    .option("--api-url <url>", "Override API URL")
    .option("--api-key <key>", "Override API key")
    .action(async (options) => {
      try {
        // Handle API URL override first, before other operations
        if (options.apiUrl) {
          configService.setCommandLineApiUrl(options.apiUrl);
        }

        // Handle API key override
        if (options.apiKey) {
          configService.setApiKey(options.apiKey);
        }

        const apiKey = configService.getApiKey();
        if (!apiKey) {
          outputService.error(
            'Not authenticated. Please run "obs1 login" first.'
          );
          processService.exit(1);
        }

        outputService.progress("Fetching tests...");

        const tests = await apiClient.getTests();

        if (
          processService.getEnv("OBS_JSON_OUTPUT") === "true" ||
          options.format === "json"
        ) {
          outputService.formatJsonOutput(tests);
        } else {
          const isVerbose = processService.getEnv("OBS_VERBOSE") === "true";
          outputService.formatTestList(tests, isVerbose);
        }
      } catch (error: any) {
        outputService.error(outputService.formatError(error));
        processService.exit(1);
      }
    });
}
