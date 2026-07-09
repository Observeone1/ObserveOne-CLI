import { Command } from 'commander';
import { IConfigService } from '../interfaces/config.interface.js';
import { IApiClient } from '../interfaces/api-client.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';
import { createResourceCommand } from './resource-command.factory.js';
import { Project } from '../types/index.js';

/**
 * Factory for the `obs project` command. Projects are containers that group
 * monitors, checks, and environments. Simple CRUD (no toggle/run), so this
 * wraps the generic resource factory. Nested project sub-resources (project
 * environments, rules, etc.) are out of scope for this command.
 */
export function createProjectCommand(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService
): Command {
  const cmd = createResourceCommand<Project>(configService, apiClient, outputService, {
    resourceName: 'project',
    pluralName: 'projects',
    description: 'Manage projects (containers for monitors, checks, and environments)',
    apiMethods: {
      list: () => apiClient.getProjects(),
      get: (id) => apiClient.getProject(id),
      create: (data) => apiClient.createProject(data),
      update: (id, data) => apiClient.updateProject(id, data),
      delete: (id) => apiClient.deleteProject(id),
    },
    formatters: {
      list: (items, verbose) => outputService.formatProjectList(items, verbose),
    },
    createCommandSetup: (createCmd) => {
      createCmd
        .option('-n, --name <name>', 'Project name')
        .option('-d, --description <description>', 'Project description');
    },
    updateCommandSetup: (updateCmd) => {
      updateCmd
        .option('-n, --name <name>', 'Project name')
        .option('-d, --description <description>', 'Project description');
    },
  });

  cmd.commands
    .find((c) => c.name() === 'create')
    ?.addHelpText(
      'after',
      `
Examples:
  $ obs project create --name "Acme prod" --description "Production monitoring"
  $ obs project create --file project.json
`
    );

  return cmd;
}
