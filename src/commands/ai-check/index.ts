import { Command } from 'commander';
import { IConfigService } from '../../interfaces/config.interface.js';
import { IApiClient } from '../../interfaces/api-client.interface.js';
import { IOutputService } from '../../interfaces/output.interface.js';
import { createAiCheckRunCommand } from './run.js';
import { createAiCheckListCommand } from './list.js';
import { createAiCheckGetCommand } from './get.js';
import { createAiCheckCreateCommand } from './create.js';
import { createAiCheckDeleteCommand } from './delete.js';
import { createAiCheckStatusCommand } from './status.js';
import { createAiCheckWaitCommand } from './wait.js';

export function createAiCheckCommand(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService
): Command {
  const aiCheck = new Command('ai-check').description('Manage and run AI-powered tests');
  aiCheck.hidden = true;

  aiCheck.addCommand(createAiCheckRunCommand(configService, apiClient, outputService), {
    isDefault: true,
  });
  aiCheck.addCommand(createAiCheckListCommand(configService, apiClient, outputService));
  aiCheck.addCommand(createAiCheckGetCommand(configService, apiClient, outputService));
  aiCheck.addCommand(createAiCheckCreateCommand(configService, apiClient, outputService));
  aiCheck.addCommand(createAiCheckDeleteCommand(configService, apiClient, outputService));
  aiCheck.addCommand(createAiCheckStatusCommand(configService, apiClient, outputService));
  aiCheck.addCommand(createAiCheckWaitCommand(configService, apiClient, outputService));

  return aiCheck;
}
