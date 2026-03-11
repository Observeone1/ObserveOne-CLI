import {
  Test,
  TestExecution,
  TestResult,
  UrlMonitor,
  ApiCheck,
  Heartbeat,
} from "../types/index.js";

/**
 * API Client interface
 * Abstracts HTTP communication with ObserveOne backend
 */
export interface IApiClient {
  setApiKey(apiKey: string): void;
  validateApiKey(apiKey: string): Promise<boolean>;
  validateToken(): Promise<boolean>;
  provisionHeadlessAuth(
    email?: string,
    password?: string,
  ): Promise<{ api_key: string }>;
  post(url: string, data?: any): Promise<any>;
  get(url: string): Promise<any>;

  // Browser Tests (AI Checks)
  getTests(): Promise<Test[]>;
  getTest(testId: number): Promise<Test>;
  createTest(testData: {
    name: string;
    url: string;
    prompt: string;
    description?: string;
  }): Promise<{ id: number; message: string }>;
  updateTest(testId: number, testData: any): Promise<Test>;
  deleteTest(testId: number): Promise<void>;
  executeTest(testId: number): Promise<TestResult>;
  executeAdhocTest(testData: {
    name: string;
    url: string;
    prompt: string;
    description?: string;
  }): Promise<TestResult>;
  getExecutionStatus(executionId: number): Promise<TestExecution>;
  getExecutionResults(executionId: number): Promise<any[]>;
  cancelTask(
    taskId: string,
    executionId?: number,
  ): Promise<{
    success: boolean;
    taskId: string;
    status?: string;
    message?: string;
  }>;

  // URL Monitors
  getUrlMonitors(): Promise<UrlMonitor[]>;
  getUrlMonitor(id: number): Promise<UrlMonitor>;
  createUrlMonitor(data: Partial<UrlMonitor>): Promise<UrlMonitor>;
  updateUrlMonitor(id: number, data: Partial<UrlMonitor>): Promise<UrlMonitor>;
  deleteUrlMonitor(id: number): Promise<void>;
  toggleUrlMonitor(id: number): Promise<boolean>;

  // API Checks
  getApiChecks(): Promise<ApiCheck[]>;
  getApiCheck(id: number): Promise<ApiCheck>;
  createApiCheck(data: Partial<ApiCheck>): Promise<ApiCheck>;
  updateApiCheck(id: number, data: Partial<ApiCheck>): Promise<ApiCheck>;
  deleteApiCheck(id: number): Promise<void>;
  toggleApiCheck(id: number): Promise<boolean>;

  // Heartbeats
  getHeartbeats(): Promise<Heartbeat[]>;
  getHeartbeat(id: number): Promise<Heartbeat>;
  createHeartbeat(data: Partial<Heartbeat>): Promise<Heartbeat>;
  updateHeartbeat(id: number, data: Partial<Heartbeat>): Promise<Heartbeat>;
  deleteHeartbeat(id: number): Promise<void>;
  toggleHeartbeat(id: number): Promise<boolean>;

  healthCheck(): Promise<{
    status: string;
    timestamp: string;
    environment: string;
  }>;
  pollExecutionStatus(
    executionId: number,
    maxAttempts?: number,
    intervalMs?: number,
  ): Promise<TestExecution>;
  requestCliAuth(): Promise<{ request_id: string; auth_url: string }>;
  checkCliAuthStatus(requestId: string): Promise<{
    status: "pending" | "approved" | "denied";
    api_key?: string;
  }>;
}
