import { Command } from 'commander';
import chalk from 'chalk';
import { IConfigService } from '../interfaces/config.interface.js';
import { IApiClient } from '../interfaces/api-client.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';
import { requireConfirmation } from '../utils/confirm.js';

// Shared failure handler for every `team` subcommand action. Each action's
// catch block was byte-identical apart from the fallback message, which Sonar's
// duplication gate flagged; centralising it keeps the error/exit contract in one
// place. Returns `never` because it always terminates the process.
function reportTeamError(
  err: unknown,
  fallback: string,
  isJson: boolean,
  outputService: IOutputService
): never {
  const msg = (err as Error).message || fallback;
  if (isJson) {
    outputService.formatJsonOutput({ status: 'ERROR', error: { message: msg } });
  } else {
    console.error(chalk.red(`\n❌ ${msg}\n`));
  }
  process.exit(1);
}

export function createTeamCommand(
  _configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService
): Command {
  const cmd = new Command('team').description('Manage teams');

  // obs team list [--json]
  cmd
    .command('list')
    .description("List user's teams")
    .action(async () => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const teams = await apiClient.getTeams();
        if (isJson) {
          outputService.formatJsonOutput({ teams });
          return;
        }
        if (teams.length === 0) {
          console.log(chalk.gray('\n No teams found.\n'));
          return;
        }
        console.log(chalk.bold('\n Teams\n'));
        for (const team of teams) {
          console.log(chalk.white(` ${team.name}`) + chalk.gray(` [${team.id}]`));
        }
        console.log('');
      } catch (err: unknown) {
        reportTeamError(err, 'Failed to list teams', isJson, outputService);
      }
    });

  // obs team members <team-id> [--json]
  cmd
    .command('members <team-id>')
    .description('List members of a team')
    .action(async (teamId: string) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const members = await apiClient.getTeamMembers(teamId);
        if (isJson) {
          outputService.formatJsonOutput({ members });
          return;
        }
        if (members.length === 0) {
          console.log(chalk.gray('\n No members found.\n'));
          return;
        }
        console.log(chalk.bold(`\n Members of team ${teamId}\n`));
        for (const member of members) {
          const role = member.role ? chalk.gray(` (${member.role})`) : '';
          const label = member.email || member.name || member.id;
          console.log(chalk.white(` ${label}`) + role);
        }
        console.log('');
      } catch (err: unknown) {
        reportTeamError(err, 'Failed to list team members', isJson, outputService);
      }
    });

  // obs team invite <team-id> [--json]
  cmd
    .command('invite <team-id>')
    .description('Regenerate and print the invite code for a team')
    .action(async (teamId: string) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const result = await apiClient.regenerateTeamInvite(teamId);
        if (isJson) {
          outputService.formatJsonOutput(result);
          return;
        }
        console.log(chalk.bold(`\n✓ Invite code: ${chalk.cyan(result.inviteCode)}\n`));
      } catch (err: unknown) {
        reportTeamError(err, 'Failed to regenerate invite code', isJson, outputService);
      }
    });

  // obs team remove-member <team-id> <user-id> [-y] [--json]
  cmd
    .command('remove-member <team-id> <user-id>')
    .description('Remove a member from a team')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (teamId: string, userId: string, options: { yes?: boolean }) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const confirmed = await requireConfirmation(`Remove user ${userId} from team ${teamId}?`, {
          yes: options.yes,
          isJson,
          outputError: (msg) => outputService.error(msg),
        });
        if (!confirmed) {
          console.log(chalk.gray(' Remove cancelled.'));
          return;
        }
        const result = await apiClient.removeTeamMember(teamId, userId);
        if (isJson) {
          outputService.formatJsonOutput({ result });
          return;
        }
        console.log(chalk.green(`\n✓ User ${userId} removed from team ${teamId}.\n`));
      } catch (err: unknown) {
        reportTeamError(err, 'Failed to remove team member', isJson, outputService);
      }
    });

  // obs team update-role <team-id> <user-id> --role <role> [--json]
  cmd
    .command('update-role <team-id> <user-id>')
    .description('Update the role of a team member')
    .requiredOption('--role <role>', 'New role for the member')
    .action(async (teamId: string, userId: string, options: { role: string }) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const result = await apiClient.updateTeamMemberRole(teamId, userId, options.role);
        if (isJson) {
          outputService.formatJsonOutput({ result });
          return;
        }
        console.log(
          chalk.green(`\n✓ User ${userId} role updated to ${options.role} in team ${teamId}.\n`)
        );
      } catch (err: unknown) {
        reportTeamError(err, 'Failed to update team member role', isJson, outputService);
      }
    });

  return cmd;
}
