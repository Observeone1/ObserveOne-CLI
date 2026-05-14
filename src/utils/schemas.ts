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
}

export interface ResourceSchema {
  description: string;
  required: string[];
  template: Record<string, unknown>;
  /** Per-field metadata that drives the schema-driven prompt fallback in the resource-command factory. */
  fieldMetadata?: Record<string, FieldSchema>;
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
      description: { flagName: 'description' },
      alert_on_failure: { default: true },
      timeout_ms: { default: 30000 },
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
        requiredOnCreate: true,
        choices: HTTP_METHODS,
        default: 'GET',
        transformer: toUpper,
      },
      description: { flagName: 'description' },
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
      description: { flagName: 'description' },
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
    },
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
      description: { flagName: 'description' },
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
      description: { flagName: 'description' },
    },
  },
  'ai-check': {
    description: 'AI browser check — prompt-driven Playwright run against a URL',
    required: ['name', 'url', 'prompt'],
    template: {
      name: 'My AI Check',
      url: 'https://example.com',
      prompt: 'Verify the page loads and the main heading is visible',
      description: '',
    },
    fieldMetadata: {
      name: {
        flagName: 'name',
        inquirerType: 'input',
        label: 'AI check name:',
        requiredOnCreate: true,
        validate: trimNonEmpty('Name'),
      },
      url: {
        flagName: 'url',
        inquirerType: 'input',
        label: 'URL to test:',
        requiredOnCreate: true,
        validate: validateUrl,
      },
      prompt: {
        flagName: 'prompt',
        inquirerType: 'input',
        label: 'AI prompt:',
        requiredOnCreate: true,
        validate: trimNonEmpty('Prompt'),
      },
      description: { flagName: 'description' },
    },
  },
};

const resourceAliases: Record<string, string> = {
  'api-check': 'check',
  'url-monitor': 'monitor',
  'browser-check': 'ai-check',
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
