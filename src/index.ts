#!/usr/bin/env node

import { Command } from "commander";
import "dotenv/config";
import chalk from "chalk";
import { readFileSync } from "fs";

// Import services
import { ConfigService } from "./services/config.service.js";
import { ApiClient } from "./services/api-client.service.js";
import { OutputService } from "./services/output.service.js";

// Import command factories
import { createLoginCommand } from "./commands/login.js";
import { createListCommand } from "./commands/list.js";
import { createAiCheckCommand } from "./commands/ai-check.js";

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
);
const { version } = packageJson;

// Create services directly
const configService = new ConfigService();
const outputService = new OutputService();
const apiClient = new ApiClient(configService);

const program = new Command();

// Set up the main program
program
  .name("obs")
  .description(
    "ObserveOne CLI - AI-powered website monitoring and testing from the command line"
  )
  .version(version)
  .option("-v, --verbose", "Enable verbose output")
  .option("--json", "Output in JSON format")
  .option("--api-url <url>", "Override API URL")
  .option("--api-key <key>", "Override API key");

// Global error handler: don't treat help/version as errors
program.exitOverride((err) => {
  const anyErr: any = err as any;
  const code = anyErr?.code || "";
  if (code === "commander.helpDisplayed" || code === "commander.version") {
    process.exit(0);
  }
  throw err;
});

// Add commands with services
program.addCommand(createLoginCommand(configService, apiClient, outputService));
program.addCommand(createListCommand(configService, apiClient, outputService));
program.addCommand(createAiCheckCommand(configService, apiClient, outputService));

// Global options handler
program.hook("preAction", (thisCommand) => {
  const options = thisCommand.opts();

  // Set global options
  if (options.verbose) {
    process.env.OBS_VERBOSE = "true";
  }

  if (options.json) {
    process.env.OBS_JSON_OUTPUT = "true";
  }

  if (options.apiUrl) {
    configService.setCommandLineApiUrl(options.apiUrl);
  }

  if (options.apiKey) {
    configService.setApiKey(options.apiKey);
  }
});

// Error handling
program.configureOutput({
  writeErr: (str) => process.stderr.write(str),
  writeOut: (str) => process.stdout.write(str),
});

// Handle uncaught errors
process.on("uncaughtException", (error: any) => {
  const msg = error?.message || "";
  const code = error?.code || "";
  if (
    msg.includes("(outputHelp)") ||
    code === "commander.helpDisplayed" ||
    code === "commander.version"
  ) {
    // Treat help/version display as normal exit
    process.exit(0);
    return;
  }
  console.error(chalk.red("❌ Uncaught Exception:"), msg);
  if (process.env.OBS_VERBOSE === "true") {
    console.error(error.stack);
  }
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error(chalk.red("❌ Unhandled Rejection:"), reason);
  process.exit(1);
});

// Parse arguments with safety net for help/version
try {
  program.parse();
} catch (err: any) {
  const msg = err?.message || "";
  const code = err?.code || "";
  if (
    msg.includes("(outputHelp)") ||
    code === "commander.helpDisplayed" ||
    code === "commander.version"
  ) {
    process.exit(0);
  }
  throw err;
}

export { program };
