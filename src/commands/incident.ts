import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { IConfigService } from '../interfaces/config.interface.js';
import { IApiClient } from '../interfaces/api-client.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';
import { createResourceCommand } from './resource-command.factory.js';
import { Incident, IncidentPriority } from '../types/index.js';

const priorities: IncidentPriority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

function normalizePriority(priority?: string): IncidentPriority | undefined {
  if (!priority) return undefined;
  const normalized = priority.toUpperCase() as IncidentPriority;
  return priorities.includes(normalized) ? normalized : undefined;
}

export function createIncidentCommand(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService
): Command {
  const cmd = createResourceCommand<Incident>(configService, apiClient, outputService, {
    resourceName: 'incident',
    pluralName: 'incidents',
    description: 'Manage incidents',
    apiMethods: {
      list: () => apiClient.getIncidents(),
      get: (id) => apiClient.getIncident(id),
      create: (data) => apiClient.createIncident(data),
      update: (id, data) => apiClient.updateIncident(id, data),
      delete: (id) => apiClient.deleteIncident(id),
    },
    formatters: {
      list: (items, verbose) => outputService.formatIncidentList(items, verbose),
    },
    createCommandSetup: (cmd) => {
      cmd
        .option('-t, --title <title>', 'Incident title')
        .option('-p, --priority <priority>', 'Priority (CRITICAL, HIGH, MEDIUM, LOW)')
        .option('-d, --description <description>', 'Incident description')
        .option('--assigned-to <userId>', 'Assign to user ID')
        .option('--team-id <teamId>', 'Team ID');
    },
    updateCommandSetup: (cmd) => {
      cmd
        .option('-t, --title <title>', 'Incident title')
        .option('-p, --priority <priority>', 'Priority (CRITICAL, HIGH, MEDIUM, LOW)')
        .option('-d, --description <description>', 'Incident description')
        .option('--assigned-to <userId>', 'Assign to user ID')
        .option('--team-id <teamId>', 'Team ID');
    },
    createPrompts: async (options) => {
      let title = options.title as string | undefined;
      let priority = normalizePriority(options.priority as string | undefined);

      if (!title || !priority) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'title',
            message: 'Incident title:',
            when: !title,
            validate: (val: string) => (val.trim().length >= 3 ? true : 'Title is required'),
          },
          {
            type: 'list',
            name: 'priority',
            message: 'Priority:',
            when: !priority,
            choices: priorities,
          },
        ]);
        title = title || (answers.title as string);
        priority = priority || (answers.priority as IncidentPriority);
      }

      if (!priority) {
        throw new Error('Priority is required.');
      }

      return {
        title,
        priority,
        description: options.description as string | undefined,
        assigned_to: options.assignedTo as string | undefined,
        team_id: options.teamId ? parseInt(options.teamId as string, 10) : undefined,
      };
    },
    updatePrompts: async (_id, options, existing) => {
      const hasChanges =
        options.title ||
        options.priority ||
        options.description ||
        options.assignedTo ||
        options.teamId;

      if (!hasChanges) {
        outputService.error('Please provide at least one field to update.');
        process.exit(1);
      }

      const priority =
        normalizePriority(options.priority as string | undefined) || existing.priority;

      if (!priority) {
        throw new Error('Priority is required.');
      }

      const payload: Partial<Incident> = {
        title: (options.title as string | undefined) || existing.title,
        priority,
      };

      const description =
        (options.description as string | undefined) ??
        (typeof existing.description === 'string' ? existing.description : undefined);
      if (description !== undefined) payload.description = description;

      if (options.assignedTo) {
        payload.assigned_to = options.assignedTo as string;
      }

      if (options.teamId) {
        payload.team_id = parseInt(options.teamId as string, 10);
      }

      return payload;
    },
  });

  // obs incident comment <id> --message <msg> [--json]
  cmd
    .command('comment <id>')
    .description('Add a comment to an incident')
    .option('-m, --message <message>', 'Comment message')
    .action(async (id: string, options: { message?: string }) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const incidentId = parseInt(id);
        if (isNaN(incidentId)) throw new Error('Invalid incident ID');

        let message = options.message;
        if (!message) {
          const answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'message',
              message: 'Comment message:',
              validate: (val: string) => (val.trim() ? true : 'Message is required'),
            },
          ]);
          message = answers.message as string;
        }

        const event = await apiClient.addIncidentComment(incidentId, message!);
        if (isJson) {
          outputService.formatJsonOutput({ event });
          return;
        }
        console.log(chalk.green(`\n✓ Comment added to incident ${incidentId}.\n`));
      } catch (err: unknown) {
        const msg = (err as Error).message || 'Failed to add comment';
        if (isJson) {
          outputService.formatJsonOutput({ status: 'ERROR', error: { message: msg } });
        } else {
          console.error(chalk.red(`\n❌ ${msg}\n`));
        }
        process.exit(1);
      }
    });

  // obs incident assign <id> --user <user-id> [--json]
  cmd
    .command('assign <id>')
    .description('Assign an incident to a user')
    .requiredOption('--user <user-id>', 'User ID to assign the incident to')
    .action(async (id: string, options: { user: string }) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const incidentId = parseInt(id);
        if (isNaN(incidentId)) throw new Error('Invalid incident ID');

        const incident = await apiClient.assignIncident(incidentId, options.user);
        if (isJson) {
          outputService.formatJsonOutput({ incident });
          return;
        }
        console.log(chalk.green(`\n✓ Incident ${incidentId} assigned to user ${options.user}.\n`));
      } catch (err: unknown) {
        const msg = (err as Error).message || 'Failed to assign incident';
        if (isJson) {
          outputService.formatJsonOutput({ status: 'ERROR', error: { message: msg } });
        } else {
          console.error(chalk.red(`\n❌ ${msg}\n`));
        }
        process.exit(1);
      }
    });

  // obs incident unassign <id> [--json]
  cmd
    .command('unassign <id>')
    .description('Unassign an incident')
    .action(async (id: string) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const incidentId = parseInt(id);
        if (isNaN(incidentId)) throw new Error('Invalid incident ID');

        const incident = await apiClient.assignIncident(incidentId, null);
        if (isJson) {
          outputService.formatJsonOutput({ incident });
          return;
        }
        console.log(chalk.green(`\n✓ Incident ${incidentId} unassigned.\n`));
      } catch (err: unknown) {
        const msg = (err as Error).message || 'Failed to unassign incident';
        if (isJson) {
          outputService.formatJsonOutput({ status: 'ERROR', error: { message: msg } });
        } else {
          console.error(chalk.red(`\n❌ ${msg}\n`));
        }
        process.exit(1);
      }
    });

  return cmd;
}
