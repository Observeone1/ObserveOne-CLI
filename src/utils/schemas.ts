import { parseKeyValuePairs, parseIdList } from './cli-input.js';

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
const toInt = (val: unknown): unknown => (typeof val === 'string' ? parseInt(val, 10) : val);

const toUpper = (val: unknown): unknown => (typeof val === 'string' ? val.toUpperCase() : val);

const negateBool = (val: unknown): unknown => !val;

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
        transformer: (v) =>
          parseIdList(v as string | string[] | undefined, 'alert-channel-id') ?? [],
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
        transformer: (v) => parseKeyValuePairs(v as string | string[] | undefined, 'header'),
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
};

const resourceAliases: Record<string, string> = {
  'api-check': 'check',
  'url-monitor': 'monitor',
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
