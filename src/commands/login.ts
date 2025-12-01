import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import { existsSync, writeFileSync } from "fs";
import { ConfigManager } from "../utils/config.js";
import { ApiClient } from "../utils/api-client.js";
import { OutputFormatter } from "../utils/output.js";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const loginCommand = new Command("login")
  .description("Authenticate with ObserveOne platform")
  .option("-k, --api-key <key>", "API key to use for authentication")
  .action(async (options) => {
    try {
      const apiClient = new ApiClient();

      // If API key is provided via option, use it
      if (options.apiKey) {
        ConfigManager.setApiKey(options.apiKey);
        apiClient.setApiKey(options.apiKey);

        // Validate the API key
        const isValid = await apiClient.validateToken();
        if (isValid) {
          OutputFormatter.success(
            "Successfully authenticated with provided API key"
          );
          return;
        } else {
          OutputFormatter.error("Invalid API key provided");
          process.exit(1);
        }
      }

      // Browser-based authentication flow
      console.log(chalk.bold("\n🔐 ObserveOne Authentication"));

      // Request auth session
      OutputFormatter.progress("Requesting authentication session...");
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
        const platform = process.platform;
        let command: string;
        if (platform === "win32") command = `start "" "${auth_url}"`;
        else if (platform === "darwin") command = `open "${auth_url}"`;
        else command = `xdg-open "${auth_url}"`;

        await execAsync(command);
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
            ConfigManager.setApiKey(status.api_key);
            ConfigManager.setApiUrl(ConfigManager.getApiUrl());
            apiClient.setApiKey(status.api_key);

            OutputFormatter.success("Successfully authenticated!");

            // Setup project config if needed
            await setupProjectConfig();

            console.log("");
            console.log(chalk.bold("Next steps:"));
            console.log(
              chalk.gray('1. Run "obs1 list" to see available tests')
            );
            console.log(
              chalk.gray('2. Run "obs1 ai-check <test-name>" to execute tests')
            );

            process.exit(0);
          } else if (status.status === "denied") {
            OutputFormatter.error("Authentication denied by user.");
            process.exit(1);
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

      OutputFormatter.error("Authentication timed out.");
      process.exit(1);

      // Helper for project setup (extracted from original code)
      async function setupProjectConfig() {
        const configPath = ".obs1.config.json";
        if (!existsSync(configPath)) {
          console.log(chalk.bold("\n🚀 Setting up project configuration..."));

          const projectAnswers = await inquirer.prompt([
            {
              type: "input",
              name: "projectName",
              message: "Project name:",
              default: process.cwd().split(/[/\\]/).pop() || "My Project",
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

          writeFileSync(configPath, JSON.stringify(projectConfig, null, 2));
          ConfigManager.setProjectConfig(projectConfig.project);
          ConfigManager.setDefaultOptions(projectConfig.defaultOptions);
          OutputFormatter.success("Project configuration created!");
        }
      }
    } catch (error: any) {
      OutputFormatter.error(OutputFormatter.formatError(error));
      process.exit(1);
    }
  });
