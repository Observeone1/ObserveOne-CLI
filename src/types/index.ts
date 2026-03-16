export interface ProjectConfig {
  name?: string | undefined;
  description?: string | undefined;
}

export interface DefaultOptions {
  timeout?: number | undefined;
  retries?: number | undefined;
  verbose?: boolean | undefined;
  pollIntervalMs?: number | undefined;
  maxAttempts?: number | undefined;
}

export interface ObserveOneConfig {
  apiUrl: string;
  apiKey?: string | undefined;
  defaultOptions?: DefaultOptions | undefined;
  project?: ProjectConfig | undefined;
}

export interface Test {
  id: number;
  name: string;
  description?: string | undefined;
  url: string;
  prompt: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface TestExecution {
  id: number;
  test_id: number;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  started_at: string;
  completed_at?: string | undefined;
  error_message?: string | undefined;
  task_id?: string | undefined;
}

export interface TestResult {
  status: 'SUCCESS' | 'FAILED' | 'STARTED';
  message: string;
  task_id?: string | undefined;
  results?: unknown[] | undefined;
  screenshots?: string[] | undefined;
  duration?: number | undefined;
}

export interface UrlMonitor {
  id: number;
  name: string;
  description?: string | undefined;
  url: string;
  timeout_ms: number;
  is_active: boolean;
  alert_on_failure: boolean;
  cron_expression?: string | undefined;
  assertions: Array<{
    operator: string;
    status_code: number;
  }>;
  created_at: string;
  updated_at: string;
}

export interface ApiCheck {
  id: number;
  name: string;
  description?: string | undefined;
  url: string;
  method: string;
  headers?: Record<string, string> | undefined;
  body?: string | undefined;
  timeout_ms: number;
  is_active: boolean;
  alert_on_failure: boolean;
  cron_expression?: string | undefined;
  assertions?:
    | Array<{
        type: string;
        path?: string | undefined;
        operator: string;
        value: string;
      }>
    | undefined;
  created_at: string;
  updated_at: string;
}

export interface Heartbeat {
  id: number;
  name: string;
  description?: string | undefined;
  period: number;
  grace_period: number;
  ping_key: string;
  is_active: boolean;
  alert_on_failure: boolean;
  last_ping_at?: string | undefined;
  status: 'UP' | 'DOWN' | 'PENDING';
  created_at: string;
  updated_at: string;
}

export interface AlertChannelConfig {
  email?: string | undefined;
  webhook_url?: string | undefined;
  bot_token?: string | undefined;
  chat_id?: string | undefined;
  account_sid?: string | undefined;
  auth_token?: string | undefined;
  from_number?: string | undefined;
  phone_number?: string | undefined;
  [key: string]: unknown;
}

export type AlertChannelType =
  | 'email'
  | 'slack'
  | 'discord'
  | 'teams'
  | 'telegram'
  | 'sms'
  | 'webhook';

export interface AlertChannel {
  id: number;
  name: string;
  type: AlertChannelType;
  config: AlertChannelConfig;
  is_default: boolean;
  created_at?: string | undefined;
  updated_at?: string | undefined;
}

export interface StatusPage {
  id: number;
  slug: string;
  name: string;
  description?: string | undefined;
  logo_url?: string | undefined;
  custom_domain?: string | undefined;
  is_public: boolean;
  show_incident_history: boolean;
  show_uptime_percentage: boolean;
  theme_primary_color?: string | undefined;
  theme_background_color?: string | undefined;
  created_at?: string | undefined;
  updated_at?: string | undefined;
}

export type IncidentPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type IncidentStatus = 'OPEN' | 'RESOLVED' | 'CLOSED';

export interface Incident {
  id: number;
  title: string;
  description?: string | undefined;
  status: IncidentStatus;
  priority: IncidentPriority;
  assigned_to?: string | null | undefined;
  team_id?: number | undefined;
  created_at?: string | undefined;
  updated_at?: string | undefined;
}

export interface IncidentListResponse {
  incidents: Incident[];
  stats: {
    total: number;
    open: number;
    resolved: number;
    closed: number;
  };
}

export interface JsonEnvelope<T = unknown> {
  status: 'SUCCESS' | 'ERROR';
  data?: T | undefined;
  error?:
    | {
        message: string;
        details?: unknown | undefined;
      }
    | undefined;
  metadata: {
    timestamp: string;
    version?: string | undefined;
  };
}
