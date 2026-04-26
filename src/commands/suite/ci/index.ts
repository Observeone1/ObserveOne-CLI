import { Command } from 'commander';
import { ApiClient } from '../../../services/api-client.service.js';
import { IConfigService } from '../../../interfaces/config.interface.js';
import { IOutputService } from '../../../interfaces/output.interface.js';
import { createSuiteCiStatusCommand } from './status.js';
import { createSuiteCiWebhookTokenCommand } from './webhook-token.js';
import { createSuiteCiDisconnectCommand } from './disconnect.js';

export function createSuiteCiCommand(
  configService: IConfigService,
  apiClient: ApiClient,
  outputService: IOutputService
): Command {
  const ci = new Command('ci').description(
    'Manage suite CI integration (status, token rotation, disconnect). Install + repo selection still happens in the web UI.'
  );

  ci.addCommand(createSuiteCiStatusCommand(configService, apiClient, outputService));
  ci.addCommand(createSuiteCiWebhookTokenCommand(configService, apiClient, outputService));
  ci.addCommand(createSuiteCiDisconnectCommand(configService, apiClient, outputService));

  ci.addHelpText(
    'after',
    `
Examples:
  $ obs suite ci status 42
  $ obs suite ci webhook-token 42 -y --json | jq -r '.data.token'
  $ obs suite ci disconnect 42 -y
`
  );

  return ci;
}
