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
import * as http from "http";

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

      // Start local server to receive the callback
      const http = await import("http");
      let server: http.Server; // Declare server variable

      // Set a timeout for the login process
      const loginTimeout = setTimeout(() => {
        OutputFormatter.error("Login timed out after 3 minutes.");
        if (server) {
          server.close();
        }
        process.exit(1);
      }, 180000); // 3 minutes

      server = http.createServer(async (req, res) => {
        const url = new URL(req.url || "", `http://localhost:${port}`);

        // Handle CORS preflight
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") {
          res.writeHead(204);
          res.end();
          return;
        }

        if (url.pathname === "/callback") {
          clearTimeout(loginTimeout); // Clear the timeout on success
          const apiKey = url.searchParams.get("key");

          if (apiKey) {
            // Success response page
            const html = `
              <!DOCTYPE html>
              <html>
              <head>
                <title>Authentication Successful</title>
                <style>
                  body { font-family: system-ui, -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #0a0a0a; color: white; }
                  .container { text-align: center; padding: 2rem; border-radius: 1rem; background: #1a1a1a; border: 1px solid #333; }
                  h1 { color: #4ade80; margin-bottom: 1rem; }
                  p { color: #a1a1aa; }
                </style>
              </head>
              <body>
                <div class="container">
                  <h1>Authentication Successful!</h1>
                  <p>You can close this window and return to the terminal.</p>
                </div>
                <script>setTimeout(() => window.close(), 2000);</script>
              </body>
              </html>
            `;

            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(html);

            // Process the key
            try {
              ConfigManager.setApiKey(apiKey);
              apiClient.setApiKey(apiKey);

              OutputFormatter.progress("Validating API key...");
              const isValid = await apiClient.validateToken();

              if (isValid) {
                OutputFormatter.success("Successfully authenticated!");
                console.log(
                  chalk.gray(`API URL: ${ConfigManager.getApiUrl()}`)
                );

                // Setup project config if needed
                await setupProjectConfig();

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

                server.close();
                process.exit(0);
              } else {
                OutputFormatter.error("Invalid API key received.");
                server.close();
                process.exit(1);
              }
            } catch (error) {
              OutputFormatter.error("Failed to validate API key.");
              server.close();
              process.exit(1);
            }
          } else {
            res.writeHead(400);
            res.end("Missing API key");
          }
        } else {
          res.writeHead(404);
          res.end("Not found");
        }
      });

      // Start server on random port
      const port = await new Promise<number>((resolve, reject) => {
        server.listen(0, "127.0.0.1", () => {
          const addr = server.address();
          if (addr && typeof addr === "object") {
            resolve(addr.port);
          } else {
            reject(new Error("Failed to get server port"));
          }
        });
      });

      // Construct Auth URL
      const authBaseUrl = ConfigManager.getAuthUrl();
      const authUrl = `${authBaseUrl}/cli-login?port=${port}`;

      console.log(chalk.blue("Opening browser for authentication..."));
      console.log(chalk.gray(`Auth URL: ${authUrl}`));
      console.log(
        chalk.gray(
          "If the browser doesn't open automatically, visit the URL above."
        )
      );
      console.log("");
      console.log(chalk.yellow("⏳ Waiting for authentication..."));

      // Open browser
      try {
        const platform = process.platform;
        let command: string;
        if (platform === "win32") command = `start ${authUrl}`;
        else if (platform === "darwin") command = `open ${authUrl}`;
        else command = `xdg-open ${authUrl}`;

        await execAsync(command);
      } catch (error) {
        // Ignore open errors, user can copy link
      }

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
