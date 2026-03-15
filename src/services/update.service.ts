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
        console.log('\n' + chalk.yellow('┌───────────────────────────────────────────────────┐'));
        console.log(
          chalk.yellow(`│  Update available: `) +
            chalk.green(`${this.currentVersion}`) +
            chalk.yellow(' → ') +
            chalk.green(`${latestVersion}`) +
            chalk.yellow('             │')
        );
        console.log(
          chalk.yellow(`│  Run `) +
            chalk.cyan(`npm install -g ${this.packageName}`) +
            chalk.yellow(` to update.  │`)
        );
        console.log(chalk.yellow('└───────────────────────────────────────────────────┘\n'));
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
