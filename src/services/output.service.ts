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
  AlertChannel,
  StatusPage,
  Incident,
} from '../types/index.js';
import { brand as c } from '../utils/theme.js';

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
    console.log(c.success(`✓ ${message}`));
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
    console.error(c.error(`✗ ${message}`));
  }

  warning(message: string): void {
    if (this.isJsonMode) return;
    console.log(c.warning(`! ${message}`));
  }

  info(message: string): void {
    if (this.isJsonMode) return;
    console.log(c.muted(message));
  }

  progress(message: string): void {
    if (this.isJsonMode) return;
    console.log(c.accent(message));
  }

  formatTestList(tests: Test[], verbose: boolean = false): void {
    if (tests.length === 0) {
      this.info('No AI browser checks found.');
      return;
    }

    console.log(chalk.bold('\nAI Browser Checks'));
    console.log(c.muted('─'.repeat(80)));

    tests.forEach((test, index) => {
      console.log(chalk.bold(`${index + 1}. ${test.name}`));
      if (test.description) {
        console.log(c.muted(`   ${test.description}`));
      }
      console.log(c.muted(`   URL: ${test.url}`));
      console.log(c.muted(`   ID: ${test.id}`));

      if (verbose) {
        console.log(c.muted(`   Prompt: ${test.prompt}`));
        console.log(c.muted(`   Created: ${new Date(test.created_at).toLocaleString()}`));
      }
      console.log('');
    });
  }

  formatMonitorList(monitors: UrlMonitor[], verbose: boolean = false): void {
    if (monitors.length === 0) {
      this.info('No URL monitors found.');
      return;
    }

    console.log(chalk.bold('\nURL Monitors'));
    console.log(c.muted('─'.repeat(80)));

    monitors.forEach((monitor, index) => {
      const status = monitor.is_active ? c.success('ACTIVE') : c.warning('PAUSED');
      console.log(chalk.bold(`${index + 1}. ${monitor.name} [${status}]`));

      console.log(c.muted(`   URL: ${monitor.url}`));
      console.log(c.muted(`   ID: ${monitor.id}`));

      if (verbose) {
        if (monitor.description) console.log(c.muted(`   Desc: ${monitor.description}`));
        console.log(c.muted(`   Interval: ${monitor.cron_expression || 'Default'}`));
        console.log(c.muted(`   Alerts: ${monitor.alert_on_failure ? 'ON' : 'OFF'}`));
      }
      console.log('');
    });
  }

  formatApiCheckList(checks: ApiCheck[], verbose: boolean = false): void {
    if (checks.length === 0) {
      this.info('No API checks found.');
      return;
    }

    console.log(chalk.bold('\nAPI Checks'));
    console.log(c.muted('─'.repeat(80)));

    checks.forEach((check, index) => {
      const status = check.is_active ? c.success('ACTIVE') : c.warning('PAUSED');
      console.log(chalk.bold(`${index + 1}. ${check.name} [${status}]`));

      console.log(c.muted(`   Endpoint: ${check.method} ${check.url}`));
      console.log(c.muted(`   ID: ${check.id}`));

      if (verbose) {
        if (check.description) console.log(c.muted(`   Desc: ${check.description}`));
        console.log(c.muted(`   Assertions: ${check.assertions?.length || 0}`));
      }
      console.log('');
    });
  }

  formatHeartbeatList(heartbeats: Heartbeat[], verbose: boolean = false): void {
    if (heartbeats.length === 0) {
      this.info('No heartbeats found.');
      return;
    }

    console.log(chalk.bold('\nHeartbeats'));
    console.log(c.muted('─'.repeat(80)));

    heartbeats.forEach((hb, index) => {
      const statusColor =
        hb.status === 'UP' ? c.success : hb.status === 'DOWN' ? c.error : c.warning;
      const status = statusColor(hb.status);
      const activeStatus = hb.is_active ? '' : c.warning(' (PAUSED)');

      console.log(chalk.bold(`${index + 1}. ${hb.name} - ${status}${activeStatus}`));
      console.log(c.muted(`   Key: ${hb.ping_key}`));
      console.log(c.muted(`   ID: ${hb.id}`));

      if (verbose) {
        console.log(c.muted(`   Period: ${hb.period}s (Grace: ${hb.grace_period}s)`));
        console.log(
          c.muted(
            `   Last Ping: ${hb.last_ping_at ? new Date(hb.last_ping_at).toLocaleString() : 'Never'}`
          )
        );
      }
      console.log('');
    });
  }

  formatAlertChannelList(channels: AlertChannel[], verbose: boolean = false): void {
    if (channels.length === 0) {
      this.info('No alert channels found.');
      return;
    }

    console.log(chalk.bold('\nAlert Channels'));
    console.log(c.muted('─'.repeat(80)));

    channels.forEach((channel, index) => {
      const defaultFlag = channel.is_default ? c.success('DEFAULT') : c.muted('CUSTOM');
      console.log(chalk.bold(`${index + 1}. ${channel.name} [${channel.type}] (${defaultFlag})`));
      console.log(c.muted(`   ID: ${channel.id}`));

      if (verbose) {
        const configKeys = Object.keys(channel.config || {});
        console.log(
          c.muted(`   Config keys: ${configKeys.length ? configKeys.join(', ') : 'None'}`)
        );
      }
      console.log('');
    });
  }

  formatStatusPageList(statusPages: StatusPage[], verbose: boolean = false): void {
    if (statusPages.length === 0) {
      this.info('No status pages found.');
      return;
    }

    console.log(chalk.bold('\nStatus Pages'));
    console.log(c.muted('─'.repeat(80)));

    statusPages.forEach((page, index) => {
      const visibility = page.is_public ? c.success('PUBLIC') : c.warning('PRIVATE');
      console.log(chalk.bold(`${index + 1}. ${page.name} [${visibility}]`));
      console.log(c.muted(`   Slug: ${page.slug}`));
      console.log(c.muted(`   ID: ${page.id}`));

      if (verbose) {
        if (page.description) console.log(c.muted(`   Desc: ${page.description}`));
        if (page.theme_primary_color)
          console.log(c.muted(`   Theme Primary: ${page.theme_primary_color}`));
        if (page.theme_background_color)
          console.log(c.muted(`   Theme Background: ${page.theme_background_color}`));
      }
      console.log('');
    });
  }

  formatIncidentList(incidents: Incident[], verbose: boolean = false): void {
    if (incidents.length === 0) {
      this.info('No incidents found.');
      return;
    }

    console.log(chalk.bold('\nIncidents'));
    console.log(c.muted('─'.repeat(80)));

    incidents.forEach((incident, index) => {
      console.log(
        chalk.bold(`${index + 1}. ${incident.title} [${incident.priority}] (${incident.status})`)
      );
      console.log(c.muted(`   ID: ${incident.id}`));
      if (incident.assigned_to) {
        console.log(c.muted(`   Assigned: ${incident.assigned_to}`));
      }

      if (verbose && incident.description) {
        console.log(c.muted(`   Desc: ${incident.description}`));
      }
      console.log('');
    });
  }

  formatTestExecution(execution: TestExecution): void {
    const statusColor = this.getStatusColor(execution.status);
    const statusIcon = this.getStatusIcon(execution.status);

    console.log(chalk.bold('\nExecution Status'));
    console.log(c.muted('─'.repeat(50)));
    console.log(`Status: ${statusColor(`${statusIcon} ${execution.status}`)}`);
    console.log(`Execution ID: ${execution.id}`);
    console.log(`Test ID: ${execution.test_id}`);
    console.log(`Started: ${new Date(execution.started_at).toLocaleString()}`);

    if (execution.completed_at) {
      console.log(`Completed: ${new Date(execution.completed_at).toLocaleString()}`);
    }

    if (execution.error_message) {
      console.log(c.error(`Error: ${execution.error_message}`));
    }

    if (execution.task_id) {
      console.log(`Task ID: ${execution.task_id}`);
    }
  }

  formatTestResult(result: TestResult): void {
    const statusColor = this.getStatusColor(result.status);
    const statusIcon = this.getStatusIcon(result.status);

    console.log(chalk.bold('\nResult'));
    console.log(c.muted('─'.repeat(50)));
    console.log(`Status: ${statusColor(`${statusIcon} ${result.status}`)}`);
    console.log(`Message: ${result.message}`);

    if (result.task_id) {
      console.log(`Task ID: ${result.task_id}`);
    }

    if (result.duration) {
      console.log(`Duration: ${(result.duration / 1000).toFixed(2)}s`);
    }

    if (result.screenshots && result.screenshots.length > 0) {
      console.log(c.muted(`\nScreenshots: ${result.screenshots.length} captured`));
    }
  }

  formatJsonOutput(data: unknown): void {
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

  formatJUnitReport(testSuite: {
    name: string;
    tests: number;
    failures: number;
    errors: number;
    time: string;
    testCases: Array<{
      name: string;
      classname: string;
      time: string;
      status: string;
      failure?: {
        message: string;
        type: string;
        stackTrace?: string;
      };
    }>;
  }): string {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="${this.escapeXml(testSuite.name)}" tests="${testSuite.tests}" failures="${
      testSuite.failures
    }" errors="${testSuite.errors}" time="${testSuite.time}">
${testSuite.testCases
  .map((testCase) => {
    let xmlCase = `  <testcase name="${this.escapeXml(testCase.name)}" classname="${this.escapeXml(testCase.classname)}" time="${testCase.time}">`;

    if (testCase.status === 'failed' && testCase.failure) {
      xmlCase += `\r\n    <failure message="${this.escapeXml(testCase.failure.message)}" type="${this.escapeXml(
        testCase.failure.type
      )}">\r\n${this.escapeXml(testCase.failure.stackTrace || '')}\r\n    </failure>`;
    } else if (testCase.status === 'skipped') {
      xmlCase += `\r\n    <skipped/>`;
    }

    xmlCase += `\r\n  </testcase>`;
    return xmlCase;
  })
  .join('\n')}
</testsuite>`;

    return xml;
  }

  private getStatusColor(status: string): (text: string) => string {
    switch (status.toUpperCase()) {
      case 'SUCCESS':
        return c.success;
      case 'FAILED':
        return c.error;
      case 'RUNNING':
        return c.accent;
      case 'PENDING':
        return c.warning;
      case 'CANCELLED':
        return c.muted;
      default:
        return chalk.white;
    }
  }

  private getStatusIcon(status: string): string {
    switch (status.toUpperCase()) {
      case 'SUCCESS':
        return '✓';
      case 'FAILED':
        return '✗';
      case 'RUNNING':
        return '~';
      case 'PENDING':
        return '-';
      case 'CANCELLED':
        return '·';
      default:
        return '?';
    }
  }

  formatError(error: unknown): string {
    const err = error as {
      response?: { status: number; data?: { error?: string; message?: string } };
      message?: string;
      request?: unknown;
    };
    if (err.response) {
      const status = err.response.status;
      const message = err.response.data?.error || err.response.data?.message || err.message;
      return `API Error (${status}): ${message}`;
    } else if (err.request) {
      return `Network Error: Unable to connect to API. Please check your internet connection and API URL.`;
    } else {
      return err.message || 'An unknown error occurred';
    }
  }
}
