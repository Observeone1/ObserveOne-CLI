import { Command } from 'commander';
import chalk from 'chalk';
import { IConfigService } from '../interfaces/config.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';

/**
 * Factory function to create logout command
 */
export function createLogoutCommand(
  configService: IConfigService,
  outputService: IOutputService
): Command {
  return new Command('logout')
    .description('Clear local authentication credentials')
    .option('--json', 'Output in JSON format')
    .action((options: Record<string, unknown>) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true' || options.json === true;
      if (isJson) {
        outputService.enableJsonMode();
      }

      configService.clearApiKey();

      // A child process cannot unset a parent shell's environment variable, so
      // OBS_API_KEY will keep authenticating requests until the user clears it.
      const envKeySet = configService.hasEnvApiKey();

      if (isJson) {
        outputService.formatJsonOutput({ loggedOut: true, envApiKeyStillSet: envKeySet });
      } else {
        outputService.success('Successfully logged out. Local credentials cleared.');
      }

      if (envKeySet) {
        // Warn on stderr so it never corrupts JSON output on stdout.
        console.error(
          chalk.yellow(
            '⚠ OBS_API_KEY is still set in your environment and will keep authenticating requests.\n' +
              '  Unset it in your shell to fully log out (e.g. `unset OBS_API_KEY`).'
          )
        );
      }
    });
}
