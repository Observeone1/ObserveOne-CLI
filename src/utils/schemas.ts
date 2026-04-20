export interface ResourceSchema {
  description: string;
  required: string[];
  template: Record<string, unknown>;
}

export const schemas: Record<string, ResourceSchema> = {
  monitor: {
    description: 'URL monitor — pings an HTTP endpoint on a cron schedule',
    required: ['name', 'url'],
    template: {
      name: 'My Monitor',
      url: 'https://example.com',
      cron_expression: '*/5 * * * *',
      timeout_ms: 30000,
      alert_on_failure: true,
      description: '',
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
