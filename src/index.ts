#!/usr/bin/env node

// Silence dotenv/dotenvx before anything else
process.env.DOTENV_QUIET = 'true';
process.env.DOTENV_CONFIG_SILENT = 'true';

import { Command, CommanderError } from 'commander';
import dotenv from 'dotenv';

dotenv.config();
import chalk from 'chalk';
import { readFileSync } from 'fs';

// Import services
import { ConfigService } from './services/config.service.js';
import { ApiClient } from './services/api-client.service.js';
import { OutputService } from './services/output.service.js';

// Import command factories
import { createLoginCommand } from './commands/login.js';
import { createAiCheckCommand } from './commands/ai-check.js';
import { createMonitorCommand } from './commands/monitor.js';
import { createCheckCommand } from './commands/check.js';
import { createHeartbeatCommand } from './commands/heartbeat.js';
import { createApplyCommand } from './commands/apply.js';
import { createExportCommand } from './commands/export.js';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const { version } = packageJson;

// Create services directly
const configService = new ConfigService();
const outputService = new OutputService();
const apiClient = new ApiClient(configService, version);

const program = new Command();

// Set up the main program
program
  .name('obs')
  .description('ObserveOne CLI - AI-powered website monitoring and testing from the command line')
  .version(version)
  .option('-v, --verbose', 'Enable verbose output')
  .option('--json', 'Output in JSON format')
  .option('--api-url <url>', 'Override API URL')
  .option('--api-key <key>', 'Override API key');

// Global error handler: don't treat help/version as errors
program.exitOverride((err: CommanderError) => {
  const code = err?.code || '';
  if (code === 'commander.helpDisplayed' || code === 'commander.version') {
    process.exit(0);
  }
  throw err;
});

// Add commands with services
program.addCommand(createLoginCommand(configService, apiClient, outputService));
program.addCommand(createAiCheckCommand(configService, apiClient, outputService));
program.addCommand(createMonitorCommand(configService, apiClient, outputService));
program.addCommand(createCheckCommand(configService, apiClient, outputService));
program.addCommand(createHeartbeatCommand(configService, apiClient, outputService));
program.addCommand(createApplyCommand(configService, apiClient, outputService));
program.addCommand(createExportCommand(configService, apiClient, outputService));

// Global options handler
program.hook('preAction', (thisCommand) => {
  const options = thisCommand.opts();

  // Set global options
  if (options.verbose) {
    process.env.OBS_VERBOSE = 'true';
  }

  if (options.json) {
    process.env.OBS_JSON_OUTPUT = 'true';
    outputService.enableJsonMode();
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

// Helper for formatting fatal errors
function isErrorWithCode(
  value: unknown
): value is { message?: string; code?: string; stack?: string } {
  return typeof value === 'object' && value !== null;
}

function handleFatalError(error: unknown, prefix: string) {
  const message = isErrorWithCode(error) && typeof error.message === 'string' ? error.message : '';
  const code = isErrorWithCode(error) && typeof error.code === 'string' ? error.code : '';
  if (
    message.includes('(outputHelp)') ||
    code === 'commander.helpDisplayed' ||
    code === 'commander.version'
  ) {
    process.exit(0);
    return;
  }

  if (process.env.OBS_JSON_OUTPUT === 'true' || process.argv.includes('--json')) {
    const envelope = {
      status: 'ERROR',
      error: {
        message: message || (typeof error === 'string' ? error : 'Unknown fatal error'),
      },
      metadata: {
        timestamp: new Date().toISOString(),
      },
    };
    console.log(JSON.stringify(envelope, null, 2));
  } else {
    console.error(chalk.red(`❌ ${prefix}:`), message || error);
    if (process.env.OBS_VERBOSE === 'true' && isErrorWithCode(error) && error.stack) {
      console.error(error.stack);
    }
  }
  process.exit(1);
}

// Handle uncaught errors
process.on('uncaughtException', (error: unknown) => {
  handleFatalError(error, 'Uncaught Exception');
});

process.on('unhandledRejection', (reason: unknown) => {
  handleFatalError(reason, 'Unhandled Rejection');
});

// Parse arguments with safety net for help/version
try {
  program.parse();
} catch (err) {
  handleFatalError(err, 'Parse Error');
}

export { program };
