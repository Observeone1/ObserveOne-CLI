import axios from 'axios';
import chalk from 'chalk';
import { IOutputService } from '../interfaces/output.interface.js';

export class UpdateService {
  private currentVersion: string;
  private packageName: string = '@observeone/cli';

  constructor(currentVersion: string) {
    this.currentVersion = currentVersion;
  }

  /**
   * Check for updates on npm and notify the user if a newer version exists.
   * This is a non-blocking background check.
   */
  async checkForUpdates(_outputService: IOutputService): Promise<void> {
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
        const line1 = [
          { text: 'Update available: ', color: chalk.yellow },
          { text: this.currentVersion, color: chalk.green },
          { text: ' → ', color: chalk.yellow },
          { text: latestVersion, color: chalk.green },
        ];
        const line2 = [
          { text: 'Run ', color: chalk.yellow },
          { text: `npm install -g ${this.packageName}`, color: chalk.cyan },
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
    } catch (_error: unknown) {
      // Silently fail to avoid disrupting the user's workflow
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
}
