import { Command } from 'commander';
import chalk from 'chalk';
import { brand } from '../utils/theme.js';
import { IConfigService } from '../interfaces/config.interface.js';
import { IApiClient } from '../interfaces/api-client.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';
import open from 'open';

/** Runs the `--headless` (email/password → M2M API key) auth flow. Always exits the process. */
async function runHeadlessAuth(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService,
  options: Record<string, unknown>
): Promise<never> {
  const email = process.env.OBS_EMAIL;
  const password = process.env.OBS_PASSWORD;

  if (!email || !password) {
    outputService.error(
      'Headless authentication requires OBS_EMAIL and OBS_PASSWORD environment variables.'
    );
    process.exit(1);
  }

  outputService.progress('Provisioning headless M2M API key...');
  try {
    const { api_key } = await apiClient.provisionHeadlessAuth(email, password);
    configService.setApiKey(api_key);
    configService.setApiUrl(configService.getApiUrl());
    apiClient.setApiKey(api_key);
    if (process.env.OBS_JSON_OUTPUT === 'true' || options.json === true) {
      outputService.formatJsonOutput({ authenticated: true });
    } else {
      outputService.success('Successfully authenticated headlessly!');
      if (!options.skipSetup) {
        outputService.warning('Skipping interactive project setup in headless mode.');
      }
    }
    process.exit(0);
  } catch (error: unknown) {
    const err = error as { message?: string };
    outputService.error(`Headless authentication failed: ${err.message || 'Unknown error'}`);
    process.exit(1);
  }
}

/**
 * Try authenticating with an already-known API key (from `--api-key` or a
 * previously-saved one). Returns without exiting when no key is available, so
 * the caller falls through to the browser-based flow.
 */
async function tryApiKeyAuth(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService,
  options: Record<string, unknown>
): Promise<void> {
  if (options.apiKey) {
    configService.setCommandLineApiKey(options.apiKey as string);
  }

  const apiKey = configService.getApiKey();

  // Check for API key in command option first (highest priority)
  let apiKeyToUse = options.apiKey as string | undefined;

  // If no explicit command option but global option was set, use that
  if (!apiKeyToUse) {
    apiKeyToUse = apiKey;
  }

  // If an API key is available (from either source), try to authenticate
  if (apiKeyToUse && !options.force) {
    apiClient.setApiKey(apiKeyToUse);

    // Validate BEFORE persisting, so an invalid key never lands on disk.
    const isValid = await apiClient.validateToken();
    if (isValid) {
      configService.setApiKey(apiKeyToUse);
      outputService.success('Successfully authenticated with provided API key');

      // Project configuration setup is now separated to "obs init"

      process.exit(0);
    } else {
      outputService.error('Invalid API key provided. Please check your key and try again.');
      process.exit(1);
    }
  }
}

/** Best-effort browser open; the auth URL was already printed, so a failure here never blocks login. */
export async function openAuthUrlBestEffort(
  outputService: IOutputService,
  authUrl: string
): Promise<void> {
  try {
    await open(authUrl);
  } catch (error: unknown) {
    if (process.env.OBS_VERBOSE === 'true') {
      outputService.warning(
        `Could not open the browser automatically (${(error as Error).message}). Visit the URL above manually.`
      );
    }
  }
}

