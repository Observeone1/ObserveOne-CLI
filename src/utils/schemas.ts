import { parseKeyValuePairs, parseIdList, type CliListInput } from './cli-input.js';

export type InquirerType = 'input' | 'list' | 'number' | 'confirm';

export interface FieldSchema {
  /** CLI option key (camelCase). If omitted, no CLI flag is bound to this field. */
  flagName?: string;
  /** Inquirer prompt type for interactive fallback. */
  inquirerType?: InquirerType;
  /** Prompt message (with trailing colon, e.g. "Monitor name:"). */
  label?: string;
  /** Force an interactive prompt on create when the flag is missing. */
  requiredOnCreate?: boolean;
  /** Whether the field appears in update payloads. Default true. */
  updatable?: boolean;
  /** Default value emitted on create when option and prompt are both absent. */
  default?: unknown;
  /** Inquirer choices for list-type fields. */
  choices?: readonly string[];
  /** Synchronous validator (returns true or an error message). */
  validate?: (val: unknown) => boolean | string;
  /** Transform a CLI string or inquirer answer before merging into the payload. */
  transformer?: (val: unknown) => unknown;
  /**
   * Treat an empty array value as if the flag wasn't passed at all.
   *
   * Needed for fields backed by commander's repeatable-option collector
   * (`.option('-a, --foo <v>', 'desc', collectOptionValues, [])`) where the
   * empty `[]` default is indistinguishable from the user explicitly clearing
   * the field. With this opt-in, an empty array falls through to `existing`
   * on update (rather than wiping the existing value).
   */
  treatEmptyArrayAsAbsent?: boolean;
}

export interface ResourceSchema {
  description: string;
  required: string[];
  template: Record<string, unknown>;
  /** Per-field metadata that drives the schema-driven prompt fallback in the resource-command factory. */
  fieldMetadata?: Record<string, FieldSchema>;
  /**
   * Extra CLI flag names (camelCase) that count toward the "any updatable
   * field was passed" check on update, but don't appear in the payload
   * directly. Use for inputs that flow into a custom composer (e.g.
   * alert-channel's --email / --webhook-url which feed buildConfigFromOptions
   * to produce a single `config` field).
   */
  extraUpdateTriggers?: readonly string[];
}

const trimNonEmpty =
  (label: string) =>
  (val: unknown): boolean | string =>
    typeof val === 'string' && val.trim().length > 0 ? true : `${label} is required`;

const validateUrl = (val: unknown): boolean | string => {
  if (typeof val !== 'string') return 'Please enter a valid URL (e.g. https://example.com)';
  try {
    new URL(val);
    return true;
  } catch {
    return 'Please enter a valid URL (e.g. https://example.com)';
  }
};

const validateMinLength =
  (label: string, min: number) =>
  (val: unknown): boolean | string =>
    typeof val === 'string' && val.trim().length >= min ? true : `${label} is required`;

/** Coerce CLI strings to integers; leave inquirer numbers untouched. */
const toInt = (val: unknown): unknown => (typeof val === 'string' ? Number.parseInt(val, 10) : val);

const toUpper = (val: unknown): unknown => (typeof val === 'string' ? val.toUpperCase() : val);

const toLower = (val: unknown): unknown => (typeof val === 'string' ? val.toLowerCase() : val);

const negateBool = (val: unknown): unknown => !val;

/** Bare hostname (no scheme, no path) — mirrors the backend SSL-monitor refine. */
const validateHostname = (val: unknown): boolean | string => {
  if (typeof val !== 'string' || val.trim().length === 0) return 'Hostname is required';
  if (/^https?:\/\//i.test(val) || val.includes('/')) {
    return 'Enter a bare hostname without scheme or path (e.g. example.com)';
  }
  return true;
};

const DB_PROTOCOLS = ['postgres', 'mysql', 'redis'] as const;

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'] as const;
const INCIDENT_PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
const ALERT_CHANNEL_TYPES = [
  'email',
  'slack',
  'discord',
  'teams',
  'telegram',
  'sms',
  'webhook',
] as const;

