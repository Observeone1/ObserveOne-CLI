import { Command } from 'commander';
import chalk from 'chalk';
import { IConfigService } from '../interfaces/config.interface.js';
import { IApiClient } from '../interfaces/api-client.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';
import { createResourceCommand } from './resource-command.factory.js';
import { attachRunsCommand, printExecutionRuns } from './runs-command.js';
import { ProtocolMonitor, ProtocolMonitorKind } from '../types/index.js';
import { collectOptionValues } from '../utils/cli-input.js';

interface ProtocolMonitorCliConfig {
  kind: ProtocolMonitorKind;
  /** Command + schema key, e.g. `ssl-monitor`. */
  commandName: string;
  /** Extra command aliases, e.g. `ssl`. */
  aliases?: string[];
  /** Plural label for list/fetch messages, e.g. `SSL monitors`. */
  pluralName: string;
  /** Short label for list headers, e.g. `SSL`. */
  label: string;
  description: string;
  /** Adds the type-specific target options (host/port/etc.) to a command. */
  addTypeOptions: (cmd: Command) => void;
  /** Example lines appended to `create --help`. */
  createExamples: string;
}

/**
 * Options shared by every protocol monitor. `forCreate` adds `--no-alerts`
 * (absent on update so an unspecified flag falls through to the existing value
 * rather than forcing alerts back on).
 */
function addCommonOptions(cmd: Command, forCreate: boolean): void {
  cmd
    .option('-n, --name <name>', 'Monitor name')
    .option('-d, --description <description>', 'Monitor description')
    .option('-i, --interval <cron>', 'Cron expression schedule')
    .option('--timeout <ms>', 'Timeout in milliseconds')
    .option('--region <region>', 'Region to run from (repeatable)', collectOptionValues, [])
    .option('--retry-count <n>', 'Number of retries on failure')
    .option('--retry-interval <seconds>', 'Seconds between retries')
    .option('--team-id <id>', 'Owning team ID')
    .option(
      '--alert-channel-id <id>',
      'Attach an alert channel to this monitor (repeatable)',
      collectOptionValues,
      []
    );
  if (forCreate) {
    cmd.option('--no-alerts', 'Disable alerts');
  }
}

/**
 * Factory for a protocol-level monitor command (SSL / TCP / UDP / DB). All four
 * share the same CRUD + run/toggle surface, so this wraps the generic
 * resource-command factory and adds the shared run/toggle-muted/runs commands,
 * keyed by `kind`. Per-type target options (host/port/protocol/…) come from the
 * config's `addTypeOptions`; create/update payloads are built by the
 * schema-driven prompt fallback keyed on `config.commandName`.
 */
export function createProtocolMonitorCommand(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService,
  config: ProtocolMonitorCliConfig
): Command {
  const { kind, commandName, label, pluralName } = config;

  const cmd = createResourceCommand<ProtocolMonitor>(configService, apiClient, outputService, {
    resourceName: commandName,
    pluralName,
    description: config.description,
    apiMethods: {
      list: () => apiClient.getProtocolMonitors(kind),
      listWithFilters: (query) => apiClient.listProtocolMonitors(kind, query),
      get: (id) => apiClient.getProtocolMonitor(kind, id),
      create: (data) => apiClient.createProtocolMonitor(kind, data),
      update: (id, data) => apiClient.updateProtocolMonitor(kind, id, data),
      delete: (id) => apiClient.deleteProtocolMonitor(kind, id),
      toggle: (id) => apiClient.toggleProtocolMonitor(kind, id),
    },
    formatters: {
      list: (items, verbose) => outputService.formatProtocolMonitorList(items, verbose, label),
    },
    createCommandSetup: (createCmd) => {
      config.addTypeOptions(createCmd);
      addCommonOptions(createCmd, true);
    },
    updateCommandSetup: (updateCmd) => {
      config.addTypeOptions(updateCmd);
      addCommonOptions(updateCmd, false);
    },
    // createPrompts/updatePrompts intentionally omitted — the resource-command
    // factory falls back to the schema-driven default built from
    // schemas['<kind>-monitor'].fieldMetadata.
  });

  cmd
    .command('run <id>')
    .description(`Trigger a manual check for ${label === 'SSL' ? 'an' : 'a'} ${label} monitor`)
    .action(async (id: string) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const monitorId = id.trim();
        if (!monitorId) throw new Error('Invalid monitor ID');

        const result = await apiClient.runProtocolMonitor(kind, monitorId);

        if (isJson) {
          outputService.formatJsonOutput({
            executions: result.executions,
            message: result.message,
          });
          return;
        }

        console.log(chalk.bold(`\n ${result.message}`));
        for (const ex of result.executions) {
          console.log(
            chalk.gray(` Region: ${ex.region}  execution: ${ex.execution_id}  status: ${ex.status}`)
          );
        }
        console.log('');
      } catch (err: unknown) {
        const msg = (err as Error).message || 'Failed to run monitor';
        if (isJson) {
          outputService.formatJsonOutput({ status: 'ERROR', error: { message: msg } });
        } else {
          console.error(chalk.red(`\n ${msg}\n`));
        }
        process.exit(1);
      }
    });

  attachRunsCommand(cmd, {
    title: `${label} Monitor Runs`,
    emptyMessage: `No ${label} monitor runs found.`,
    description: 'List recent monitor executions',
    fetchRuns: (id, limit) => apiClient.getProtocolMonitorRuns(kind, id, limit),
    formatRuns: printExecutionRuns,
    outputService,
  });

  cmd
    .command('toggle-muted <id>')
    .description(`Toggle the muted state of ${label === 'SSL' ? 'an' : 'a'} ${label} monitor`)
    .action(async (id: string) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true';
      try {
        const monitorId = id.trim();
        if (!monitorId) throw new Error('Invalid monitor ID');
        const result = await apiClient.toggleMuteProtocolMonitor(kind, monitorId);
        if (isJson) {
          outputService.formatJsonOutput({
            id: monitorId,
            alert_on_failure: result.alert_on_failure,
            message: result.message,
          });
          return;
        }
        console.log(chalk.green(`\n ${result.message}\n`));
      } catch (err: unknown) {
        const msg = (err as Error).message || 'Failed to toggle mute';
        if (isJson) {
          outputService.formatJsonOutput({ status: 'ERROR', error: { message: msg } });
        } else {
          console.error(chalk.red(`\n ${msg}\n`));
        }
        process.exit(1);
      }
    });

  cmd.name(commandName);
  for (const alias of config.aliases ?? []) {
    cmd.alias(alias);
  }

  cmd.commands.find((c) => c.name() === 'create')?.addHelpText('after', config.createExamples);

  return cmd;
}

