import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { IConfigService } from '../interfaces/config.interface.js';
import { IApiClient } from '../interfaces/api-client.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';
import { createResourceCommand } from './resource-command.factory.js';
import { Incident } from '../types/index.js';

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
    // createPrompts/updatePrompts intentionally omitted — the resource-command
    // factory falls back to the schema-driven default built from
    // schemas.incident.fieldMetadata.
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

        // No dedicated unassign route; backend treats null userId as unassign.
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

  // State-transition shortcuts over `incident update <id>` (status field).
  // Backend IncidentStatus = OPEN | RESOLVED | CLOSED (no ACKNOWLEDGED).
  const stateVerbs: Array<{
    verb: string;
    status: 'OPEN' | 'RESOLVED' | 'CLOSED';
    label: string;
  }> = [
    { verb: 'resolve', status: 'RESOLVED', label: 'resolved' },
    { verb: 'close', status: 'CLOSED', label: 'closed' },
    { verb: 'reopen', status: 'OPEN', label: 'reopened' },
  ];
  for (const { verb, status, label } of stateVerbs) {
    cmd
      .command(`${verb} <id>`)
      .description(`Set an incident's status to ${status}`)
      .action(async (id: string) => {
        const isJson = process.env.OBS_JSON_OUTPUT === 'true';
        try {
          const incidentId = parseInt(id);
          if (isNaN(incidentId)) throw new Error('Invalid incident ID');

          const incident = await apiClient.updateIncident(incidentId, { status });
          if (isJson) {
            outputService.formatJsonOutput({ incident });
            return;
          }
          console.log(chalk.green(`\n✓ Incident ${incidentId} ${label}.\n`));
        } catch (err: unknown) {
          const msg = (err as Error).message || `Failed to ${verb} incident`;
          if (isJson) {
            outputService.formatJsonOutput({ status: 'ERROR', error: { message: msg } });
          } else {
            console.error(chalk.red(`\n❌ ${msg}\n`));
          }
          process.exit(1);
        }
      });
  }

  return cmd;
}