/** `name` field shared by every protocol-monitor schema (ssl/tcp/udp/db). */
const monitorNameField: FieldSchema = {
  flagName: 'name',
  inquirerType: 'input',
  label: 'Monitor name:',
  requiredOnCreate: true,
  validate: trimNonEmpty('Name'),
};

/** `host` field shared by the tcp/udp/db monitor schemas. */
const monitorHostField: FieldSchema = {
  flagName: 'host',
  inquirerType: 'input',
  label: 'Host:',
  requiredOnCreate: true,
  validate: trimNonEmpty('Host'),
};

/** Required `port` field shared by the tcp/udp/db monitor schemas. */
const monitorPortField: FieldSchema = {
  flagName: 'port',
  inquirerType: 'number',
  label: 'Port:',
  requiredOnCreate: true,
  transformer: toInt,
};

/**
 * Common fieldMetadata tail shared by the ssl/tcp/udp/db monitor schemas.
 * Spread LAST in each schema so prompt/key order stays identical to the
 * previous hand-written literals. Only the cron default differs per schema.
 */
const protocolMonitorCommonFields = (defaultCron: string): Record<string, FieldSchema> => ({
  cron_expression: { flagName: 'interval', default: defaultCron },
  description: { flagName: 'description', default: '' },
  alert_on_failure: { flagName: 'alerts', default: true },
  timeout_ms: { flagName: 'timeout', default: 30000, transformer: toInt },
  regions: { flagName: 'region', treatEmptyArrayAsAbsent: true },
  retry_count: { flagName: 'retryCount', transformer: toInt },
  retry_interval: { flagName: 'retryInterval', transformer: toInt },
  team_id: { flagName: 'teamId' },
  channel_ids: {
    flagName: 'alertChannelId',
    default: [],
    treatEmptyArrayAsAbsent: true,
    transformer: (v) => parseIdList(v as CliListInput, 'alert-channel-id') ?? [],
  },
});

