export interface ResourceSchema {
  required: string[];
  template: Record<string, unknown>;
}

export const schemas: Record<string, ResourceSchema> = {
  monitor: {
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
    required: ['name'],
    template: {
      name: 'My Heartbeat',
      period: 300,
      grace_period: 60,
      description: '',
    },
  },
  'alert-channel': {
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
    required: ['title', 'priority'],
    template: {
      title: 'My Incident',
      priority: 'MEDIUM',
      status: 'OPEN',
      description: '',
    },
  },
  'ai-check': {
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
