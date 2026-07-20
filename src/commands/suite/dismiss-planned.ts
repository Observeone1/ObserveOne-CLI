import { Command } from 'commander';
import { ApiClient } from '../../services/api-client.service.js';
import { IConfigService } from '../../interfaces/config.interface.js';
import { IOutputService } from '../../interfaces/output.interface.js';
import { createPlannedFileCommand } from './planned-file-command.js';

export function createSuiteDismissPlannedCommand(
  _configService: IConfigService,
  apiClient: ApiClient,
  outputService: IOutputService
): Command {
  return createPlannedFileCommand({
    name: 'dismiss-planned',
    description: 'Dismiss a planned file in a suite so it is not generated',
    optionDescription: 'Planned file path to dismiss',
    successMessage: (plannedFile) => `\n✓ Planned file dismissed: ${plannedFile}\n`,
    failureMessage: 'Failed to dismiss planned file',
    outputService,
    apply: (suiteId, plannedFile) => apiClient.dismissPlannedFile(suiteId, plannedFile),
  });
}