/** Poll the CLI auth session until it's approved, denied, or times out. Always exits the process. */
export async function pollForAuth(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService,
  requestId: string
): Promise<never> {
  const maxAttempts = 60; // 5 minutes (5s interval)
  const intervalMs = 5000;
  let attempts = 0;

  while (attempts < maxAttempts) {
    // Only the status-check request is fallible/retryable here. The
    // exit-on-approved/denied branches below must stay OUTSIDE this try so a
    // deliberate process.exit() can never be re-caught and retried as if it
    // were a failed status check.
    let status: Awaited<ReturnType<IApiClient['checkCliAuthStatus']>> | undefined;
    try {
      status = await apiClient.checkCliAuthStatus(requestId);
    } catch (error: unknown) {
      // If 404 or other error, might be expired or invalid — keep polling until
      // maxAttempts, but surface the reason under OBS_VERBOSE for diagnosis.
      if (process.env.OBS_VERBOSE === 'true') {
        outputService.warning(`Auth status check failed, retrying: ${(error as Error).message}`);
      }
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      continue;
    }

    if (status.status === 'approved' && status.api_key) {
      configService.setApiKey(status.api_key);
      configService.setApiUrl(configService.getApiUrl());
      apiClient.setApiKey(status.api_key);

      outputService.success('Successfully authenticated!');

      // Project configuration setup is now separated to "obs init"
      console.log(brand.warning('\nRun "obs init" to create local project configuration.'));

      console.log('');
      console.log(chalk.bold('Next steps:'));
      console.log(chalk.gray('1. Run "obs monitor list" to see your monitors'));
      console.log(chalk.gray('2. Run "obs --help" to explore available commands'));

      process.exit(0);
    } else if (status.status === 'denied') {
      outputService.error('Authentication denied by user.');
      process.exit(1);
    }

    // Still pending — wait before the next poll.
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    attempts++;
  }

  outputService.error('Authentication timed out.');
  process.exit(1);
}

/** Browser-based (device-code style) authentication flow. Always exits the process. */
async function runBrowserAuth(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService
): Promise<never> {
  console.log(chalk.bold('\nAuthentication'));

  outputService.progress('Requesting authentication session...');
  const { request_id, auth_url } = await apiClient.requestCliAuth();
  outputService.success('Successfully requested authentication session. Auth URL: ' + auth_url);

  console.log(chalk.gray("We'll open your browser to authenticate with ObserveOne"));
  console.log('');
  console.log(chalk.blue('Opening browser for authentication...'));
  console.log(chalk.gray(`Auth URL: ${auth_url}`));
  console.log(chalk.gray("If the browser doesn't open automatically, visit the URL above."));
  console.log('');
  console.log(brand.warning('Waiting for authentication...'));

  await openAuthUrlBestEffort(outputService, auth_url);

  return pollForAuth(configService, apiClient, outputService, request_id);
}

/**
 * Factory function to create login command with direct service injection
 */
export function createLoginCommand(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService
): Command {
  const cmd = new Command('login')
    .description('Authenticate with ObserveOne platform')
    .option('-k, --api-key <key>', 'API key to use for authentication')
    .option('--force', 'Force a new login session even if already authenticated')
    .option('--api-url <url>', 'Override API URL')
    .option('--skip-setup', 'Skip project configuration setup')
    .option(
      '--headless',
      'Authenticate headlessly using OBS_EMAIL and OBS_PASSWORD environment variables'
    )
    .option('--json', 'Output in JSON format')
    .action(async (options: Record<string, unknown>) => {
      try {
        // Warning if environment variable is already set (will override new login)
        if (process.env.OBS_API_KEY && !process.env.OBS_JSON_OUTPUT) {
          console.warn(
            brand.warning('\nWarning: OBS_API_KEY is already set in your environment variables.')
          );
          console.warn(
            brand.warning(
              '   This will take precedence over any keys saved during this login session.\n'
            )
          );
        }

        // Handle API URL override first, before other operations
        if (options.apiUrl) {
          configService.setCommandLineApiUrl(options.apiUrl as string);
        }

        // Force logic: clear existing stored key if requested
        if (options.force) {
          configService.clearApiKey();
        }

        // Headless Auth Flow (Agent / CI)
        if (options.headless) {
          await runHeadlessAuth(configService, apiClient, outputService, options);
          return;
        }

        // Handle API key override (kept in-memory until validated, so an
        // invalid/typo'd key is never written to disk before it is checked).
        await tryApiKeyAuth(configService, apiClient, outputService, options);

        // Browser-based authentication flow
        await runBrowserAuth(configService, apiClient, outputService);
      } catch (error: unknown) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });

  cmd
    .command('help')
    .description('Show help for login')
    .action(() => {
      cmd.help();
    });

  return cmd;
}
