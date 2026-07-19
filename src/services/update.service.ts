import axios from 'axios';
import chalk from 'chalk';
import { IOutputService } from '../interfaces/output.interface.js';

export class UpdateService {
  private readonly currentVersion: string;
  private readonly packageName: string = '@observeone/cli';

  constructor(currentVersion: string) {
    this.currentVersion = currentVersion;
  }

  /**
   * Check for updates on npm and notify the user if a newer version exists.
   * This is a non-blocking background check.
   */
  async checkForUpdates(outputService: IOutputService): Promise<void> {
    // Skip update check in JSON mode or if disabled via environment variable
    if (process.env.OBS_JSON_OUTPUT === 'true' || process.env.OBS_SKIP_UPDATE_CHECK === 'true') {
      return;
    }

    try {
      // Fetch latest version from npm registry (non-blocking)
      const response = await axios.get<{ version: string }>(
        `https://registry.npmjs.org/${this.packageName}/latest`,
        {
          timeout: 2000,
        }
      );
      const latestVersion = response.data.version;

      if (this.isNewerVersion(this.currentVersion, latestVersion)) {
        const packageManager = this.detectPackageManager();
        const updateCommand = this.getUpdateCommand(packageManager);
        const line1 = [
          { text: 'Update available: ', color: chalk.yellow },
          { text: this.currentVersion, color: chalk.green },
          { text: ' → ', color: chalk.yellow },
          { text: latestVersion, color: chalk.green },
        ];
        const line2 = [
          { text: 'Run ', color: chalk.yellow },
          { text: updateCommand, color: chalk.cyan },
          { text: ' to update.', color: chalk.yellow },
        ];
        const rawLen = (parts: Array<{ text: string }>): number =>
          parts.reduce((sum, part) => sum + part.text.length, 0);
        const contentWidth = Math.max(rawLen(line1), rawLen(line2));
        const border = chalk.yellow;
        const renderLine = (
          parts: Array<{ text: string; color: (s: string) => string }>
        ): string => {
          const rawLength = rawLen(parts);
          const pad = ' '.repeat(Math.max(0, contentWidth - rawLength));
          const colored = parts.map((part) => part.color(part.text)).join('');
          return border('│  ') + colored + border(pad + '  │');
        };

        console.log('\n' + border(`┌${'─'.repeat(contentWidth + 4)}┐`));
        console.log(renderLine(line1));
        console.log(renderLine(line2));
        console.log(border(`└${'─'.repeat(contentWidth + 4)}┘\n`));
      }
    } catch (error: unknown) {
      // Never disrupt the user's workflow over a failed update check, but
      // surface why under OBS_VERBOSE so it's diagnosable.
      if (process.env.OBS_VERBOSE === 'true') {
        outputService.warning(`Update check failed: ${(error as Error).message}`);
      }
    }
  }

  private isNewerVersion(current: string, latest: string): boolean {
    const c = current.split('.').map(Number);
    const l = latest.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      const latestPart = l[i];
      const currentPart = c[i];

      if (latestPart !== undefined && currentPart !== undefined) {
        if (latestPart > currentPart) return true;
        if (latestPart < currentPart) return false;
      }
    }
    return false;
  }

  private getUpdateCommand(packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun'): string {
    switch (packageManager) {
      case 'pnpm':
        return `pnpm add -g ${this.packageName}`;
      case 'yarn':
        return `yarn global add ${this.packageName}`;
      case 'bun':
        return `bun add -g ${this.packageName}`;
      default:
        return `npm install -g ${this.packageName}`;
    }
  }

  private detectPackageManager(): 'npm' | 'pnpm' | 'yarn' | 'bun' {
    const userAgent = process.env.npm_config_user_agent?.toLowerCase() ?? '';
    if (userAgent.includes('pnpm')) return 'pnpm';
    if (userAgent.includes('yarn')) return 'yarn';
    if (userAgent.includes('bun')) return 'bun';
    if (userAgent.includes('npm')) return 'npm';

    const execPath = process.env.npm_execpath?.toLowerCase() ?? '';
    if (execPath.includes('pnpm')) return 'pnpm';
    if (execPath.includes('yarn')) return 'yarn';
    if (execPath.includes('bun')) return 'bun';

    const argv0 = process.argv[0]?.toLowerCase() ?? '';
    const argv1 = process.argv[1]?.toLowerCase() ?? '';
    const combined = `${argv0} ${argv1}`;
    if (combined.includes('.pnpm') || combined.includes('pnpm')) return 'pnpm';
    if (combined.includes('.yarn') || combined.includes('yarn')) return 'yarn';
    if (combined.includes('.bun') || combined.includes('bun')) return 'bun';

    return 'npm';
  }
}
