import { Command } from 'commander';
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

      if (isJson) {
        outputService.formatJsonOutput({ loggedOut: true });
      } else {
        outputService.success('Successfully logged out. Local credentials cleared.');
      }
    });
}
