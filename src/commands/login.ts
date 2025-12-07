import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import { Container } from "../di/container.js";
import {
  CONFIG_SERVICE,
  API_CLIENT,
  OUTPUT_SERVICE,
  FILE_SYSTEM,
  PROCESS,
} from "../di/service-tokens.js";
import { IConfigService } from "../interfaces/config.interface.js";
import { IApiClient } from "../interfaces/api-client.interface.js";
import { IOutputService } from "../interfaces/output.interface.js";
import { IFileSystem } from "../interfaces/file-system.interface.js";
import { IProcessService } from "../interfaces/process.interface.js";

/**
 * Factory function to create login command with DI
 */
export function createLoginCommand(container: Container): Command {
  const configService = container.resolve<IConfigService>(CONFIG_SERVICE);
  const apiClient = container.resolve<IApiClient>(API_CLIENT);
  const outputService = container.resolve<IOutputService>(OUTPUT_SERVICE);
  const fileSystem = container.resolve<IFileSystem>(FILE_SYSTEM);
  const processService = container.resolve<IProcessService>(PROCESS);

  return new Command("login")
    .description("Authenticate with ObserveOne platform")
    .option("-k, --api-key <key>", "API key to use for authentication")
    .option("--skip-setup", "Skip project configuration setup")
    .action(async (options) => {
      try {
        // Check for API key in command option first (highest priority)
        let apiKeyToUse = options.apiKey;

        // If no explicit command option but global option was set, use that
        if (!apiKeyToUse) {
          apiKeyToUse = configService.getApiKey();
        }

        // If an API key is available (from either source), try to authenticate
        if (apiKeyToUse) {
          // Use the API key that was provided
          configService.setApiKey(apiKeyToUse);
          apiClient.setApiKey(apiKeyToUse);

          // Validate the API key
          const isValid = await apiClient.validateToken();
          if (isValid) {
            outputService.success(
              "Successfully authenticated with provided API key"
            );

            // Setup project config if needed (skip in test mode)
            if (!options.skipSetup) {
              await setupProjectConfig(
                fileSystem,
                processService,
                configService,
                outputService
              );
            }

            processService.exit(0);
            return;
          } else {
            outputService.error("Invalid API key provided");
            processService.exit(1);
            return;
          }
        }

        // Browser-based authentication flow
        console.log(chalk.bold("\n🔐 ObserveOne Authentication"));

        // Request auth session
        outputService.progress("Requesting authentication session...");
        const { request_id, auth_url } = await apiClient.requestCliAuth();

        console.log(
          chalk.gray("We'll open your browser to authenticate with ObserveOne")
        );
        console.log("");
        console.log(chalk.blue("Opening browser for authentication..."));
        console.log(chalk.gray(`Auth URL: ${auth_url}`));
        console.log(
          chalk.gray(
            "If the browser doesn't open automatically, visit the URL above."
          )
        );
        console.log("");
        console.log(chalk.yellow("⏳ Waiting for authentication..."));

        try {
          const platform = processService.getPlatform();
          let command: string;
          if (platform === "win32") command = `start "" "${auth_url}"`;
          else if (platform === "darwin") command = `open "${auth_url}"`;
          else command = `xdg-open "${auth_url}"`;

          await processService.exec(command);
        } catch (error) {
          // Ignore open errors, user can copy link
        }

        // Poll for status
        const maxAttempts = 60; // 5 minutes (5s interval)
        const intervalMs = 5000;
        let attempts = 0;

        while (attempts < maxAttempts) {
          try {
            const status = await apiClient.checkCliAuthStatus(request_id);

            if (status.status === "approved" && status.api_key) {
              configService.setApiKey(status.api_key);
              configService.setApiUrl(configService.getApiUrl());
              apiClient.setApiKey(status.api_key);

              outputService.success("Successfully authenticated!");

              // Setup project config if needed
              await setupProjectConfig(
                fileSystem,
                processService,
                configService,
                outputService
              );

              console.log("");
              console.log(chalk.bold("Next steps:"));
              console.log(
                chalk.gray('1. Run "obs list" to see available tests')
              );
              console.log(
                chalk.gray(
                  '2. Run "obs ai-check <test-name>" to execute tests'
                )
              );

              processService.exit(0);
            } else if (status.status === "denied") {
              outputService.error("Authentication denied by user.");
              processService.exit(1);
            }

            // Wait before next poll
            await new Promise((resolve) => setTimeout(resolve, intervalMs));
            attempts++;
          } catch (error) {
            // If 404 or other error, might be expired or invalid
            attempts++;
            await new Promise((resolve) => setTimeout(resolve, intervalMs));
          }
        }

        outputService.error("Authentication timed out.");
        processService.exit(1);
      } catch (error: any) {
        outputService.error(outputService.formatError(error));
        processService.exit(1);
      }
    });
}

/**
 * Helper function for project configuration setup
 */
async function setupProjectConfig(
  fileSystem: IFileSystem,
  processService: IProcessService,
  configService: IConfigService,
  outputService: IOutputService
): Promise<void> {
  const configPath = ".obs.config.json";
  if (!fileSystem.existsSync(configPath)) {
    console.log(chalk.bold("\n🚀 Setting up project configuration..."));

    const projectAnswers = await inquirer.prompt([
      {
        type: "input",
        name: "projectName",
        message: "Project name:",
        default: processService.getCwd().split(/[/\\]/).pop() || "My Project",
        validate: (input: string) =>
          input.trim() ? true : "Project name is required",
      },
      {
        type: "input",
        name: "projectDescription",
        message: "Project description:",
        default: "AI-powered test automation project",
      },
    ]);

    const projectConfig = {
      project: {
        name: projectAnswers.projectName,
        description: projectAnswers.projectDescription,
      },
      defaultOptions: {
        timeout: 600000,
        retries: 3,
        verbose: false,
        pollIntervalMs: 2000,
        maxAttempts: 300,
      },
    };

    fileSystem.writeFileSync(
      configPath,
      JSON.stringify(projectConfig, null, 2)
    );
    configService.setProjectConfig(projectConfig.project);
    configService.setDefaultOptions(projectConfig.defaultOptions);
    outputService.success("Project configuration created!");
  }
}
