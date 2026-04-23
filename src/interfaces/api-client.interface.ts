import {
  Test,
  TestExecution,
  TestResult,
  UrlMonitor,
  ApiCheck,
  Heartbeat,
  ResourceRun,
  HeartbeatPing,
  ListQueryOptions,
  PaginatedListResult,
  AlertChannel,
  StatusPage,
  Incident,
} from '../types/index.js';

/**
 * API Client interface
 * Abstracts HTTP communication with ObserveOne backend
 */
export interface IApiClient {
  setApiKey(apiKey: string): void;
  validateApiKey(apiKey: string): Promise<boolean>;
  validateToken(): Promise<boolean>;
  provisionHeadlessAuth(email?: string, password?: string): Promise<{ api_key: string }>;
  post(url: string, data?: unknown): Promise<unknown>;
  get(url: string): Promise<unknown>;

  // Browser Tests (AI Checks)
  getTests(): Promise<Test[]>;
  getTest(testId: number): Promise<Test>;
  createTest(testData: {
    name: string;
    url: string;
    prompt: string;
    description?: string | undefined;
  }): Promise<{ id: number; message: string }>;
  updateTest(testId: number, testData: Partial<Test>): Promise<Test>;
  deleteTest(testId: number): Promise<void>;
  executeTest(testId: number): Promise<TestResult>;
  executeAdhocTest(testData: {
    name: string;
    url: string;
    prompt: string;
    description?: string | undefined;
  }): Promise<TestResult>;
  getExecutionStatus(executionId: number): Promise<TestExecution>;
  getExecutionResults(executionId: number): Promise<unknown[]>;
  cancelTask(
    taskId: string,
    executionId?: number
  ): Promise<{
    success: boolean;
    taskId: string;
    status?: string;
    message?: string;
  }>;

  // URL Monitors
  getUrlMonitors(): Promise<UrlMonitor[]>;
  listUrlMonitors(query?: ListQueryOptions): Promise<PaginatedListResult<UrlMonitor>>;
  getUrlMonitor(id: number): Promise<UrlMonitor>;
  createUrlMonitor(data: Partial<UrlMonitor>): Promise<UrlMonitor>;
  updateUrlMonitor(id: number, data: Partial<UrlMonitor>): Promise<UrlMonitor>;
  deleteUrlMonitor(id: number): Promise<void>;
  toggleUrlMonitor(id: number): Promise<boolean>;
  toggleMuteUrlMonitor(id: number): Promise<boolean>;
  getUrlMonitorRuns(id: number, limit?: number): Promise<ResourceRun[]>;

  // API Checks
  getApiChecks(): Promise<ApiCheck[]>;
  listApiChecks(query?: ListQueryOptions): Promise<PaginatedListResult<ApiCheck>>;
  getApiCheck(id: number): Promise<ApiCheck>;
  createApiCheck(data: Partial<ApiCheck>): Promise<ApiCheck>;
  updateApiCheck(id: number, data: Partial<ApiCheck>): Promise<ApiCheck>;
  deleteApiCheck(id: number): Promise<void>;
  toggleApiCheck(id: number): Promise<boolean>;
  toggleMuteApiCheck(id: number): Promise<boolean>;
  getApiCheckRuns(id: number, limit?: number): Promise<ResourceRun[]>;

  // Heartbeats
  getHeartbeats(): Promise<Heartbeat[]>;
  listHeartbeats(query?: ListQueryOptions): Promise<PaginatedListResult<Heartbeat>>;
  getHeartbeat(id: number): Promise<Heartbeat>;
  createHeartbeat(data: Partial<Heartbeat>): Promise<Heartbeat>;
  updateHeartbeat(id: number, data: Partial<Heartbeat>): Promise<Heartbeat>;
  deleteHeartbeat(id: number): Promise<void>;
  toggleHeartbeat(id: number): Promise<boolean>;
  toggleMuteHeartbeat(id: number): Promise<boolean>;
  resetHeartbeat(id: number): Promise<void>;
  getHeartbeatRuns(id: number, limit?: number): Promise<HeartbeatPing[]>;

  // Alert Channels
  getAlertChannels(): Promise<AlertChannel[]>;
  getAlertChannel(id: number): Promise<AlertChannel>;
  createAlertChannel(data: Partial<AlertChannel>): Promise<AlertChannel>;
  updateAlertChannel(id: number, data: Partial<AlertChannel>): Promise<AlertChannel>;
  deleteAlertChannel(id: number): Promise<void>;

  // Status Pages
  getStatusPages(): Promise<StatusPage[]>;
  getStatusPage(id: number): Promise<StatusPage>;
  createStatusPage(data: Partial<StatusPage>): Promise<StatusPage>;
  updateStatusPage(id: number, data: Partial<StatusPage>): Promise<StatusPage>;
  deleteStatusPage(id: number): Promise<void>;
  addMonitorToStatusPage(
    spId: number,
    data: { monitor_type: string; monitor_id: number; display_name: string; display_order?: number }
  ): Promise<void>;
  removeMonitorFromStatusPage(spId: number, monitorId: number): Promise<void>;

  // Incidents
  getIncidents(): Promise<Incident[]>;
  getIncident(id: number): Promise<Incident>;
  createIncident(data: Partial<Incident>): Promise<Incident>;
  updateIncident(id: number, data: Partial<Incident>): Promise<Incident>;
  deleteIncident(id: number): Promise<void>;

  healthCheck(): Promise<{
    status: string;
    timestamp: string;
    environment: string;
  }>;
  pollExecutionStatus(
    executionId: number,
    maxAttempts?: number,
    intervalMs?: number
  ): Promise<TestExecution>;
  requestCliAuth(): Promise<{ request_id: string; auth_url: string }>;
  checkCliAuthStatus(requestId: string): Promise<{
    status: 'pending' | 'approved' | 'denied';
    api_key?: string;
  }>;
}
