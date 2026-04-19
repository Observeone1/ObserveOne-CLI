import ora, { Ora } from 'ora';
import chalk from 'chalk';
import { brand as c } from './theme.js';

export interface ProgressOptions {
  verbose?: boolean;
}

interface StepDetails {
  evaluation?: string;
  actions?: Array<Record<string, unknown>>;
  result?: Array<{ error?: string; success?: boolean }>;
}

export class LiveProgressRenderer {
  private currentStep = 0;
  private totalSteps = 0;
  private startTime = Date.now();
  private screenshotCount = 0;
  private spinner: Ora;
  private verbose: boolean;
  private testName: string = '';

  constructor(options: ProgressOptions = {}) {
    this.verbose = options.verbose || false;
    this.spinner = ora();
  }

  start(testName: string): void {
    this.testName = testName;
    console.log(c.success.bold(`\n${testName}`));
    console.log(c.muted('━'.repeat(50)));
    this.spinner.start(c.accent('Connecting to execution stream...'));
  }

  updateStep(stepNumber: number, goal: string, details?: StepDetails): void {
    this.currentStep = stepNumber;
    const elapsed = this.getElapsedTime();

    if (this.verbose && details) {
      this.spinner.stop();
      console.log(
        chalk.bold(`\nStep ${stepNumber}${this.totalSteps > 0 ? `/${this.totalSteps}` : ''}:`)
      );
      console.log(c.accent(`  Goal: ${goal}`));

      if (details.evaluation) {
        console.log(c.muted(`  Evaluation: ${details.evaluation}`));
      }

      if (details.actions && details.actions.length > 0) {
        console.log(c.warning('  Actions:'));
        details.actions.forEach((action) => {
          const actionText = this.formatAction(action);
          if (actionText) {
            console.log(c.muted(`    ${actionText}`));
          }
        });
      }

      if (details.result && details.result.length > 0) {
        console.log(c.success('  Results:'));
        details.result.forEach((result) => {
          if (result.error) {
            console.log(c.error(`    ✗ ${result.error}`));
          } else {
            console.log(c.success(`    ✓ Success`));
          }
        });
      }

      this.spinner.start(c.accent(`${elapsed} · Running...`));
    } else {
      this.spinner.text = c.accent(
        `${elapsed} · Step ${stepNumber}${
          this.totalSteps > 0 ? `/${this.totalSteps}` : ''
        }: ${goal}`
      );
    }
  }

  addScreenshot(): void {
    this.screenshotCount++;
  }

  updateStatus(message: string): void {
    this.spinner.text = c.accent(message);
  }

  complete(status: 'success' | 'failed', message?: string): void {
    const elapsed = this.getElapsedTime();

    if (status === 'success') {
      this.spinner.succeed(c.success(message || 'Test completed successfully'));
    } else {
      this.spinner.fail(c.error(message || 'Test failed'));
    }

    console.log(c.muted(`${this.screenshotCount} screenshots · ${elapsed}`));
  }

  error(message: string): void {
    this.spinner.fail(c.error(message));
  }

  private getElapsedTime(): string {
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  private formatAction(action: Record<string, unknown>): string | null {
    if (!action) return null;

    const actionType = Object.keys(action)[0];
    if (!actionType) return null;

    const params = action[actionType] as Record<string, unknown>;

    switch (actionType) {
      case 'go_to_url':
        return `Navigate to: ${params?.url || params}`;
      case 'click_element':
      case 'click_element_by_index':
        return `Click element${params?.index !== undefined ? ` #${params.index}` : ''}`;
      case 'input_text':
      case 'type_text':
        return `Type: "${params?.text || params}"${
          params?.index !== undefined ? ` into element #${params.index}` : ''
        }`;
      case 'scroll':
        return `Scroll ${params?.direction || 'down'}`;
      case 'done':
        return params?.text as string || 'Task completed';
      default:
        return `${actionType}: ${JSON.stringify(params)}`;
    }
  }

  getStartTime(): number {
    return this.startTime;
  }
}
