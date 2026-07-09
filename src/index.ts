#!/usr/bin/env node

// Silence dotenv/dotenvx before anything else
process.env.DOTENV_QUIET = 'true';
process.env.DOTENV_CONFIG_SILENT = 'true';

import { Command } from 'commander';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });
import chalk from 'chalk';
import { readFileSync } from 'fs';

// Import services
import { ConfigService } from './services/config.service.js';
import { ApiClient } from './services/api-client.service.js';
import { OutputService } from './services/output.service.js';
import { UpdateService } from './services/update.service.js';

// Import command factories
import { createLoginCommand } from './commands/login.js';
import { createLogoutCommand } from './commands/logout.js';
import { createInitCommand } from './commands/init.js';
import { createValidateCommand } from './commands/validate.js';
import { createMonitorCommand } from './commands/monitor.js';
import { createCheckCommand } from './commands/check.js';
import { createHeartbeatCommand } from './commands/heartbeat.js';
import { createEnvironmentCommand } from './commands/environment.js';
import { createApplyCommand } from './commands/apply.js';
import { createExportCommand } from './commands/export.js';
import { createAlertChannelCommand } from './commands/alert-channel.js';
import { createStatusPageCommand } from './commands/status-page.js';
import { createIncidentCommand } from './commands/incident.js';
import { createSuiteCommand } from './commands/suite/index.js';
import { createSchemaCommand } from './commands/schema.js';
import { createTemplatesCommand } from './commands/templates.js';
import { createApiKeyCommand } from './commands/api-key.js';
import { createTeamCommand } from './commands/team.js';

const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
) as { version: string };
const { version } = packageJson;

// Create services directly
const configService = new ConfigService();
const outputService = new OutputService();
const apiClient = new ApiClient(configService, version);
const updateService = new UpdateService(version);

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
program.exitOverride((err) => {
  const code = (err as { code?: string })?.code || '';
  if (code === 'commander.helpDisplayed' || code === 'commander.version') {
    process.exit(0);
  }
  throw err;
});

// Add commands with services
program.addCommand(createLoginCommand(configService, apiClient, outputService));
program.addCommand(createLogoutCommand(configService, outputService));
program.addCommand(createInitCommand(configService, outputService));
program.addCommand(createMonitorCommand(configService, apiClient, outputService));
program.addCommand(createCheckCommand(configService, apiClient, outputService));
program.addCommand(createHeartbeatCommand(configService, apiClient, outputService));
program.addCommand(createEnvironmentCommand(configService, apiClient, outputService));
program.addCommand(createApplyCommand(configService, apiClient, outputService));
program.addCommand(createExportCommand(configService, apiClient, outputService));
program.addCommand(createAlertChannelCommand(configService, apiClient, outputService));
program.addCommand(createStatusPageCommand(configService, apiClient, outputService));
program.addCommand(createIncidentCommand(configService, apiClient, outputService));
program.addCommand(createValidateCommand(outputService));
program.addCommand(createSuiteCommand(configService, apiClient, outputService));
program.addCommand(createSchemaCommand(outputService));
program.addCommand(createTemplatesCommand(outputService));
program.addCommand(createApiKeyCommand(configService, apiClient, outputService));
program.addCommand(createTeamCommand(configService, apiClient, outputService));

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
    configService.setCommandLineApiUrl(options.apiUrl as string);
  }

  if (options.apiKey) {
    // Keep the provided key in-memory for this session only. Do NOT persist it to
    // the global Conf store before it is validated — an invalid --api-key must
    // never be written to disk. The runtime override reaches per-call readers
    // (sse-client, command bodies); apiClient caches its key at construction
    // (before this hook), so push it onto the live client too.
    configService.setCommandLineApiKey(options.apiKey as string);
    apiClient.setApiKey(options.apiKey as string);
  }
});

// Error handling
program.configureOutput({
  writeErr: (str) => process.stderr.write(str),
  writeOut: (str) => process.stdout.write(str),
});

// Helper for formatting fatal errors
function handleFatalError(error: unknown, prefix: string) {
  const err = error as { message?: string; code?: string; stack?: string };
  const msg = err?.message || '';
  const code = err?.code || '';

  if (
    msg.includes('(outputHelp)') ||
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
        message: msg || (typeof error === 'string' ? error : 'Unknown fatal error'),
      },
      metadata: {
        timestamp: new Date().toISOString(),
      },
    };
    console.log(JSON.stringify(envelope, null, 2));
  } else {
    console.error(chalk.red(`❌ ${prefix}:`), msg || error);
    if (process.env.OBS_VERBOSE === 'true' && err?.stack) {
      console.error(err.stack);
    }
  }
  process.exit(1);
}

// Handle uncaught errors
process.on('uncaughtException', (error: Error) => {
  handleFatalError(error, 'Uncaught Exception');
});

process.on('unhandledRejection', (reason: unknown) => {
  handleFatalError(reason, 'Unhandled Rejection');
});

const isVersionRequest = process.argv.includes('--version') || process.argv.includes('-V');

// Parse arguments with safety net for help/version
const run = async () => {
  try {
    if (isVersionRequest) {
      await updateService.checkForUpdates(outputService);
    } else {
      // Check for updates in background (don't await to avoid delaying command execution)
      updateService.checkForUpdates(outputService).catch(() => {
        // Silently ignore background update check errors
      });
    }

    program.parse();
  } catch (err: unknown) {
    handleFatalError(err, 'Parse Error');
  }
};

void run();

export { program };