export const schemas: Record<string, ResourceSchema> = {
  monitor: {
    description: 'URL monitor — pings an HTTP endpoint on a cron schedule',
    required: ['name', 'url'],
    template: {
      name: 'My Monitor',
      url: 'https://example.com',
      interval: '*/5 * * * *',
      timeout_ms: 30000,
      alert_on_failure: true,
      description: '',
      channel_ids: [],
    },
    fieldMetadata: {
      name: {
        flagName: 'name',
        inquirerType: 'input',
        label: 'Monitor name:',
        requiredOnCreate: true,
        validate: trimNonEmpty('Name'),
      },
      url: {
        flagName: 'url',
        inquirerType: 'input',
        label: 'URL to monitor:',
        requiredOnCreate: true,
        validate: validateUrl,
      },
      interval: {
        flagName: 'interval',
        inquirerType: 'input',
        label: 'Cron interval (default: Every 5 mins):',
        default: '*/5 * * * *',
      },
      description: { flagName: 'description', default: '' },
      // `--no-alerts` flag → options.alerts === false on commander; absence
      // is undefined, so the default fires and alert_on_failure stays true.
      alert_on_failure: { flagName: 'alerts', default: true },
      timeout_ms: { default: 30000 },
      channel_ids: {
        flagName: 'alertChannelId',
        default: [],
        treatEmptyArrayAsAbsent: true,
        transformer: (v) => parseIdList(v as CliListInput, 'alert-channel-id') ?? [],
      },
    },
  },
  check: {
    description: 'API check — HTTP request with method/headers/body/assertions',
    required: ['name', 'url', 'method'],
    template: {
      name: 'My API Check',
      url: 'https://api.example.com/health',
      method: 'GET',
      cron_expression: '*/5 * * * *',
      timeout_ms: 30000,
      alert_on_failure: true,
      headers: {},
      body: '',
      assertions: [],
      description: '',
      channel_ids: [],
    },
    fieldMetadata: {
      name: {
        flagName: 'name',
        inquirerType: 'input',
        label: 'Check name:',
        requiredOnCreate: true,
        validate: trimNonEmpty('Name'),
      },
      url: {
        flagName: 'url',
        inquirerType: 'input',
        label: 'API URL:',
        requiredOnCreate: true,
        validate: trimNonEmpty('URL'),
      },
      method: {
        flagName: 'method',
        inquirerType: 'list',
        label: 'HTTP Method:',
        // Not requiredOnCreate — mirrors old behavior where method silently
        // defaults to GET when the flag is missing. Still gets prompted as
        // part of the batch when name or url are missing.
        choices: HTTP_METHODS,
        default: 'GET',
        transformer: toUpper,
      },
      description: { flagName: 'description', default: '' },
      body: { flagName: 'body' },
      cron_expression: { flagName: 'interval' },
      headers: {
        flagName: 'header',
        treatEmptyArrayAsAbsent: true,
        transformer: (v) => parseKeyValuePairs(v as CliListInput, 'header'),
      },
      regions: { flagName: 'regions', treatEmptyArrayAsAbsent: true },
      retry_count: { flagName: 'retryCount', transformer: toInt },
      retry_interval: { flagName: 'retryInterval', transformer: toInt },
      channel_ids: {
        flagName: 'alertChannelId',
        default: [],
        treatEmptyArrayAsAbsent: true,
        transformer: (v) =>
          parseIdList(v as string | string[] | undefined, 'alert-channel-id') ?? [],
      },
      alert_on_failure: { flagName: 'alerts', default: true },
      timeout_ms: { default: 30000 },
    },
  },
  heartbeat: {
    description: 'Heartbeat — inbound ping receiver with grace period',
    required: ['name'],
    template: {
      name: 'My Heartbeat',
      period: 300,
      grace_period: 60,
      description: '',
    },
    fieldMetadata: {
      name: {
        flagName: 'name',
        inquirerType: 'input',
        label: 'Heartbeat name:',
        requiredOnCreate: true,
        validate: trimNonEmpty('Name'),
      },
      period: {
        flagName: 'period',
        inquirerType: 'number',
        label: 'Expected period (seconds):',
        default: 300,
        transformer: toInt,
      },
      grace_period: {
        flagName: 'grace',
        inquirerType: 'number',
        label: 'Grace period (seconds):',
        default: 60,
        transformer: toInt,
      },
      description: { flagName: 'description', default: '' },
    },
  },
  'alert-channel': {
    description: 'Alert channel — delivery target for notifications (email, slack, webhook, etc.)',
    required: ['name', 'type'],
    template: {
      name: 'My Alert Channel',
      type: 'email',
      config: {
        email: 'alerts@example.com',
      },
    },
    fieldMetadata: {
      name: {
        flagName: 'name',
        inquirerType: 'input',
        label: 'Channel name:',
        requiredOnCreate: true,
        validate: trimNonEmpty('Name'),
      },
      type: {
        flagName: 'type',
        inquirerType: 'list',
        label: 'Channel type:',
        requiredOnCreate: true,
        choices: ALERT_CHANNEL_TYPES,
      },
      is_default: { flagName: 'default', default: false },
    },
    extraUpdateTriggers: [
      'email',
      'webhookUrl',
      'botToken',
      'chatId',
      'accountSid',
      'authToken',
      'fromNumber',
      'phoneNumber',
    ],
  },
  'status-page': {
    description: 'Public status page — aggregates resource statuses and incident history',
    required: ['name', 'slug'],
    template: {
      name: 'My Status Page',
      slug: 'my-status-page',
      description: '',
      is_public: true,
      show_incident_history: true,
      show_uptime_percentage: true,
    },
    fieldMetadata: {
      slug: {
        flagName: 'slug',
        inquirerType: 'input',
        label: 'Status page slug:',
        requiredOnCreate: true,
        validate: trimNonEmpty('Slug'),
      },
      name: {
        flagName: 'name',
        inquirerType: 'input',
        label: 'Status page name:',
        requiredOnCreate: true,
        validate: trimNonEmpty('Name'),
      },
      description: { flagName: 'description', default: '' },
      logo_url: { flagName: 'logoUrl' },
      theme_primary_color: { flagName: 'themePrimaryColor' },
      theme_background_color: { flagName: 'themeBackgroundColor' },
      // Inverted booleans: --private flag presence sets is_public=false.
      // When the flag is absent on update we fall through to existing[field];
      // on create the default (true) wins.
      is_public: { flagName: 'private', transformer: negateBool, default: true },
      show_incident_history: {
        flagName: 'hideIncidentHistory',
        transformer: negateBool,
        default: true,
      },
      show_uptime_percentage: {
        flagName: 'hideUptime',
        transformer: negateBool,
        default: true,
      },
    },
  },
  incident: {
    description: 'Incident — human-authored status event visible on a status page',
    required: ['title', 'priority'],
    template: {
      title: 'My Incident',
      priority: 'MEDIUM',
      status: 'OPEN',
      description: '',
    },
    fieldMetadata: {
      title: {
        flagName: 'title',
        inquirerType: 'input',
        label: 'Incident title:',
        requiredOnCreate: true,
        validate: validateMinLength('Title', 3),
      },
      priority: {
        flagName: 'priority',
        inquirerType: 'list',
        label: 'Priority:',
        requiredOnCreate: true,
        choices: INCIDENT_PRIORITIES,
        transformer: toUpper,
      },
      description: { flagName: 'description', default: '' },
      assigned_to: { flagName: 'assignedTo' },
      // team_id is a UUID string; no numeric coercion.
      team_id: { flagName: 'teamId' },
    },
  },
  environment: {
    description:
      'Environment — named set of variables + base URL that monitors/checks resolve against',
    required: ['name'],
    template: {
      name: 'production',
      base_url: 'https://api.example.com',
      project_id: null,
      variables: {},
    },
    fieldMetadata: {
      name: {
        flagName: 'name',
        inquirerType: 'input',
        label: 'Environment name:',
        requiredOnCreate: true,
        validate: trimNonEmpty('Name'),
      },
      base_url: { flagName: 'baseUrl' },
      // project_id is only accepted on create (the backend update schema omits
      // it), so mark it non-updatable.
      project_id: { flagName: 'projectId', updatable: false },
      // `--var KEY=VALUE` (repeatable) → a variables map. Secrets are managed
      // separately via `obs environment secrets` and are never set here.
      variables: {
        flagName: 'var',
        treatEmptyArrayAsAbsent: true,
        transformer: (v) => parseKeyValuePairs(v as string | string[] | undefined, 'var'),
      },
    },
  },
  project: {
    description: 'Project — a container that groups monitors, checks, and environments',
    required: ['name'],
    template: {
      name: 'My Project',
      description: '',
    },
    fieldMetadata: {
      name: {
        flagName: 'name',
        inquirerType: 'input',
        label: 'Project name:',
        requiredOnCreate: true,
        validate: trimNonEmpty('Name'),
      },
      description: { flagName: 'description', default: '' },
    },
  },
  'api-collection': {
    description: 'API collection — reusable base URL + default headers shared by API checks',
    required: ['name'],
    template: {
      name: 'My Collection',
      base_url: 'https://api.example.com',
      headers: {},
    },
    fieldMetadata: {
      name: {
        flagName: 'name',
        inquirerType: 'input',
        label: 'Collection name:',
        requiredOnCreate: true,
        validate: trimNonEmpty('Name'),
      },
      base_url: { flagName: 'baseUrl' },
      // `--header KEY=VALUE` (repeatable) → a default-headers map.
      headers: {
        flagName: 'header',
        treatEmptyArrayAsAbsent: true,
        transformer: (v) => parseKeyValuePairs(v as CliListInput, 'header'),
      },
    },
  },
  'ssl-monitor': {
    description: 'SSL certificate monitor — checks TLS certificate expiry on a host:port',
    required: ['name', 'hostname'],
    template: {
      name: 'My SSL Monitor',
      hostname: 'example.com',
      port: 443,
      warn_days: 30,
      timeout_ms: 30000,
      alert_on_failure: true,
      cron_expression: '0 0 * * *',
      description: '',
      regions: [],
      channel_ids: [],
    },
    fieldMetadata: {
      name: monitorNameField,
      hostname: {
        flagName: 'hostname',
        inquirerType: 'input',
        label: 'Hostname (bare, no scheme or path):',
        requiredOnCreate: true,
        validate: validateHostname,
      },
      port: {
        flagName: 'port',
        inquirerType: 'number',
        label: 'Port:',
        default: 443,
        transformer: toInt,
      },
      warn_days: {
        flagName: 'warnDays',
        inquirerType: 'number',
        label: 'Warn this many days before expiry:',
        default: 30,
        transformer: toInt,
      },
      ...protocolMonitorCommonFields('0 0 * * *'),
    },
  },
  'tcp-monitor': {
    description: 'TCP port monitor — opens a TCP connection, optional payload + banner match',
    required: ['name', 'host', 'port'],
    template: {
      name: 'My TCP Monitor',
      host: 'example.com',
      port: 5432,
      payload_hex: '',
      expect_banner: '',
      timeout_ms: 30000,
      alert_on_failure: true,
      cron_expression: '*/5 * * * *',
      description: '',
      regions: [],
      channel_ids: [],
    },
    fieldMetadata: {
      name: monitorNameField,
      host: monitorHostField,
      port: monitorPortField,
      payload_hex: { flagName: 'payloadHex' },
      expect_banner: { flagName: 'expectBanner' },
      ...protocolMonitorCommonFields('*/5 * * * *'),
    },
  },
  'udp-monitor': {
    description: 'UDP port monitor — sends an optional payload, optionally expects a response',
    required: ['name', 'host', 'port'],
    template: {
      name: 'My UDP Monitor',
      host: 'example.com',
      port: 53,
      payload_hex: '',
      expect_response: false,
      timeout_ms: 30000,
      alert_on_failure: true,
      cron_expression: '*/5 * * * *',
      description: '',
      regions: [],
      channel_ids: [],
    },
    fieldMetadata: {
      name: monitorNameField,
      host: monitorHostField,
      port: monitorPortField,
      payload_hex: { flagName: 'payloadHex' },
      expect_response: { flagName: 'expectResponse', default: false },
      ...protocolMonitorCommonFields('*/5 * * * *'),
    },
  },
  'db-monitor': {
    description: 'Database reachability monitor — connects to postgres/mysql/redis on a host:port',
    required: ['name', 'host', 'port', 'protocol'],
    template: {
      name: 'My DB Monitor',
      host: 'example.com',
      port: 5432,
      protocol: 'postgres',
      tls: false,
      timeout_ms: 30000,
      alert_on_failure: true,
      cron_expression: '*/5 * * * *',
      description: '',
      regions: [],
      channel_ids: [],
    },
    fieldMetadata: {
      name: monitorNameField,
      host: monitorHostField,
      port: monitorPortField,
      protocol: {
        flagName: 'protocol',
        inquirerType: 'list',
        label: 'Database protocol:',
        requiredOnCreate: true,
        choices: DB_PROTOCOLS,
        transformer: toLower,
      },
      tls: { flagName: 'tls', default: false },
      ...protocolMonitorCommonFields('*/5 * * * *'),
    },
  },
};

