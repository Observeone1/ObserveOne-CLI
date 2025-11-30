import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import { existsSync, writeFileSync } from "fs";
import { join } from "path";
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
      console.log(
        chalk.gray("We'll open your browser to authenticate with ObserveOne")
      );
      console.log("");

      // Generate a unique state parameter for security
      const state =
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);

      // Get environment-specific URLs
      const authBaseUrl = ConfigManager.getAuthUrl();
      const apiUrl = ConfigManager.getApiUrl();

      // Start the authentication flow
      OutputFormatter.progress("Initializing authentication...");

      try {
        // Call the backend to start CLI authentication
        const authResponse = await apiClient.post("/auth/cli-auth", {
          state,
          redirect_uri: "polling", // Changed from callback URL
        });

        // Prefer server-provided URL; fallback to common fields; finally construct from auth base URL
        let authUrl: string | undefined =
          authResponse?.data?.authUrl ||
          authResponse?.data?.url ||
          authResponse?.data?.auth_url;

        if (!authUrl && authBaseUrl) {
          const sep = authBaseUrl.endsWith("/") ? "" : "/";
          authUrl = `${authBaseUrl}${sep}auth/cli?state=${encodeURIComponent(
            state
          )}&redirect=polling`;
        }

        if (!authUrl) {
          throw new Error(
            "Authentication URL was not provided by server and could not be constructed."
          );
        }

        console.log(chalk.blue("Opening browser for authentication..."));
        console.log(
          chalk.gray(
            `Environment: ${
              ConfigManager.isDevelopment() ? "Development" : "Production"
            }`
          )
        );
        console.log(chalk.gray(`Auth URL: ${authBaseUrl}`));
        console.log(chalk.gray(`API URL: ${apiUrl}`));
        console.log(
          chalk.gray(`If the browser doesn't open automatically, visit:`)
        );
        console.log(chalk.blue(authUrl));
        console.log("");

        // Try to open the browser
        try {
          const platform = process.platform;
          let command: string;

          if (platform === "win32") {
            command = `start ${authUrl}`;
          } else if (platform === "darwin") {
            command = `open ${authUrl}`;
          } else {
            command = `xdg-open ${authUrl}`;
          }

          await execAsync(command);
        } catch (error) {
          console.log(
            chalk.yellow(
              "Could not open browser automatically. Please visit the URL above."
            )
          );
        }

        // Poll for authentication completion
        console.log(chalk.yellow("⏳ Waiting for authentication..."));
        console.log(chalk.gray("1. Complete login in your browser"));
        console.log(
          chalk.gray("2. Authentication will be detected automatically")
        );
        console.log("");

        const maxAttempts = 60; // 5 minutes
        const pollInterval = 5000; // 5 seconds

        for (let i = 0; i < maxAttempts; i++) {
          try {
            const statusResponse = await apiClient.get(
              `/auth/cli-status/${state}`
            );

            if (
              statusResponse.data.authenticated &&
              statusResponse.data.apiKey
            ) {
              const apiKey = statusResponse.data.apiKey;

              // Store the API key and validate it
              ConfigManager.setApiKey(apiKey);
              apiClient.setApiKey(apiKey);

              // Validate the API key
              OutputFormatter.progress("Validating API key...");
              const isValid = await apiClient.validateToken();

              if (isValid) {
                OutputFormatter.success("Successfully authenticated!");
                console.log(
                  chalk.gray(`API URL: ${ConfigManager.getApiUrl()}`)
                );
                console.log(
                  chalk.gray(
                    `Config saved to: ${ConfigManager.getConfigPath()}`
                  )
                );

                // Setup project configuration if .obs1.config.json doesn't exist
                const configPath = ".obs1.config.json";
                if (!existsSync(configPath)) {
                  console.log(
                    chalk.bold("\n🚀 Setting up project configuration...")
                  );

                  const projectAnswers = await inquirer.prompt([
                    {
                      type: "input",
                      name: "projectName",
                      message: "Project name:",
                      default:
                        process.cwd().split(/[/\\]/).pop() || "My Project",
                      validate: (input: string) => {
                        if (!input.trim()) {
                          return "Project name is required";
                        }
                        return true;
                      },
                    },
                    {
                      type: "input",
                      name: "projectDescription",
                      message: "Project description:",
                      default: "AI-powered test automation project",
                    },
                  ]);

                  // Create project configuration
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

                  writeFileSync(
                    configPath,
                    JSON.stringify(projectConfig, null, 2)
                  );
                  ConfigManager.setProjectConfig(projectConfig.project);
                  ConfigManager.setDefaultOptions(projectConfig.defaultOptions);

                  OutputFormatter.success("Project configuration created!");
                  console.log(
                    chalk.gray(
                      `Configuration saved to: ${join(
                        process.cwd(),
                        configPath
                      )}`
                    )
                  );
                }

                console.log("");
                console.log(chalk.bold("Next steps:"));
                console.log(
                  chalk.gray('1. Run "obs1 list" to see available tests')
                );
                console.log(
                  chalk.gray(
                    '2. Run "obs1 ai-check <test-name>" to execute tests'
                  )
                );
                return;
              } else {
                OutputFormatter.error(
                  "Invalid API key received. Please try again."
                );
                process.exit(1);
              }
            }
          } catch (pollError) {
            // Continue polling on error
          }

          await new Promise((resolve) => setTimeout(resolve, pollInterval));
        }

        OutputFormatter.error("Authentication timed out. Please try again.");
        process.exit(1);
      } catch (error: any) {
        console.log(error);
        OutputFormatter.error(`Authentication failed: ${error.message}`);
        process.exit(1);
      }
    } catch (error: any) {
      OutputFormatter.error(OutputFormatter.formatError(error));
      process.exit(1);
    }
  });
