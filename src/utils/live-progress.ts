import ora, { Ora } from 'ora';
import chalk from 'chalk';

export interface ProgressOptions {
  verbose?: boolean;
}

type Action = Record<string, unknown>;

interface StepResult {
  extracted_content?: string;
  success?: boolean;
  error?: string;
}

interface StepDetails {
  evaluation?: string;
  actions?: Action[];
  result?: StepResult[];
  memory?: string;
  next_goal?: string;
  [key: string]: unknown;
}

export class LiveProgressRenderer {
  private totalSteps = 0;
  private startTime = Date.now();
  private screenshotCount = 0;
  private spinner: Ora;
  private verbose: boolean;

  constructor(options: ProgressOptions = {}) {
    this.verbose = options.verbose || false;
    this.spinner = ora();
  }

  start(testName: string): void {
    console.log(chalk.bold(`\n🎯 Test: ${testName}`));
    console.log(chalk.gray('━'.repeat(50)));
    this.spinner.start(chalk.blue('Connecting to execution stream...'));
  }

  updateStep(stepNumber: number, goal: string, details?: StepDetails): void {
    const elapsed = this.getElapsedTime();

    if (this.verbose && details) {
      this.spinner.stop();
      console.log(
        chalk.bold(`\nStep ${stepNumber}${this.totalSteps > 0 ? `/${this.totalSteps}` : ''}:`)
      );
      console.log(chalk.cyan(`  Goal: ${goal}`));

      if (details.evaluation) {
        console.log(chalk.magenta(`  Evaluation: ${details.evaluation}`));
      }

      if (details.actions && details.actions.length > 0) {
        console.log(chalk.yellow('  Actions:'));
        details.actions.forEach((action) => {
          const actionText = this.formatAction(action);
          if (actionText) {
            console.log(chalk.gray(`    ${actionText}`));
          }
        });
      }

      if (details.result && details.result.length > 0) {
        console.log(chalk.green('  Results:'));
        details.result.forEach((result) => {
          if (result.error) {
            console.log(chalk.red(`    ✗ ${result.error}`));
          } else {
            console.log(chalk.green(`    ✓ Success`));
          }
        });
      }

      this.spinner.start(chalk.blue(`⏱️  ${elapsed} | Running...`));
    } else {
      this.spinner.text = chalk.blue(
        `⏱️  ${elapsed} | Step ${stepNumber}${
          this.totalSteps > 0 ? `/${this.totalSteps}` : ''
        }: ${goal}`
      );
    }
  }

  addScreenshot(): void {
    this.screenshotCount++;
  }

  updateStatus(message: string): void {
    this.spinner.text = chalk.blue(message);
  }

  complete(status: 'success' | 'failed', message?: string): void {
    const elapsed = this.getElapsedTime();

    if (status === 'success') {
      this.spinner.succeed(chalk.green(message || 'Test completed successfully'));
    } else {
      this.spinner.fail(chalk.red(message || 'Test failed'));
    }

    console.log(chalk.gray(`📸 ${this.screenshotCount} screenshots captured`));
    console.log(chalk.gray(`⏱️  Duration: ${elapsed}`));
  }

  error(message: string): void {
    this.spinner.fail(chalk.red(message));
  }

  private getElapsedTime(): string {
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  private formatAction(action: Action): string | null {
    if (!this.isRecord(action)) return null;

    const actionType = Object.keys(action)[0];
    if (!actionType) return null;

    const params = action[actionType];

    switch (actionType) {
      case 'go_to_url':
        return `🔗 Navigate to: ${this.getStringParam(params, 'url') || params}`;
      case 'click_element':
      case 'click_element_by_index':
        return `🖱️  Click element${
          this.getNumberParam(params, 'index') !== undefined
            ? ` #${this.getNumberParam(params, 'index')}`
            : ''
        }`;
      case 'input_text':
      case 'type_text':
        return `⌨️  Type: "${this.getStringParam(params, 'text') || params}"${
          this.getNumberParam(params, 'index') !== undefined
            ? ` into element #${this.getNumberParam(params, 'index')}`
            : ''
        }`;
      case 'scroll':
        return `📜 Scroll ${this.getStringParam(params, 'direction') || 'down'}`;
      case 'done':
        return `✅ ${this.getStringParam(params, 'text') || 'Task completed'}`;
      default:
        return `${actionType}: ${JSON.stringify(params)}`;
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private getStringParam(params: unknown, key: string): string | undefined {
    if (this.isRecord(params) && typeof params[key] === 'string') {
      return params[key] as string;
    }
    return undefined;
  }

  private getNumberParam(params: unknown, key: string): number | undefined {
    if (this.isRecord(params) && typeof params[key] === 'number') {
      return params[key] as number;
    }
    return undefined;
  }

  getStartTime(): number {
    return this.startTime;
  }
}
