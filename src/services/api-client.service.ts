import axios, { AxiosInstance } from 'axios';
import { IConfigService } from '../interfaces/config.interface.js';
import { IApiClient } from '../interfaces/api-client.interface.js';
import {
  Test,
  TestExecution,
  TestResult,
  UrlMonitor,
  ApiCheck,
  Heartbeat,
  AlertChannel,
  StatusPage,
  Incident,
  IncidentListResponse,
  Suite,
  SuiteExecution,
} from '../types/index.js';

/**
 * API Client implementation
 * Handles HTTP communication with ObserveOne backend
 */
export class ApiClient implements IApiClient {
  private client: AxiosInstance;
  private apiKey: string | undefined;
  private configService: IConfigService;

  constructor(configService: IConfigService, version: string = '1.0.1') {
    this.configService = configService;
    this.apiKey = configService.getApiKey();

    const isDev = configService.isDevelopment();
    const timeout = configService.getDefaultOptions().timeout || 30000;

    this.client = axios.create({
      timeout: timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `obs-cli/${version} (${isDev ? 'dev' : 'prod'})`,
      },
    });

    // Add interceptor to set baseURL dynamically (allows --api-url to work)
    this.client.interceptors.request.use((config) => {
      config.baseURL = this.configService.getApiUrl();
      if (this.apiKey) {
        // Backend expects CLI API keys in x-obs1-cli header, not Authorization
        // Note: keeping x-obs1-cli header name for backward compatibility
        config.headers['x-obs1-cli'] = this.apiKey;
      }
      return config;
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          throw new Error('Authentication failed. Please run "obs login" to authenticate.');
        }
        if (error.response?.status === 403) {
          throw new Error('Access denied. You do not have permission to perform this action.');
        }
        if (error.response?.status === 404) {
          const attemptedUrl = error.config?.baseURL
            ? `${error.config.baseURL}${error.config.url}`
            : error.config?.url;
          throw new Error(`Resource not found. (Attempted API URL: ${attemptedUrl || 'unknown'})`);
        }
        if (error.response?.status >= 500) {
          throw new Error(`Server error: ${error.response.status}`);
        }
        throw error;
      }
    );
  }

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    this.client.defaults.headers['x-obs1-cli'] = apiKey;
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      // Temporarily set the key to test it
      const currentKey = this.apiKey;
      this.client.defaults.headers['x-obs1-cli'] = apiKey;

      const response = await this.client.get<{ valid: boolean }>('/cli/auth/verify');

      // Restore previous key if validation was just a check
      if (currentKey) {
        this.client.defaults.headers['x-obs1-cli'] = currentKey;
      }

      return response.data.valid === true;
    } catch (_error: unknown) {
      return false;
    }
  }

  async validateToken(): Promise<boolean> {
    try {
      if (!this.apiKey) return false;
      const response = await this.client.get<{ valid: boolean }>('/cli/auth/verify');
      return response.data.valid === true;
    } catch (_error: unknown) {
      return false;
    }
  }

  async provisionHeadlessAuth(email?: string, password?: string): Promise<{ api_key: string }> {
    try {
      const response = await this.client.post<{ api_key: string }>('/cli/auth/provision', {
        email,
        password,
      });
      return response.data;
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      if (err.code === 'ECONNREFUSED' || err.message?.includes('Network Error')) {
        const url = this.configService.getApiUrl() || this.client.defaults.baseURL;
        throw new Error(
          `Failed to connect to ObserveOne API. Ensure the server is running or the API URL is correct. (Attempted: ${url})`
        );
      }
      throw error;
    }
  }

  async post(url: string, data?: unknown): Promise<unknown> {
    const response = await this.client.post(url, data);
    return response.data;
  }

  async get(url: string): Promise<unknown> {
    const response = await this.client.get(url);
    return response.data;
  }

  async getTests(): Promise<Test[]> {
    const response = await this.client.get<{ tests: Test[] } | Test[]>('/browser-checks');
    // Supporting both {tests: []} and [] formats if backend varies
    if (Array.isArray(response.data)) return response.data;
    return (response.data as { tests: Test[] }).tests || [];
  }

  async getTest(testId: number): Promise<Test> {
    const response = await this.client.get<Test>(`/browser-checks/${testId}`);
    return response.data;
  }

  async createTest(testData: {
    name: string;
    url: string;
    prompt: string;
    description?: string;
  }): Promise<{ id: number; message: string }> {
    const response = await this.client.post<{ id: number; message: string }>(
      '/browser-checks',
      testData
    );
    return response.data;
  }

  async updateTest(testId: number, testData: Partial<Test>): Promise<Test> {
    const response = await this.client.put<Test>(`/browser-checks/${testId}`, testData);
    return response.data;
  }

  async deleteTest(testId: number): Promise<void> {
    await this.client.delete(`/browser-checks/${testId}`);
  }

  async executeTest(testId: number): Promise<TestResult> {
    const response = await this.client.post<TestResult>(`/browser-checks/${testId}/execute`);
    return response.data;
  }

  async executeAdhocTest(testData: {
    name: string;
    url: string;
    prompt: string;
    description?: string;
  }): Promise<TestResult> {
    const response = await this.client.post<TestResult>('/browser-checks/execute-adhoc', testData);
    return response.data;
  }

  async getExecutionStatus(executionId: number): Promise<TestExecution> {
    const response = await this.client.get<TestExecution>(
      `/browser-checks/execution/${executionId}`
    );
    return response.data;
  }

  async getExecutionResults(executionId: number): Promise<unknown[]> {
    const response = await this.client.get<unknown[]>(`/browser-checks/executions/${executionId}`);
    return response.data;
  }

  async cancelTask(
    taskId: string,
    executionId?: number
  ): Promise<{
    success: boolean;
    taskId: string;
    status?: string;
    message?: string;
  }> {
    const response = await this.client.post<{
      success: boolean;
      taskId: string;
      status?: string;
      message?: string;
    }>('/browser-checks/cancel', {
      taskId,
      executionId,
    });
    return response.data;
  }

  // URL Monitors
  async getUrlMonitors(): Promise<UrlMonitor[]> {
    const response = await this.client.get<
      { monitors?: UrlMonitor[]; data?: UrlMonitor[] } | UrlMonitor[]
    >('/url-monitors');
    if (Array.isArray(response.data)) return response.data;
    return response.data.monitors || response.data.data || [];
  }

  async getUrlMonitor(id: number): Promise<UrlMonitor> {
    const response = await this.client.get<
      { monitor?: UrlMonitor; data?: UrlMonitor } | UrlMonitor
    >(`/url-monitors/${id}`);
    const data = response.data as { monitor?: UrlMonitor; data?: UrlMonitor };
    return data.monitor || data.data || (response.data as UrlMonitor);
  }

  async createUrlMonitor(data: Partial<UrlMonitor>): Promise<UrlMonitor> {
    const response = await this.client.post<
      { monitor?: UrlMonitor; data?: UrlMonitor } | UrlMonitor
    >('/url-monitors', data);
    const resData = response.data as { monitor?: UrlMonitor; data?: UrlMonitor };
    return resData.monitor || resData.data || (response.data as UrlMonitor);
  }

  async updateUrlMonitor(id: number, data: Partial<UrlMonitor>): Promise<UrlMonitor> {
    const response = await this.client.put<
      { monitor?: UrlMonitor; data?: UrlMonitor } | UrlMonitor
    >(`/url-monitors/${id}`, data);
    const resData = response.data as { monitor?: UrlMonitor; data?: UrlMonitor };
    return resData.monitor || resData.data || (response.data as UrlMonitor);
  }

  async deleteUrlMonitor(id: number): Promise<void> {
    await this.client.delete(`/url-monitors/${id}`);
  }

  async toggleUrlMonitor(id: number): Promise<boolean> {
    const response = await this.client.patch<{
      is_active?: boolean;
      data?: { is_active?: boolean };
    }>(`/url-monitors/${id}/toggle`);
    return response.data.is_active ?? response.data.data?.is_active ?? false;
  }

  // API Checks
  async getApiChecks(): Promise<ApiCheck[]> {
    const response = await this.client.get<{ apiChecks?: ApiCheck[]; data?: ApiCheck[] }>(
      '/api-checks'
    );
    return response.data.apiChecks || response.data.data || [];
  }

  async getApiCheck(id: number): Promise<ApiCheck> {
    const response = await this.client.get<{ apiCheck?: ApiCheck; data?: ApiCheck } | ApiCheck>(
      `/api-checks/${id}`
    );
    const data = response.data as { apiCheck?: ApiCheck; data?: ApiCheck };
    return data.apiCheck || data.data || (response.data as ApiCheck);
  }

  async createApiCheck(data: Partial<ApiCheck>): Promise<ApiCheck> {
    const response = await this.client.post<{ apiCheck?: ApiCheck; data?: ApiCheck } | ApiCheck>(
      '/api-checks',
      data
    );
    const resData = response.data as { apiCheck?: ApiCheck; data?: ApiCheck };
    return resData.apiCheck || resData.data || (response.data as ApiCheck);
  }

  async updateApiCheck(id: number, data: Partial<ApiCheck>): Promise<ApiCheck> {
    const response = await this.client.put<{ apiCheck?: ApiCheck; data?: ApiCheck } | ApiCheck>(
      `/api-checks/${id}`,
      data
    );
    const resData = response.data as { apiCheck?: ApiCheck; data?: ApiCheck };
    return resData.apiCheck || resData.data || (response.data as ApiCheck);
  }

  async deleteApiCheck(id: number): Promise<void> {
    await this.client.delete(`/api-checks/${id}`);
  }

  async toggleApiCheck(id: number): Promise<boolean> {
    const response = await this.client.patch<{
      is_active?: boolean;
      data?: { is_active?: boolean };
    }>(`/api-checks/${id}/toggle`);
    return response.data.is_active ?? response.data.data?.is_active ?? false;
  }

  // Heartbeats
  async getHeartbeats(): Promise<Heartbeat[]> {
    const response = await this.client.get<{ heartbeats?: Heartbeat[]; data?: Heartbeat[] }>(
      '/heartbeats'
    );
    return response.data.heartbeats || response.data.data || [];
  }

  async getHeartbeat(id: number): Promise<Heartbeat> {
    const response = await this.client.get<{ heartbeat?: Heartbeat; data?: Heartbeat } | Heartbeat>(
      `/heartbeats/${id}`
    );
    const data = response.data as { heartbeat?: Heartbeat; data?: Heartbeat };
    return data.heartbeat || data.data || (response.data as Heartbeat);
  }

  async createHeartbeat(data: Partial<Heartbeat>): Promise<Heartbeat> {
    const response = await this.client.post<
      { heartbeat?: Heartbeat; data?: Heartbeat } | Heartbeat
    >('/heartbeats', data);
    const resData = response.data as { heartbeat?: Heartbeat; data?: Heartbeat };
    return resData.heartbeat || resData.data || (response.data as Heartbeat);
  }

  async updateHeartbeat(id: number, data: Partial<Heartbeat>): Promise<Heartbeat> {
    const response = await this.client.put<{ heartbeat?: Heartbeat; data?: Heartbeat } | Heartbeat>(
      `/heartbeats/${id}`,
      data
    );
    const resData = response.data as { heartbeat?: Heartbeat; data?: Heartbeat };
    return resData.heartbeat || resData.data || (response.data as Heartbeat);
  }

  async deleteHeartbeat(id: number): Promise<void> {
    await this.client.delete(`/heartbeats/${id}`);
  }

  async toggleHeartbeat(id: number): Promise<boolean> {
    const response = await this.client.patch<{
      is_active?: boolean;
      data?: { is_active?: boolean };
    }>(`/heartbeats/${id}/toggle`);
    return response.data.is_active ?? response.data.data?.is_active ?? false;
  }

  // Alert Channels
  async getAlertChannels(): Promise<AlertChannel[]> {
    const response = await this.client.get<AlertChannel[] | { data?: AlertChannel[] }>(
      '/alert-channels'
    );
    return Array.isArray(response.data) ? response.data : response.data.data || [];
  }

  async getAlertChannel(id: number): Promise<AlertChannel> {
    const response = await this.client.get<AlertChannel>(`/alert-channels/${id}`);
    return response.data;
  }

  async createAlertChannel(data: Partial<AlertChannel>): Promise<AlertChannel> {
    const response = await this.client.post<AlertChannel>('/alert-channels', data);
    return response.data;
  }

  async updateAlertChannel(id: number, data: Partial<AlertChannel>): Promise<AlertChannel> {
    const response = await this.client.put<AlertChannel>(`/alert-channels/${id}`, data);
    return response.data;
  }

  async deleteAlertChannel(id: number): Promise<void> {
    await this.client.delete(`/alert-channels/${id}`);
  }

  // Status Pages
  async getStatusPages(): Promise<StatusPage[]> {
    const response = await this.client.get<StatusPage[] | { data?: StatusPage[] }>('/status-pages');
    return Array.isArray(response.data) ? response.data : response.data.data || [];
  }

  async getStatusPage(id: number): Promise<StatusPage> {
    const response = await this.client.get<StatusPage>(`/status-pages/${id}`);
    return response.data;
  }

  async createStatusPage(data: Partial<StatusPage>): Promise<StatusPage> {
    const response = await this.client.post<StatusPage>('/status-pages', data);
    return response.data;
  }

  async updateStatusPage(id: number, data: Partial<StatusPage>): Promise<StatusPage> {
    const response = await this.client.put<StatusPage>(`/status-pages/${id}`, data);
    return response.data;
  }

  async deleteStatusPage(id: number): Promise<void> {
    await this.client.delete(`/status-pages/${id}`);
  }

  // Incidents
  async getIncidents(): Promise<Incident[]> {
    const response = await this.client.get<
      IncidentListResponse | Incident[] | { data?: Incident[] }
    >('/incidents');
    if (Array.isArray(response.data)) return response.data;
    if ('incidents' in response.data) return response.data.incidents || [];
    return response.data.data || [];
  }

  async getIncident(id: number): Promise<Incident> {
    const response = await this.client.get<Incident>(`/incidents/${id}`);
    return response.data;
  }

  async createIncident(data: Partial<Incident>): Promise<Incident> {
    const response = await this.client.post<Incident>('/incidents', data);
    return response.data;
  }

  async updateIncident(id: number, data: Partial<Incident>): Promise<Incident> {
    const response = await this.client.put<Incident>(`/incidents/${id}`, data);
    return response.data;
  }

  async deleteIncident(id: number): Promise<void> {
    await this.client.delete(`/incidents/${id}`);
  }

  async healthCheck(): Promise<{
    status: string;
    timestamp: string;
    environment: string;
  }> {
    const response = await this.client.get<{
      status: string;
      timestamp: string;
      environment: string;
    }>('/health');
    return response.data;
  }

  // Polling method for test execution status
  async pollExecutionStatus(
    executionId: number,
    maxAttempts: number = 60,
    intervalMs: number = 5000
  ): Promise<TestExecution> {
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const execution = await this.getExecutionStatus(executionId);

        if (
          execution.status === 'SUCCESS' ||
          execution.status === 'FAILED' ||
          execution.status === 'CANCELLED'
        ) {
          return execution;
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        attempts++;
      } catch (_error: unknown) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw _error;
        }
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }

    throw new Error(`Test execution ${executionId} did not complete within the timeout period`);
  }

  // Suites (Playwright Autopilot)
  async listSuites(): Promise<Suite[]> {
    const response = await this.client.get<Suite[]>('/playwright-autopilot/suites');
    return Array.isArray(response.data) ? response.data : [];
  }

  async getSuite(id: string): Promise<Suite> {
    const response = await this.client.get<Suite>(`/playwright-autopilot/suites/${id}`);
    return response.data;
  }

  async generateSuite(payload: {
    target_url: string;
    suite_name: string;
    cron_expression?: string;
    max_tests?: number;
    secrets?: Record<string, string>;
    allow_form_submit?: boolean;
  }): Promise<Suite> {
    const response = await this.client.post<Suite>('/playwright-autopilot/suites', payload);
    return response.data;
  }

  async runSuite(suiteId: string, testIds?: string[]): Promise<{ execution_id: string }> {
    const response = await this.client.post<{ execution_id: string }>(
      `/playwright-autopilot/suites/${suiteId}/run`,
      testIds?.length ? { test_ids: testIds } : {}
    );
    return response.data;
  }

  async getSuiteExecution(suiteId: string, executionId: string): Promise<SuiteExecution> {
    const response = await this.client.get<SuiteExecution>(
      `/playwright-autopilot/suites/${suiteId}/executions/${executionId}`
    );
    return response.data;
  }

  async listSuiteExecutions(suiteId: string): Promise<SuiteExecution[]> {
    const response = await this.client.get<SuiteExecution[]>(
      `/playwright-autopilot/suites/${suiteId}/executions`
    );
    return Array.isArray(response.data) ? response.data : [];
  }

  async deleteSuite(id: string): Promise<void> {
    await this.client.delete(`/playwright-autopilot/suites/${id}`);
  }

  async pollSuiteGeneration(
    suiteId: string,
    maxAttempts: number = 120,
    intervalMs: number = 5000
  ): Promise<Suite> {
    let attempts = 0;
    while (attempts < maxAttempts) {
      const suite = await this.getSuite(suiteId);
      if (suite.status === 'scheduled' || suite.status === 'failed') return suite;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      attempts++;
    }
    throw new Error('Suite generation did not complete within the timeout period');
  }

  async pollSuiteExecution(
    suiteId: string,
    executionId: string,
    maxAttempts: number = 60,
    intervalMs: number = 5000
  ): Promise<SuiteExecution> {
    let attempts = 0;
    while (attempts < maxAttempts) {
      try {
        const execution = await this.getSuiteExecution(suiteId, executionId);
        if (execution.status === 'COMPLETED' || execution.status === 'FAILED') return execution;
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        attempts++;
      } catch (_error: unknown) {
        attempts++;
        if (attempts >= maxAttempts) throw _error;
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }
    throw new Error('Suite execution did not complete within the timeout period');
  }

  async requestCliAuth(): Promise<{ request_id: string; auth_url: string }> {
    const response = await this.client.post<{
      request_id: string;
      auth_url: string;
    }>('/cli/auth/request');
    return response.data;
  }

  async checkCliAuthStatus(requestId: string): Promise<{
    status: 'pending' | 'approved' | 'denied';
    api_key?: string;
  }> {
    const response = await this.client.get<{
      status: 'pending' | 'approved' | 'denied';
      api_key?: string;
    }>(`/cli/auth/check/${requestId}`);
    return response.data;
  }
}
