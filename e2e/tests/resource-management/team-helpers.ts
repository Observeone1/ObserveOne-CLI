/** Parse the first team id from `obs team list --json` output. */
export function parseFirstTeamId(listStdout: string): string | number | undefined {
  try {
    const parsed = JSON.parse(listStdout);
    const teams = parsed.teams || parsed.data?.teams || [];
    return teams[0]?.teams?.id ?? teams[0]?.id;
  } catch {
    return undefined;
  }
}
