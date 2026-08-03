import { runCLI, assertSuccess, assertJSON } from '../../lib/test-runner.js';
import { parseFirstTeamId } from './team-helpers.js';

export async function testTeamList() {
  console.log('      - Listing teams...');
  const result = await runCLI(['team', 'list', '--json']);
  assertSuccess(result, 'Team list failed');
  assertJSON(result.stdout, 'Team list --json must output valid JSON');
}

export async function testTeamMembersOfFirstTeam() {
  console.log('      - Listing teams to get first team ID...');
  const listResult = await runCLI(['team', 'list', '--json']);
  assertSuccess(listResult, 'Team list failed');

  const teamId = parseFirstTeamId(listResult.stdout);
  if (!teamId) {
    console.log('      - No teams found, skipping member list test');
    return;
  }

  console.log(`      - Listing members of team ${teamId}...`);
  const membersResult = await runCLI(['team', 'members', String(teamId), '--json']);
  assertSuccess(membersResult, 'Team members list failed');
  assertJSON(membersResult.stdout, 'Team members --json must output valid JSON');
}

export async function testTeamRegenerateInvite() {
  console.log('      - Listing teams to get first team ID...');
  const listResult = await runCLI(['team', 'list', '--json']);
  assertSuccess(listResult, 'Team list failed');

  const teamId = parseFirstTeamId(listResult.stdout);
  if (!teamId) {
    console.log('      - No teams found, skipping invite regeneration test');
    return;
  }
  console.log(`      - Regenerating invite code for team ${teamId}...`);
  const inviteResult = await runCLI(['team', 'invite', String(teamId), '--json']);
  assertSuccess(inviteResult, 'Team invite regeneration failed');
  assertJSON(inviteResult.stdout, 'Team invite --json must output valid JSON');

  const parsed = JSON.parse(inviteResult.stdout);
  const code = parsed.inviteCode || parsed.data?.inviteCode;
  if (!code) {
    throw new Error(`Expected inviteCode in response, got: ${inviteResult.stdout}`);
  }
  console.log(`      - Invite code returned: ${String(code).slice(0, 8)}...`);
}