const resourceAliases: Record<string, string> = {
  'api-check': 'check',
  'url-monitor': 'monitor',
  ssl: 'ssl-monitor',
  tcp: 'tcp-monitor',
  udp: 'udp-monitor',
  db: 'db-monitor',
};

export function resolveSchema(resource: string): ResourceSchema | undefined {
  const key = resourceAliases[resource] ?? resource;
  return schemas[key];
}

export const resourceNames = Object.keys(schemas);

function inferJsonType(value: unknown): string {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  if (typeof value === 'object') return 'object';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'string';
}

function templateToProperties(template: Record<string, unknown>): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(template)) {
    const type = inferJsonType(value);
    if (type === 'object' && value && typeof value === 'object') {
      properties[key] = {
        type: 'object',
        properties: templateToProperties(value as Record<string, unknown>),
      };
    } else if (type === 'array') {
      properties[key] = { type: 'array', items: {} };
    } else {
      properties[key] = { type };
    }
  }
  return properties;
}

export function buildJsonSchema(resource: string): Record<string, unknown> | undefined {
  const schema = resolveSchema(resource);
  if (!schema) return undefined;
  const key = resourceAliases[resource] ?? resource;
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: key,
    description: schema.description,
    type: 'object',
    required: schema.required,
    properties: templateToProperties(schema.template),
    additionalProperties: false,
  };
}
