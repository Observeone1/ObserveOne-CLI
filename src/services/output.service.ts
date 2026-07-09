import chalk from 'chalk';
import { IOutputService } from '../interfaces/output.interface.js';
import {
  JsonEnvelope,
  UrlMonitor,
  ApiCheck,
  Heartbeat,
  AlertChannel,
  StatusPage,
  Incident,
  Environment,
  ProtocolMonitor,
  Schedule,
  Project,
  ApiCollection,
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

  formatMonitorList(monitors: UrlMonitor[], verbose: boolean = false): void {
    if (monitors.length === 0) {
      this.info('No URL monitors found.');
      return;
    }

    console.log(chalk.bold('\nURL Monitors'));
    console.log(c.muted('─'.repeat(80)));

    monitors.forEach((monitor, index) => {
      const statusText = (monitor.status ?? (monitor.is_active ? 'up' : 'paused')).toUpperCase();
      const statusColor =
        statusText === 'UP'
          ? c.success
          : statusText === 'DOWN'
            ? c.error
            : statusText === 'PAUSED'
              ? c.warning
              : c.accent;
      const status = statusColor(statusText);
      console.log(chalk.bold(`${index + 1}. ${monitor.name} [${status}]`));

      console.log(c.muted(`   URL: ${monitor.url}`));
      console.log(c.muted(`   ID: ${monitor.id}`));

      if (verbose) {
        if (monitor.description) console.log(c.muted(`   Desc: ${monitor.description}`));
        console.log(c.muted(`   Interval: ${monitor.interval || 'Default'}`));
        console.log(c.muted(`   Alerts: ${monitor.alert_on_failure ? 'ON' : 'OFF'}`));
      }
      console.log('');
    });
  }

  formatProtocolMonitorList(
    monitors: ProtocolMonitor[],
    verbose: boolean = false,
    label: string = 'Protocol'
  ): void {
    if (monitors.length === 0) {
      this.info(`No ${label} monitors found.`);
      return;
    }

    console.log(chalk.bold(`\n${label} Monitors`));
    console.log(c.muted('─'.repeat(80)));

    monitors.forEach((monitor, index) => {
      const m = monitor as ProtocolMonitor & {
        hostname?: string;
        host?: string;
        port?: number;
        protocol?: string;
      };
      const statusText = (monitor.status ?? (monitor.is_active ? 'up' : 'paused')).toUpperCase();
      const statusColor =
        statusText === 'UP'
          ? c.success
          : statusText === 'DOWN'
            ? c.error
            : statusText === 'PAUSED'
              ? c.warning
              : c.accent;
      const status = statusColor(statusText);
      console.log(chalk.bold(`${index + 1}. ${monitor.name} [${status}]`));

      const target = `${m.hostname ?? m.host ?? '?'}${m.port ? `:${m.port}` : ''}`;
      const protocolPrefix = m.protocol ? `${m.protocol} ` : '';
      console.log(c.muted(`   Target: ${protocolPrefix}${target}`));
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
      const statusText = (check.status ?? (check.is_active ? 'up' : 'paused')).toUpperCase();
      const statusColor =
        statusText === 'UP'
          ? c.success
          : statusText === 'DOWN'
            ? c.error
            : statusText === 'PAUSED'
              ? c.warning
              : c.accent;
      const status = statusColor(statusText);
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
        hb.status === 'up' ? c.success : hb.status === 'down' ? c.error : c.warning;
      const status = statusColor(hb.status.toUpperCase());

      console.log(chalk.bold(`${index + 1}. ${hb.name} - ${status}`));
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

  formatEnvironmentList(environments: Environment[], verbose: boolean = false): void {
    if (environments.length === 0) {
      this.info('No environments found.');
      return;
    }

    console.log(chalk.bold('\nEnvironments'));
    console.log(c.muted('─'.repeat(80)));

    environments.forEach((env, index) => {
      const varCount = env.variables ? Object.keys(env.variables).length : 0;
      const secretCount = env.secret_keys ? env.secret_keys.length : 0;

      console.log(chalk.bold(`${index + 1}. ${env.name}`));
      if (env.base_url) console.log(c.muted(`   Base URL: ${env.base_url}`));
      console.log(c.muted(`   ID: ${env.id}`));
      console.log(c.muted(`   Variables: ${varCount}  Secrets: ${secretCount}`));

      if (verbose) {
        if (varCount > 0) {
          for (const [key, value] of Object.entries(env.variables ?? {})) {
            console.log(c.muted(`     ${key}=${value}`));
          }
        }
        // Secret values are never returned by the API — only key names.
        if (secretCount > 0) {
          console.log(c.muted(`     Secret keys: ${(env.secret_keys ?? []).join(', ')}`));
        }
      }
      console.log('');
    });
  }

  formatProjectList(projects: Project[], verbose: boolean = false): void {
    if (projects.length === 0) {
      this.info('No projects found.');
      return;
    }

    console.log(chalk.bold('\nProjects'));
    console.log(c.muted('─'.repeat(80)));

    projects.forEach((project, index) => {
      console.log(chalk.bold(`${index + 1}. ${project.name}`));
      console.log(c.muted(`   ID: ${project.id}`));
      if (verbose && project.description) {
        console.log(c.muted(`   Desc: ${project.description}`));
      }
      console.log('');
    });
  }

  formatApiCollectionList(collections: ApiCollection[], verbose: boolean = false): void {
    if (collections.length === 0) {
      this.info('No API collections found.');
      return;
    }

    console.log(chalk.bold('\nAPI Collections'));
    console.log(c.muted('─'.repeat(80)));

    collections.forEach((collection, index) => {
      const headerCount = collection.headers ? Object.keys(collection.headers).length : 0;
      console.log(chalk.bold(`${index + 1}. ${collection.name}`));
      if (collection.base_url) console.log(c.muted(`   Base URL: ${collection.base_url}`));
      console.log(c.muted(`   ID: ${collection.id}`));
      console.log(c.muted(`   Headers: ${headerCount}`));

      if (verbose && headerCount > 0) {
        for (const [key, value] of Object.entries(collection.headers ?? {})) {
          console.log(c.muted(`     ${key}: ${value}`));
        }
      }
      console.log('');
    });
  }

  formatScheduleList(schedules: Schedule[], verbose: boolean = false): void {
    if (schedules.length === 0) {
      this.info('No schedules found.');
      return;
    }

    console.log(chalk.bold('\nSchedules'));
    console.log(c.muted('─'.repeat(80)));

    schedules.forEach((schedule, index) => {
      const state = schedule.is_active ? c.success('ACTIVE') : c.warning('PAUSED');
      console.log(chalk.bold(`${index + 1}. ${schedule.cron_expression} [${state}]`));
      console.log(c.muted(`   ID: ${schedule.id}`));
      console.log(c.muted(`   Test: ${schedule.test_id}`));

      if (verbose) {
        console.log(
          c.muted(
            `   Next run: ${schedule.next_run_at ? new Date(schedule.next_run_at).toLocaleString() : 'n/a'}`
          )
        );
        console.log(
          c.muted(
            `   Last run: ${schedule.last_run_at ? new Date(schedule.last_run_at).toLocaleString() : 'Never'}`
          )
        );
        console.log(c.muted(`   Alerts: ${schedule.alert_on_failure ? 'ON' : 'OFF'}`));
        if (schedule.retry_count != null) {
          console.log(
            c.muted(
              `   Retries: ${schedule.retry_count}${
                schedule.retry_interval != null ? ` (every ${schedule.retry_interval}s)` : ''
              }`
            )
          );
        }
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
        chalk.bold(
          `${index + 1}. ${incident.title} [${incident.priority.charAt(0) + incident.priority.slice(1).toLowerCase()}] (${incident.status})`
        )
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
