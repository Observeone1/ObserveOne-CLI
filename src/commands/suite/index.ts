import { Command } from 'commander';
import { ApiClient } from '../../services/api-client.service.js';
import { IConfigService } from '../../interfaces/config.interface.js';
import { IOutputService } from '../../interfaces/output.interface.js';
import { createSuiteListCommand } from './list.js';
import { createSuiteGetCommand } from './get.js';
import { createSuiteGenerateCommand } from './generate.js';
import { createSuiteRunCommand } from './run.js';
import { createSuiteStatusCommand } from './status.js';
import { createSuiteWaitCommand } from './wait.js';

export function createSuiteCommand(
  configService: IConfigService,
  apiClient: ApiClient,
  outputService: IOutputService
): Command {
  const suite = new Command('suite')
    .description('Manage Playwright Autopilot suites');

  suite.addCommand(createSuiteListCommand(configService, apiClient, outputService));
  suite.addCommand(createSuiteGetCommand(configService, apiClient, outputService));
  suite.addCommand(createSuiteGenerateCommand(configService, apiClient, outputService));
  suite.addCommand(createSuiteRunCommand(configService, apiClient, outputService));
  suite.addCommand(createSuiteStatusCommand(configService, apiClient, outputService));
  suite.addCommand(createSuiteWaitCommand(configService, apiClient, outputService));

  return suite;
}