export function createSslMonitorCommand(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService
): Command {
  return createProtocolMonitorCommand(configService, apiClient, outputService, {
    kind: 'ssl',
    commandName: 'ssl-monitor',
    aliases: ['ssl'],
    pluralName: 'SSL monitors',
    label: 'SSL',
    description: 'Manage SSL certificate monitors',
    addTypeOptions: (cmd) => {
      cmd
        .option('--hostname <hostname>', 'Hostname to check (bare, no scheme or path)')
        .option('--port <port>', 'Port (default: 443)')
        .option('--warn-days <days>', 'Warn this many days before expiry (default: 30)');
    },
    createExamples: `
Examples:
  $ obs ssl-monitor create --name "example cert" --hostname example.com
  $ obs ssl-monitor create --hostname api.example.com --port 8443 --warn-days 14
  $ obs ssl-monitor create --file ssl-monitor.json
`,
  });
}

export function createTcpMonitorCommand(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService
): Command {
  return createProtocolMonitorCommand(configService, apiClient, outputService, {
    kind: 'tcp',
    commandName: 'tcp-monitor',
    aliases: ['tcp'],
    pluralName: 'TCP monitors',
    label: 'TCP',
    description: 'Manage TCP port monitors',
    addTypeOptions: (cmd) => {
      cmd
        .option('--host <host>', 'Host to connect to')
        .option('--port <port>', 'Port to connect to')
        .option('--payload-hex <hex>', 'Optional payload to send, as a hex string')
        .option('--expect-banner <text>', 'Optional banner substring to expect in the response');
    },
    createExamples: `
Examples:
  $ obs tcp-monitor create --name "Postgres" --host db.example.com --port 5432
  $ obs tcp-monitor create --host smtp.example.com --port 25 --expect-banner "220"
  $ obs tcp-monitor create --file tcp-monitor.json
`,
  });
}

export function createUdpMonitorCommand(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService
): Command {
  return createProtocolMonitorCommand(configService, apiClient, outputService, {
    kind: 'udp',
    commandName: 'udp-monitor',
    aliases: ['udp'],
    pluralName: 'UDP monitors',
    label: 'UDP',
    description: 'Manage UDP port monitors',
    addTypeOptions: (cmd) => {
      cmd
        .option('--host <host>', 'Host to send to')
        .option('--port <port>', 'Port to send to')
        .option('--payload-hex <hex>', 'Optional payload to send, as a hex string')
        .option('--expect-response', 'Require a response for the check to pass');
    },
    createExamples: `
Examples:
  $ obs udp-monitor create --name "DNS" --host 1.1.1.1 --port 53 --expect-response
  $ obs udp-monitor create --host ntp.example.com --port 123
  $ obs udp-monitor create --file udp-monitor.json
`,
  });
}

export function createDbMonitorCommand(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService
): Command {
  return createProtocolMonitorCommand(configService, apiClient, outputService, {
    kind: 'db',
    commandName: 'db-monitor',
    aliases: ['db'],
    pluralName: 'database monitors',
    label: 'Database',
    description: 'Manage database reachability monitors (postgres/mysql/redis)',
    addTypeOptions: (cmd) => {
      cmd
        .option('--host <host>', 'Database host')
        .option('--port <port>', 'Database port')
        .option('--protocol <protocol>', 'Database protocol: postgres, mysql, or redis')
        .option('--tls', 'Connect over TLS');
    },
    createExamples: `
Examples:
  $ obs db-monitor create --name "Primary PG" --host db.example.com --port 5432 --protocol postgres
  $ obs db-monitor create --host cache.example.com --port 6379 --protocol redis --tls
  $ obs db-monitor create --file db-monitor.json
`,
  });
}
