import chalk from 'chalk';
import { IOutputService } from '../interfaces/output.interface.js';
import {
  JsonEnvelope,
  Test,
  TestExecution,
  TestResult,
  UrlMonitor,
  ApiCheck,
  Heartbeat,
} from '../types/index.js';

/**
 * Output formatting service implementation
 * Handles console output and formatting
 */
export class OutputService implements IOutputService {
  private isJsonMode: boolean = false;

  enableJsonMode(): void {
    this.isJsonMode = true;
  }
  success(message: string): void {
    if (this.isJsonMode) return;
    console.log(chalk.green(`✅ ${message}`));
  }

  error(message: string): void {
    if (this.isJsonMode) {
      const envelope: JsonEnvelope = {
        status: 'ERROR',
        error: { message },
        metadata: { timestamp: new Date().toISOString() },
      };
      console.log(JSON.stringify(envelope, null, 2));
      return;
    }
    console.error(chalk.red(`❌ ${message}`));
  }

  warning(message: string): void {
    if (this.isJsonMode) return;
    console.log(chalk.yellow(`⚠️  ${message}`));
  }

  info(message: string): void {
    if (this.isJsonMode) return;
    console.log(chalk.blue(`ℹ️  ${message}`));
  }

  progress(message: string): void {
    if (this.isJsonMode) return;
    console.log(chalk.cyan(`🔄 ${message}`));
  }

  formatTestList(tests: Test[], verbose: boolean = false): void {
    if (tests.length === 0) {
      this.info('No AI browser checks found.');
      return;
    }

    console.log(chalk.bold('\n🤖 AI Browser Checks:'));
    console.log(chalk.gray('─'.repeat(80)));

    tests.forEach((test, index) => {
      console.log(chalk.bold(`${index + 1}. ${test.name}`));
      if (test.description) {
        console.log(chalk.gray(`   ${test.description}`));
      }
      console.log(chalk.gray(`   URL: ${test.url}`));
      console.log(chalk.gray(`   ID: ${test.id}`));

      if (verbose) {
        console.log(chalk.gray(`   Prompt: ${test.prompt}`));
        console.log(chalk.gray(`   Created: ${new Date(test.created_at).toLocaleString()}`));
      }
      console.log('');
    });
  }

  formatMonitorList(monitors: UrlMonitor[], verbose: boolean = false): void {
    if (monitors.length === 0) {
      this.info('No URL monitors found.');
      return;
    }

    console.log(chalk.bold('\n🌐 URL Monitors:'));
    console.log(chalk.gray('─'.repeat(80)));

    monitors.forEach((monitor, index) => {
      const status = monitor.is_active ? chalk.green('ACTIVE') : chalk.yellow('PAUSED');
      console.log(chalk.bold(`${index + 1}. ${monitor.name} [${status}]`));

      console.log(chalk.gray(`   URL: ${monitor.url}`));
      console.log(chalk.gray(`   ID: ${monitor.id}`));

      if (verbose) {
        if (monitor.description) console.log(chalk.gray(`   Desc: ${monitor.description}`));
        console.log(chalk.gray(`   Interval: ${monitor.cron_expression || 'Default'}`));
        console.log(chalk.gray(`   Alerts: ${monitor.alert_on_failure ? 'ON' : 'OFF'}`));
      }
      console.log('');
    });
  }

  formatApiCheckList(checks: ApiCheck[], verbose: boolean = false): void {
    if (checks.length === 0) {
      this.info('No API checks found.');
      return;
    }

    console.log(chalk.bold('\n🔌 API Checks:'));
    console.log(chalk.gray('─'.repeat(80)));

    checks.forEach((check, index) => {
      const status = check.is_active ? chalk.green('ACTIVE') : chalk.yellow('PAUSED');
      console.log(chalk.bold(`${index + 1}. ${check.name} [${status}]`));

      console.log(chalk.gray(`   Endpoint: ${check.method} ${check.url}`));
      console.log(chalk.gray(`   ID: ${check.id}`));

      if (verbose) {
        if (check.description) console.log(chalk.gray(`   Desc: ${check.description}`));
        console.log(chalk.gray(`   Assertions: ${check.assertions?.length || 0}`));
      }
      console.log('');
    });
  }

  formatHeartbeatList(heartbeats: Heartbeat[], verbose: boolean = false): void {
    if (heartbeats.length === 0) {
      this.info('No heartbeats found.');
      return;
    }

    console.log(chalk.bold('\n💓 Heartbeats:'));
    console.log(chalk.gray('─'.repeat(80)));

    heartbeats.forEach((hb, index) => {
      const statusColor =
        hb.status === 'UP' ? chalk.green : hb.status === 'DOWN' ? chalk.red : chalk.yellow;
      const status = statusColor(hb.status);
      const activeStatus = hb.is_active ? '' : chalk.yellow(' (PAUSED)');

      console.log(chalk.bold(`${index + 1}. ${hb.name} - ${status}${activeStatus}`));
      console.log(chalk.gray(`   Key: ${hb.ping_key}`));
      console.log(chalk.gray(`   ID: ${hb.id}`));

      if (verbose) {
        console.log(chalk.gray(`   Period: ${hb.period}s (Grace: ${hb.grace_period}s)`));
        console.log(
          chalk.gray(
            `   Last Ping: ${hb.last_ping_at ? new Date(hb.last_ping_at).toLocaleString() : 'Never'}`
          )
        );
      }
      console.log('');
    });
  }

