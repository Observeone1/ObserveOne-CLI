import { Command } from 'commander';
import { IConfigService } from '../interfaces/config.interface.js';
import { IApiClient } from '../interfaces/api-client.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';

/**
 * Factory function to create signup command with direct service injection
 */
export function createSignupCommand(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService
): Command {
  return new Command('signup')
    .description('Create a new account for an AI agent and receive an API key (Rate-limited)')
    .option('--email <email>', 'Email address for the account')
    .option('--password <password>', 'Password for the account')
    .option(
      '--headless',
      'Signup headlessly using OBS_EMAIL and OBS_PASSWORD environment variables'
    )
    .action(async (options) => {
      try {
        let email = options.email;
        let password = options.password;

        // Headless Mode
        if (options.headless) {
          email = process.env.OBS_EMAIL;
          password = process.env.OBS_PASSWORD;

          if (!email || !password) {
            outputService.error(
              'Headless signup requires OBS_EMAIL and OBS_PASSWORD environment variables.'
            );
            process.exit(1);
          }
        }

        // Validate options
        if (!email || !password) {
          outputService.error(
            'Signup requires --email and --password (or --headless with env vars).'
          );
          process.exit(1);
        }

        outputService.progress('Creating secure account for AI agent...');
        try {
          const { api_key } = await apiClient.agentSignup(email, password);
          configService.setApiKey(api_key);
          apiClient.setApiKey(api_key);

          if (process.env.OBS_JSON_OUTPUT === 'true') {
            outputService.formatJsonOutput({ authenticated: true });
          } else {
            outputService.success('Successfully created account and provisioned API key!');
          }
          process.exit(0);
        } catch (error: any) {
          outputService.error(`Signup failed: ${error.message}`);
          process.exit(1);
        }
      } catch (error: any) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });
}
