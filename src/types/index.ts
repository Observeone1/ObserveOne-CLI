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

/**
 * Shape of the local, committable project config file (`.obs.config.json`),
 * read from `process.cwd()`.
 *
 * Intentionally does NOT include `apiKey`: a credential must never live in a
 * project file that can be committed to version control. Provide a key via the
 * `OBS_API_KEY` env var, the `--api-key` flag, or `obs login` (stored in the
 * global Conf store / OS keychain) — never this file. The CLI never writes
 * `apiKey` here.
 */
export interface LocalProjectConfig {
  apiUrl?: string | undefined;
  defaultOptions?: DefaultOptions | undefined;
  project?: ProjectConfig | undefined;
}

export interface UrlMonitor {
  id: string;
  name: string;
  description?: string | undefined;
  url: string;
  timeout_ms: number;
  status?: 'up' | 'down' | 'paused' | 'pending' | 'degraded' | undefined;
  is_active: boolean;
  alert_on_failure: boolean;
  channel_ids?: string[] | undefined;
  interval?: string | undefined;
  assertions: Array<{
    operator: string;
    status_code: number;
  }>;
  created_at: string;
  updated_at: string;
}

export interface ApiCheck {
  id: string;
  name: string;
  description?: string | undefined;
  url: string;
  method: string;
  status?: 'up' | 'down' | 'paused' | 'pending' | 'degraded' | undefined;
  headers?: Record<string, string> | undefined;
  body?: string | undefined;
  timeout_ms: number;
  is_active: boolean;
  alert_on_failure: boolean;
  channel_ids?: string[] | undefined;
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
  id: string;
  name: string;
  description?: string | undefined;
  period: number;
  grace_period: number;
  ping_key: string;
  is_active: boolean;
  alert_on_failure: boolean;
  last_ping_at?: string | undefined;
  status: 'up' | 'down' | 'paused' | 'pending' | 'late';
  created_at: string;
  updated_at: string;
}

export interface ResourceRun {
  id: string;
  status: string;
  region?: string | undefined;
  start_time?: string | undefined;
  end_time?: string | undefined;
  response_time_ms?: number | null | undefined;
  response_status?: number | null | undefined;
  error_message?: string | null | undefined;
}

export interface HeartbeatPing {
  id: string;
  heartbeat_id: string;
  pinged_at: string;
  duration?: number | null | undefined;
  is_late?: boolean | undefined;
}

export interface ListQueryOptions {
  search?: string | undefined;
  status?: string | undefined;
  is_active?: boolean | undefined;
  limit?: number | undefined;
  page?: number | undefined;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedListResult<T> {
  items: T[];
  pagination: PaginationMeta;
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
  id: string;
  name: string;
  type: AlertChannelType;
  config: AlertChannelConfig;
  is_default: boolean;
  created_at?: string | undefined;
  updated_at?: string | undefined;
}

export interface StatusPage {
  id: string;
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
  id: string;
  title: string;
  description?: string | undefined;
  status: IncidentStatus;
  priority: IncidentPriority;
  assigned_to?: string | null | undefined;
  team_id?: string | undefined;
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

export type SuiteStatus =
  | 'pending'
  | 'crawling'
  | 'planning'
  | 'generating'
  | 'healing'
  | 'scheduled'
  | 'failed';

export type SuiteExecutionStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
export type SuiteTestResultStatus = 'PASSED' | 'FAILED' | 'SKIPPED' | 'PENDING';

export interface SuiteTestResult {
  test_id: string;
  name: string;
  status: SuiteTestResultStatus;
  duration_ms: number | null;
  error: string | null;
}

export interface Suite {
  id: string;
  user_id: string;
  team_id: string | null;
  target_url: string;
  suite_name: string;
  status: SuiteStatus;
  error_message: string | null;
  plan_markdown: string | null;
  test_count: number;
  max_tests: number;
  public_slug: string | null;
  is_public: boolean;
  cron_expression: string;
  schedule_active: boolean;
  secret_keys: string[];
  allow_form_submit: boolean;
  generated_tests: Array<{ id: string; name: string; script_path: string }>;
  created_at: string;
  updated_at: string;
}

export interface SuiteCiIntegration {
  id: number;
  suite_id: string;
  provider: string;
  repo_identifier: string;
  branch: string;
  comment_on_pr: boolean;
  set_status_check: boolean;
  check_name: string;
  wait_for_ci: boolean;
  inbound_webhook_token_last4: string | null;
  github_installation_id: number | null;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SuiteExecution {
  id: string;
  suite_id: string;
  user_id: string;
  status: SuiteExecutionStatus;
  test_results: SuiteTestResult[];
  total: number;
  passed: number;
  failed: number;
  duration_ms: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

// API Keys
export interface ApiKey {
  id: string;
  name: string;
  is_active: boolean;
  /** Plaintext key value — only surfaced by the API on create. */
  key?: string;
  created_at?: string;
  last_used_at?: string;
  [key: string]: unknown;
}

// Teams
export interface TeamMember {
  id: string;
  email?: string;
  name?: string;
  role?: string;
  [key: string]: unknown;
}

export interface Team {
  id: string;
  name: string;
  invite_code?: string;
  [key: string]: unknown;
}

// Incident Events (comments etc.)
export interface IncidentEvent {
  id: string | number;
  incident_id: string | number;
  type?: string;
  message?: string;
  created_at?: string;
  [key: string]: unknown;
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
