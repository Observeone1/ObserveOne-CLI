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
import { createSuiteDeleteCommand } from './delete.js';
import { createSuiteScheduleCommand } from './schedule.js';
import { createSuiteSecretsCommand } from './secrets.js';
import { createSuiteUpdateCommand } from './update.js';
import { createSuitePullCommand } from './pull.js';
import { createSuitePushCommand } from './push.js';
import { createSuiteTogglePublicCommand } from './toggle-public.js';
import { createSuiteHealCommand } from './heal.js';
import { createSuiteCiCommand } from './ci/index.js';

export function createSuiteCommand(
  configService: IConfigService,
  apiClient: ApiClient,
  outputService: IOutputService
): Command {
  const suite = new Command('suite').description('Manage Playwright Autopilot suites');

  suite.addCommand(createSuiteUpdateCommand(configService, apiClient, outputService));
  suite.addCommand(createSuiteListCommand(configService, apiClient, outputService));
  suite.addCommand(createSuiteGetCommand(configService, apiClient, outputService));
  suite.addCommand(createSuiteGenerateCommand(configService, apiClient, outputService));
  suite.addCommand(createSuiteRunCommand(configService, apiClient, outputService));
  suite.addCommand(createSuiteStatusCommand(configService, apiClient, outputService));
  suite.addCommand(createSuiteWaitCommand(configService, apiClient, outputService));
  suite.addCommand(createSuiteDeleteCommand(configService, apiClient, outputService));
  suite.addCommand(createSuiteScheduleCommand(configService, apiClient, outputService));
  suite.addCommand(createSuiteSecretsCommand(configService, apiClient, outputService));
  suite.addCommand(createSuitePullCommand(configService, apiClient, outputService));
  suite.addCommand(createSuitePushCommand(configService, apiClient, outputService));
  suite.addCommand(createSuiteTogglePublicCommand(configService, apiClient, outputService));
  suite.addCommand(createSuiteHealCommand(configService, apiClient, outputService));
  suite.addCommand(createSuiteCiCommand(configService, apiClient, outputService));

  return suite;
}
