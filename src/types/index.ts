export interface ObserveOneConfig {
  apiUrl: string;
  apiKey?: string;
  defaultOptions?: {
    timeout?: number;
    retries?: number;
    verbose?: boolean;
    pollIntervalMs?: number;
    maxAttempts?: number;
  };
  project?: {
    name?: string;
    description?: string;
  };
}

export interface Test {
  id: number;
  name: string;
  description?: string;
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
  completed_at?: string;
  error_message?: string;
  task_id?: string;
}

export interface TestResult {
  status: 'SUCCESS' | 'FAILED' | 'STARTED';
  message: string;
  task_id?: string;
  results?: unknown[];
  screenshots?: string[];
  duration?: number;
}

export interface UrlMonitor {
  id: number;
  name: string;
  description?: string;
  url: string;
  timeout_ms: number;
  is_active: boolean;
  alert_on_failure: boolean;
  cron_expression?: string;
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
  description?: string;
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  timeout_ms: number;
  is_active: boolean;
  alert_on_failure: boolean;
  cron_expression?: string;
  assertions?: Array<{
    type: string;
    path?: string;
    operator: string;
    value: string;
  }>;
  created_at: string;
  updated_at: string;
}

export interface Heartbeat {
  id: number;
  name: string;
  description?: string;
  period: number;
  grace_period: number;
  ping_key: string;
  is_active: boolean;
  alert_on_failure: boolean;
  last_ping_at?: string;
  status: 'UP' | 'DOWN' | 'PENDING';
  created_at: string;
  updated_at: string;
}

export interface JsonEnvelope<T = unknown> {
  status: 'SUCCESS' | 'ERROR';
  data?: T;
  error?: {
    message: string;
    details?: unknown;
  };
  metadata: {
    timestamp: string;
    version?: string;
  };
}
