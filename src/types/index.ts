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
  status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED";
  started_at: string;
  completed_at?: string;
  error_message?: string;
  task_id?: string;
}

export interface TestResult {
  status: "SUCCESS" | "FAILED" | "STARTED";
  message: string;
  task_id?: string;
  results?: any[];
  screenshots?: string[];
  duration?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  user?: {
    id: string;
    email: string;
    name?: string;
  };
  error?: string;
}

export interface CliOptions {
  verbose?: boolean;
  json?: boolean;
  apiUrl?: string;
  apiKey?: string;
  timeout?: number;
  retries?: number;
  reporter?: "console" | "junit" | "json";
  output?: string;
}

export interface WatchOptions {
  interval?: number;
  maxRuns?: number;
  stopOnFailure?: boolean;
}

export interface JUnitTestSuite {
  name: string;
  tests: number;
  failures: number;
  errors: number;
  time: number;
  testCases: JUnitTestCase[];
}

export interface JUnitTestCase {
  name: string;
  classname: string;
  time: number;
  status: "passed" | "failed" | "skipped";
  failure?: {
    message: string;
    type: string;
    stackTrace?: string;
  };
}