  formatTestExecution(execution: TestExecution): void {
    const statusColor = this.getStatusColor(execution.status);
    const statusIcon = this.getStatusIcon(execution.status);

    console.log(chalk.bold('\n📊 Test Execution Status:'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`Status: ${statusColor(`${statusIcon} ${execution.status}`)}`);
    console.log(`Execution ID: ${execution.id}`);
    console.log(`Test ID: ${execution.test_id}`);
    console.log(`Started: ${new Date(execution.started_at).toLocaleString()}`);

    if (execution.completed_at) {
      console.log(`Completed: ${new Date(execution.completed_at).toLocaleString()}`);
    }

    if (execution.error_message) {
      console.log(chalk.red(`Error: ${execution.error_message}`));
    }

    if (execution.task_id) {
      console.log(`Task ID: ${execution.task_id}`);
    }
  }

  formatTestResult(result: TestResult): void {
    const statusColor = this.getStatusColor(result.status);
    const statusIcon = this.getStatusIcon(result.status);

    console.log(chalk.bold('\n🎯 Test Result:'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`Status: ${statusColor(`${statusIcon} ${result.status}`)}`);
    console.log(`Message: ${result.message}`);

    if (result.task_id) {
      console.log(`Task ID: ${result.task_id}`);
    }

    if (result.duration) {
      console.log(`Duration: ${(result.duration / 1000).toFixed(2)}s`);
    }

    if (result.screenshots && result.screenshots.length > 0) {
      console.log(chalk.blue(`\n📸 Screenshots: ${result.screenshots.length} captured`));
    }
  }

  formatJsonOutput(data: any): void {
    const envelope: JsonEnvelope = {
      status: 'SUCCESS',
      data,
      metadata: {
        timestamp: new Date().toISOString(),
      },
    };
    console.log(JSON.stringify(envelope, null, 2));
  }

  private escapeXml(unsafe: string): string {
    return unsafe.replace(/[<>&'"]/g, function (c) {
      switch (c) {
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '&':
          return '&amp;';
        case "'":
          return '&apos;';
        case '"':
          return '&quot;';
        default:
          return c;
      }
    });
  }

  formatJUnitReport(testSuite: any): string {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="${this.escapeXml(testSuite.name)}" tests="${testSuite.tests}" failures="${
      testSuite.failures
    }" errors="${testSuite.errors}" time="${testSuite.time}">
${testSuite.testCases
  .map((testCase: any) => {
    let xml = `  <testcase name="${this.escapeXml(testCase.name)}" classname="${this.escapeXml(testCase.classname)}" time="${testCase.time}">`;

    if (testCase.status === 'failed' && testCase.failure) {
      xml += `\r\n    <failure message="${this.escapeXml(testCase.failure.message)}" type="${this.escapeXml(
        testCase.failure.type
      )}">\r\n${this.escapeXml(testCase.failure.stackTrace || '')}\r\n    </failure>`;
    } else if (testCase.status === 'skipped') {
      xml += `\r\n    <skipped/>`;
    }

    xml += `\r\n  </testcase>`;
    return xml;
  })
  .join('\n')}
</testsuite>`;

    return xml;
  }

  private getStatusColor(status: string): (text: string) => string {
    switch (status.toUpperCase()) {
      case 'SUCCESS':
        return chalk.green;
      case 'FAILED':
        return chalk.red;
      case 'RUNNING':
        return chalk.blue;
      case 'PENDING':
        return chalk.yellow;
      case 'CANCELLED':
        return chalk.gray;
      default:
        return chalk.white;
    }
  }

  private getStatusIcon(status: string): string {
    switch (status.toUpperCase()) {
      case 'SUCCESS':
        return '✅';
      case 'FAILED':
        return '❌';
      case 'RUNNING':
        return '🔄';
      case 'PENDING':
        return '⏳';
      case 'CANCELLED':
        return '⏹️';
      default:
        return '❓';
    }
  }

  formatError(error: any): string {
    if (error.response) {
      // API error
      const status = error.response.status;
      const message = error.response.data?.error || error.response.data?.message || error.message;
      return `API Error (${status}): ${message}`;
    } else if (error.request) {
      // Network error
      return `Network Error: Unable to connect to API. Please check your internet connection and API URL.`;
    } else {
      // Other error
      return error.message || 'An unknown error occurred';
    }
  }
}
