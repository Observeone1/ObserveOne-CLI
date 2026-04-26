import { Command } from 'commander';
import chalk from 'chalk';
import { brand } from '../utils/theme.js';
import { IConfigService } from '../interfaces/config.interface.js';
import { IApiClient } from '../interfaces/api-client.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';
import open from 'open';

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
            outputService.error(
              `Headless authentication failed: ${err.message || 'Unknown error'}`
            );
            process.exit(1);
          }
          return;
        }

        // Handle API key override
        if (options.apiKey) {
          configService.setApiKey(options.apiKey as string);
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
          // Use the API key that was provided
          configService.setApiKey(apiKeyToUse);
          apiClient.setApiKey(apiKeyToUse);

          // Validate the API key
          const isValid = await apiClient.validateToken();
          if (isValid) {
            outputService.success('Successfully authenticated with provided API key');

            // Project configuration setup is now separated to "obs init"

            process.exit(0);
            return;
          } else {
            outputService.error('Invalid API key provided. Please check your key and try again.');
            process.exit(1);
          }
        }

        // Browser-based authentication flow
        console.log(chalk.bold('\nAuthentication'));

        // Request auth session
        outputService.progress('Requesting authentication session...');
        const { request_id, auth_url } = await apiClient.requestCliAuth();
        outputService.success(
          'Successfully requested authentication session. Auth URL: ' + auth_url
        );

        console.log(chalk.gray("We'll open your browser to authenticate with ObserveOne"));
        console.log('');
        console.log(chalk.blue('Opening browser for authentication...'));
        console.log(chalk.gray(`Auth URL: ${auth_url}`));
        console.log(chalk.gray("If the browser doesn't open automatically, visit the URL above."));
        console.log('');
        console.log(brand.warning('Waiting for authentication...'));

        try {
          await open(auth_url);
        } catch (_error: unknown) {
          // Ignore open errors, user can copy link
        }

        // Poll for status
        const maxAttempts = 60; // 5 minutes (5s interval)
        const intervalMs = 5000;
        let attempts = 0;

        while (attempts < maxAttempts) {
          try {
            const status = await apiClient.checkCliAuthStatus(request_id);

            if (status.status === 'approved' && status.api_key) {
              configService.setApiKey(status.api_key);
              configService.setApiUrl(configService.getApiUrl());
              apiClient.setApiKey(status.api_key);

              outputService.success('Successfully authenticated!');

              // Project configuration setup is now separated to "obs init"
              console.log(brand.warning('\nRun "obs init" to create local project configuration.'));

              console.log('');
              console.log(chalk.bold('Next steps:'));
              console.log(chalk.gray('1. Run "obs ai-check list" to see available tests'));
              console.log(chalk.gray('2. Run "obs ai-check <test-name>" to execute tests'));

              process.exit(0);
            } else if (status.status === 'denied') {
              outputService.error('Authentication denied by user.');
              process.exit(1);
            }

            // Wait before next poll
            await new Promise((resolve) => setTimeout(resolve, intervalMs));
            attempts++;
          } catch (_error: unknown) {
            // If 404 or other error, might be expired or invalid
            attempts++;
            await new Promise((resolve) => setTimeout(resolve, intervalMs));
          }
        }

        outputService.error('Authentication timed out.');
        process.exit(1);
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
