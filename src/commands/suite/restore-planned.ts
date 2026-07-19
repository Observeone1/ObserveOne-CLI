import { Command } from 'commander';
import { ApiClient } from '../../services/api-client.service.js';
import { IConfigService } from '../../interfaces/config.interface.js';
import { IOutputService } from '../../interfaces/output.interface.js';
import { createPlannedFileCommand } from './planned-file-command.js';

export function createSuiteRestorePlannedCommand(
  _configService: IConfigService,
  apiClient: ApiClient,
  outputService: IOutputService
): Command {
  return createPlannedFileCommand({
    name: 'restore-planned',
    description: 'Restore a previously dismissed planned file in a suite',
    optionDescription: 'Planned file path to restore',
    successMessage: (plannedFile) => `\n✓ Planned file restored: ${plannedFile}\n`,
    failureMessage: 'Failed to restore planned file',
    outputService,
    apply: (suiteId, plannedFile) => apiClient.restorePlannedFile(suiteId, plannedFile),
  });
}
