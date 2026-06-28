import axios, { AxiosInstance } from 'axios';
import { IConfigService } from '../interfaces/config.interface.js';
import { IApiClient } from '../interfaces/api-client.interface.js';
import { mapSuiteCiIntegration } from '../utils/suite-ci-mapper.js';
import { isAllowedHost } from '../utils/host-allowlist.js';
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
  IncidentListResponse,
  Suite,
  SuiteCiIntegration,
  SuiteExecution,
  ApiKey,
  Team,
  TeamMember,
  IncidentEvent,
} from '../types/index.js';

/**
 * API Client implementation
 * Handles HTTP communication with ObserveOne backend
 */
export class ApiClient implements IApiClient {
  private client: AxiosInstance;
  private apiKey: string | undefined;
  private configService: IConfigService;
  private offHostWarned = false;

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

      // Never leak the API token to a non-ObserveOne host. The base URL is
      // user-overridable, so we strip credentials on any disallowed host —
      // this also covers the token set via setApiKey/validateApiKey on
      // client.defaults.headers, which axios merges into every request.
      if (!isAllowedHost(config.baseURL)) {
        delete config.headers['x-obs1-cli'];
        this.warnOffHost(config.baseURL);
      } else if (this.apiKey) {
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
          throw new Error(
            'Authentication failed. Run "obs login", or set OBS_API_KEY (get a key at https://app.observeone.com/settings/api).'
          );
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

  private warnOffHost(baseUrl: string | undefined): void {
    if (this.offHostWarned) return;
    this.offHostWarned = true;
    let host = baseUrl ?? 'unknown';
    try {
      if (baseUrl) host = new URL(baseUrl).host;
    } catch {
      // keep raw value
    }
    console.error(
      `warn: destination host "${host}" is not allowlisted — sending without credentials`
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
  private mapMonitor(raw: Record<string, unknown>): UrlMonitor {
    const { cron_expression, ...rest } = raw as Record<string, unknown> & {
      cron_expression?: string;
    };
    return {
      ...rest,
      interval: cron_expression ?? (rest.interval as string | undefined),
    } as unknown as UrlMonitor;
  }

  private normalizePagination(length: number) {
    return {
      page: 1,
      limit: length,
      total: length,
      totalPages: length === 0 ? 0 : 1,
    };
  }

  private normalizePaginatedItems<T>(
    payload: unknown,
    legacyKeys: string[]
  ): PaginatedListResult<T> {
    if (Array.isArray(payload)) {
      return {
        items: payload as T[],
        pagination: this.normalizePagination(payload.length),
      };
    }

    const data = payload as Record<string, unknown>;
    const resolvedItems =
      (Array.isArray(data.items) ? (data.items as T[]) : undefined) ??
      legacyKeys.reduce<T[]>((acc, key) => {
        if (acc.length > 0) return acc;
        return Array.isArray(data[key]) ? (data[key] as T[]) : acc;
      }, []);

    const pagination =
      (data.pagination as PaginatedListResult<T>['pagination'] | undefined) ??
      this.normalizePagination(resolvedItems.length);

    return {
      items: resolvedItems,
      pagination,
    };
  }

  async getUrlMonitors(): Promise<UrlMonitor[]> {
    const result = await this.listUrlMonitors();
    return result.items;
  }

  async listUrlMonitors(query: ListQueryOptions = {}): Promise<PaginatedListResult<UrlMonitor>> {
    const response = await this.client.get('/url-monitors', { params: query });
    const normalized = this.normalizePaginatedItems<Record<string, unknown>>(response.data, [
      'items',
      'monitors',
      'data',
    ]);
    return {
      items: normalized.items.map((item) => this.mapMonitor(item)),
      pagination: normalized.pagination,
    };
  }

  async getUrlMonitor(id: string): Promise<UrlMonitor> {
    const response = await this.client.get<Record<string, unknown>>(`/url-monitors/${id}`);
    const raw =
      (response.data as { monitor?: Record<string, unknown>; data?: Record<string, unknown> })
        .monitor ||
      (response.data as { data?: Record<string, unknown> }).data ||
      (response.data as Record<string, unknown>);
    return this.mapMonitor(raw);
  }

  async createUrlMonitor(data: Partial<UrlMonitor>): Promise<UrlMonitor> {
    const { interval, ...rest } = data;
    const payload = { ...rest, ...(interval !== undefined && { cron_expression: interval }) };
    const response = await this.client.post<Record<string, unknown>>('/url-monitors', payload);
    const raw =
      (response.data as { monitor?: Record<string, unknown>; data?: Record<string, unknown> })
        .monitor ||
      (response.data as { data?: Record<string, unknown> }).data ||
      (response.data as Record<string, unknown>);
    return this.mapMonitor(raw);
  }

  async updateUrlMonitor(id: string, data: Partial<UrlMonitor>): Promise<UrlMonitor> {
    const { interval, ...rest } = data;
    const payload = { ...rest, ...(interval !== undefined && { cron_expression: interval }) };
    const response = await this.client.put<Record<string, unknown>>(`/url-monitors/${id}`, payload);
    const raw =
      (response.data as { monitor?: Record<string, unknown>; data?: Record<string, unknown> })
        .monitor ||
      (response.data as { data?: Record<string, unknown> }).data ||
      (response.data as Record<string, unknown>);
    return this.mapMonitor(raw);
  }

  async deleteUrlMonitor(id: string): Promise<void> {
    await this.client.delete(`/url-monitors/${id}`);
  }

  async toggleUrlMonitor(id: string): Promise<boolean> {
    const response = await this.client.patch<{
      is_active?: boolean;
      data?: { is_active?: boolean };
    }>(`/url-monitors/${id}/toggle`);
    return response.data.is_active ?? response.data.data?.is_active ?? false;
  }

  async toggleMuteUrlMonitor(id: string): Promise<{ alert_on_failure: boolean; message: string }> {
    const response = await this.client.patch<{ alert_on_failure: boolean; message: string }>(
      `/url-monitors/${id}/toggle-muted`
    );
    return response.data;
  }

  async getUrlMonitorRuns(id: string, limit: number = 20): Promise<ResourceRun[]> {
    const response = await this.client.get<{ executions?: ResourceRun[] } | ResourceRun[]>(
      `/url-monitors/${id}/executions`,
      { params: { limit } }
    );
    const data = response.data as { executions?: ResourceRun[] };
    return data.executions || (response.data as ResourceRun[]);
  }

  async runApiCheck(id: string): Promise<{
    executions: { execution_id: number; region: string; status: string }[];
    message: string;
  }> {
    const response = await this.client.post<{
      executions: { execution_id: number; region: string; status: string }[];
      message: string;
    }>(`/api-checks/${id}/execute`);
    return response.data;
  }

  async runUrlMonitor(id: string): Promise<{
    executions: { execution_id: number; region: string; status: string }[];
    message: string;
  }> {
    const response = await this.client.post<{
      executions: { execution_id: number; region: string; status: string }[];
      message: string;
    }>(`/url-monitors/${id}/execute`);
    return response.data;
  }

  // API Checks
  async getApiChecks(): Promise<ApiCheck[]> {
    const result = await this.listApiChecks();
    return result.items;
  }

  async listApiChecks(query: ListQueryOptions = {}): Promise<PaginatedListResult<ApiCheck>> {
    const response = await this.client.get('/api-checks', { params: query });
    return this.normalizePaginatedItems<ApiCheck>(response.data, ['items', 'apiChecks', 'data']);
  }

  async getApiCheck(id: string): Promise<ApiCheck> {
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

  async updateApiCheck(id: string, data: Partial<ApiCheck>): Promise<ApiCheck> {
    const response = await this.client.put<{ apiCheck?: ApiCheck; data?: ApiCheck } | ApiCheck>(
      `/api-checks/${id}`,
      data
    );
    const resData = response.data as { apiCheck?: ApiCheck; data?: ApiCheck };
    return resData.apiCheck || resData.data || (response.data as ApiCheck);
  }

  async deleteApiCheck(id: string): Promise<void> {
    await this.client.delete(`/api-checks/${id}`);
  }

  async toggleApiCheck(id: string): Promise<boolean> {
    const response = await this.client.patch<{
      is_active?: boolean;
      data?: { is_active?: boolean };
    }>(`/api-checks/${id}/toggle`);
    return response.data.is_active ?? response.data.data?.is_active ?? false;
  }

  async toggleMuteApiCheck(id: string): Promise<{ alert_on_failure: boolean; message: string }> {
    const response = await this.client.patch<{ alert_on_failure: boolean; message: string }>(
      `/api-checks/${id}/toggle-muted`
    );
    return response.data;
  }

  async getApiCheckRuns(id: string, limit: number = 20): Promise<ResourceRun[]> {
    const response = await this.client.get<ResourceRun[] | { executions: ResourceRun[] }>(
      `/api-checks/${id}/executions`,
      {
        params: { limit },
      }
    );
    const data = response.data;
    return Array.isArray(data) ? data : data.executions;
  }

  // Heartbeats
  async getHeartbeats(): Promise<Heartbeat[]> {
    const result = await this.listHeartbeats();
    return result.items;
  }

  async listHeartbeats(query: ListQueryOptions = {}): Promise<PaginatedListResult<Heartbeat>> {
    const response = await this.client.get('/heartbeats', { params: query });
    return this.normalizePaginatedItems<Heartbeat>(response.data, ['items', 'heartbeats', 'data']);
  }

  async getHeartbeat(id: string): Promise<Heartbeat> {
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

  async updateHeartbeat(id: string, data: Partial<Heartbeat>): Promise<Heartbeat> {
    const response = await this.client.put<{ heartbeat?: Heartbeat; data?: Heartbeat } | Heartbeat>(
      `/heartbeats/${id}`,
      data
    );
    const resData = response.data as { heartbeat?: Heartbeat; data?: Heartbeat };
    return resData.heartbeat || resData.data || (response.data as Heartbeat);
  }

  async deleteHeartbeat(id: string): Promise<void> {
    await this.client.delete(`/heartbeats/${id}`);
  }

  async toggleHeartbeat(id: string): Promise<boolean> {
    const response = await this.client.patch<{
      is_active?: boolean;
      data?: { is_active?: boolean };
    }>(`/heartbeats/${id}/toggle`);
    return response.data.is_active ?? response.data.data?.is_active ?? false;
  }

  async toggleMuteHeartbeat(id: string): Promise<{ alert_on_failure: boolean; message: string }> {
    const response = await this.client.patch<{ alert_on_failure: boolean; message: string }>(
      `/heartbeats/${id}/toggle-muted`
    );
    return response.data;
  }

  async resetHeartbeat(id: string): Promise<Heartbeat> {
    const response = await this.client.post<Heartbeat>(`/heartbeats/${id}/reset`);
    return response.data;
  }

  async getHeartbeatRuns(id: string, limit: number = 20): Promise<HeartbeatPing[]> {
    const response = await this.client.get<{ pings?: HeartbeatPing[] } | HeartbeatPing[]>(
      `/heartbeats/${id}/pings`,
      { params: { limit } }
    );
    const data = response.data as { pings?: HeartbeatPing[] };
    return data.pings || (response.data as HeartbeatPing[]);
  }

  // Alert Channels
  async getAlertChannels(): Promise<AlertChannel[]> {
    const response = await this.client.get<AlertChannel[] | { data?: AlertChannel[] }>(
      '/alert-channels'
    );
    return Array.isArray(response.data) ? response.data : response.data.data || [];
  }

  async getAlertChannel(id: string): Promise<AlertChannel> {
    const response = await this.client.get<AlertChannel>(`/alert-channels/${id}`);
    return response.data;
  }

  async createAlertChannel(data: Partial<AlertChannel>): Promise<AlertChannel> {
    const response = await this.client.post<AlertChannel>('/alert-channels', data);
    return response.data;
  }

  async updateAlertChannel(id: string, data: Partial<AlertChannel>): Promise<AlertChannel> {
    const response = await this.client.put<AlertChannel>(`/alert-channels/${id}`, data);
    return response.data;
  }

  async deleteAlertChannel(id: string): Promise<void> {
    await this.client.delete(`/alert-channels/${id}`);
  }

  async testAlertChannel(id: string): Promise<{ success: boolean; message: string }> {
    const response = await this.client.post<{ success: boolean; message: string }>(
      `/alert-channels/${id}/test`
    );
    return response.data;
  }

  // Status Pages
  async getStatusPages(): Promise<StatusPage[]> {
    const response = await this.client.get<StatusPage[] | { data?: StatusPage[] }>('/status-pages');
    return Array.isArray(response.data) ? response.data : response.data.data || [];
  }

  async getStatusPage(id: string): Promise<StatusPage> {
    const response = await this.client.get<StatusPage>(`/status-pages/${id}`);
    return response.data;
  }

  async createStatusPage(data: Partial<StatusPage>): Promise<StatusPage> {
    const response = await this.client.post<StatusPage>('/status-pages', data);
    return response.data;
  }

  async updateStatusPage(id: string, data: Partial<StatusPage>): Promise<StatusPage> {
    const response = await this.client.put<StatusPage>(`/status-pages/${id}`, data);
    return response.data;
  }

  async deleteStatusPage(id: string): Promise<void> {
    await this.client.delete(`/status-pages/${id}`);
  }

  async addMonitorToStatusPage(
    spId: string,
    data: { monitor_type: string; monitor_id: string; display_name: string; display_order?: number }
  ): Promise<{ id: string; status_page_id: string; monitor_id: string; [key: string]: unknown }> {
    const response = await this.client.post<{
      id: string;
      status_page_id: string;
      monitor_id: string;
    }>(`/status-pages/${spId}/monitors`, data);
    return response.data as {
      id: string;
      status_page_id: string;
      monitor_id: string;
      [key: string]: unknown;
    };
  }

  async removeMonitorFromStatusPage(spId: string, entryId: string): Promise<void> {
    await this.client.delete(`/status-pages/${spId}/monitors/${entryId}`);
  }

  async updateStatusPageMonitorOrder(
    spId: string,
    entryId: string,
    displayOrder: number
  ): Promise<{ id: string; status_page_id: string; monitor_id: string; [key: string]: unknown }> {
    const response = await this.client.patch<{
      id: string;
      status_page_id: string;
      monitor_id: string;
    }>(`/status-pages/${spId}/monitors/${entryId}`, { display_order: displayOrder });
    return response.data as {
      id: string;
      status_page_id: string;
      monitor_id: string;
      [key: string]: unknown;
    };
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

  async getIncident(id: string): Promise<Incident> {
    const response = await this.client.get<Incident>(`/incidents/${id}`);
    return response.data;
  }

  async createIncident(data: Partial<Incident>): Promise<Incident> {
    const response = await this.client.post<Incident>('/incidents', data);
    return response.data;
  }

  async updateIncident(id: string, data: Partial<Incident>): Promise<Incident> {
    const response = await this.client.put<Incident>(`/incidents/${id}`, data);
    return response.data;
  }

  async deleteIncident(id: string): Promise<void> {
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
    schedule_active?: boolean;
    max_tests?: number;
    secrets?: Record<string, string>;
    allow_form_submit?: boolean;
  }): Promise<Suite> {
    const response = await this.client.post<Suite>('/playwright-autopilot/suites', payload);
    return response.data;
  }

  async updateSuite(
    suiteId: string,
    payload: { suite_name?: string; target_url?: string }
  ): Promise<Suite> {
    const response = await this.client.patch<Suite>(
      `/playwright-autopilot/suites/${suiteId}`,
      payload
    );
    return response.data;
  }

  async updateSuiteSchedule(
    suiteId: string,
    payload: { schedule_active?: boolean; cron_expression?: string }
  ): Promise<Suite> {
    const response = await this.client.patch<Suite>(
      `/playwright-autopilot/suites/${suiteId}/schedule`,
      payload
    );
    return response.data;
  }

  async updateSuiteSecrets(suiteId: string, secrets: Record<string, string>): Promise<void> {
    await this.client.patch(`/playwright-autopilot/suites/${suiteId}/secrets`, { secrets });
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

  // ── Suite CI integration (headless ops; install/connect stays in web UI) ──

  async getSuiteCiIntegration(suiteId: string): Promise<SuiteCiIntegration | null> {
    const response = await this.client.get<unknown>(`/playwright-autopilot/suites/${suiteId}/ci`);
    return mapSuiteCiIntegration(response.data);
  }

  async generateSuiteCiWebhookToken(suiteId: string): Promise<{ token: string }> {
    const response = await this.client.post<{ token: string }>(
      `/playwright-autopilot/suites/${suiteId}/ci/generate-token`
    );
    return { token: response.data.token };
  }

  async deleteSuiteCiIntegration(suiteId: string): Promise<void> {
    await this.client.delete(`/playwright-autopilot/suites/${suiteId}/ci`);
  }

  async getSuiteScripts(
    suiteId: string
  ): Promise<{ suite_id: string; tests: Array<{ id: string; name: string; code: string }> }> {
    const response = await this.client.get<{
      suite_id: string;
      tests: Array<{ id: string; name: string; code: string }>;
    }>(`/playwright-autopilot/suites/${suiteId}/scripts`);
    return response.data;
  }

  async updateTestScript(testId: string, code: string): Promise<void> {
    await this.client.patch(`/playwright-autopilot/tests/${testId}/script`, { code });
  }

  async generateTest(suiteId: string, plannedFile: string): Promise<{ testId: string }> {
    const response = await this.client.post<{ testId: string }>(
      `/playwright-autopilot/suites/${suiteId}/generate-test`,
      { planned_file: plannedFile }
    );
    return response.data;
  }

  async dismissPlannedFile(
    suiteId: string,
    plannedFile: string
  ): Promise<{ dismissed_planned_files: string[] }> {
    const response = await this.client.post<{ dismissed_planned_files: string[] }>(
      `/playwright-autopilot/suites/${suiteId}/planned-files/dismiss`,
      { plannedFile }
    );
    return response.data;
  }

  async restorePlannedFile(
    suiteId: string,
    plannedFile: string
  ): Promise<{ dismissed_planned_files: string[] }> {
    const response = await this.client.post<{ dismissed_planned_files: string[] }>(
      `/playwright-autopilot/suites/${suiteId}/planned-files/restore`,
      { plannedFile }
    );
    return response.data;
  }

  async testHealHistory(testId: string, healId: string): Promise<Array<Record<string, unknown>>> {
    const response = await this.client.get<Array<Record<string, unknown>>>(
      `/playwright-autopilot/tests/${testId}/heals/${healId}/history`
    );
    return response.data;
  }

  async pollSuiteTests(
    suiteId: string,
    expectedCount: number,
    maxAttempts: number = 360,
    intervalMs: number = 5000
  ): Promise<Suite> {
    let attempts = 0;
    while (attempts < maxAttempts) {
      const suite = await this.getSuite(suiteId);
      if (suite.generated_tests.length >= expectedCount) return suite;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      attempts++;
    }
    return this.getSuite(suiteId);
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

  // Incident extras
  async addIncidentComment(id: string, message: string): Promise<IncidentEvent> {
    const response = await this.client.post<IncidentEvent>(`/incidents/${id}/comments`, {
      message,
    });
    return response.data;
  }

  async assignIncident(id: string, userId: string | null): Promise<Incident> {
    const response = await this.client.post<Incident>(`/incidents/${id}/assign`, {
      assigned_to: userId,
    });
    return response.data;
  }

  // API Keys
  async getApiKeys(): Promise<ApiKey[]> {
    const response = await this.client.get<{ apiKeys: ApiKey[] } | ApiKey[]>('/api-keys');
    if (Array.isArray(response.data)) return response.data;
    return (response.data as { apiKeys: ApiKey[] }).apiKeys || [];
  }

  async createApiKey(name: string): Promise<ApiKey> {
    const response = await this.client.post<{ apiKey: ApiKey } | ApiKey>('/api-keys', { name });
    const data = response.data as { apiKey?: ApiKey };
    return data.apiKey || (response.data as ApiKey);
  }

  async deleteApiKey(id: string): Promise<{ message: string; apiKey: ApiKey }> {
    const response = await this.client.delete<{ message: string; apiKey: ApiKey }>(
      `/api-keys/${id}`
    );
    return response.data;
  }

  async toggleApiKey(id: string): Promise<{ message: string; apiKey: ApiKey }> {
    const response = await this.client.patch<{ message: string; apiKey: ApiKey }>(
      `/api-keys/${id}/toggle`
    );
    return response.data;
  }

  // Teams
  async getTeams(): Promise<Team[]> {
    const response = await this.client.get<Team[] | { teams?: Team[] }>('/teams');
    if (Array.isArray(response.data)) return response.data;
    return (response.data as { teams?: Team[] }).teams || [];
  }

  async getTeamMembers(teamId: string): Promise<TeamMember[]> {
    const response = await this.client.get<TeamMember[] | { members?: TeamMember[] }>(
      `/teams/${teamId}/members`
    );
    if (Array.isArray(response.data)) return response.data;
    return (response.data as { members?: TeamMember[] }).members || [];
  }

  async regenerateTeamInvite(teamId: string): Promise<{ message: string; inviteCode: string }> {
    const response = await this.client.post<{ message: string; inviteCode: string }>(
      `/teams/${teamId}/regenerate-invite`
    );
    return response.data;
  }

  async removeTeamMember(teamId: string, userId: string): Promise<unknown> {
    const response = await this.client.delete(`/teams/${teamId}/members/${userId}`);
    return response.data;
  }

  async updateTeamMemberRole(teamId: string, userId: string, role: string): Promise<unknown> {
    const response = await this.client.put(`/teams/${teamId}/members/${userId}`, { role });
    return response.data;
  }

  // Suite extras
  async toggleSuitePublic(suiteId: string, isPublic: boolean): Promise<unknown> {
    const response = await this.client.patch(
      `/playwright-autopilot/suites/${suiteId}/toggle-public`,
      { is_public: isPublic }
    );
    return response.data;
  }

  async healSuite(
    suiteId: string
  ): Promise<{ suite_id: string; heals: Array<{ testId: string; healId: string }> }> {
    const response = await this.client.post<{
      suite_id: string;
      heals: Array<{ testId: string; healId: string }>;
    }>(`/playwright-autopilot/suites/${suiteId}/heal`, {});
    return response.data;
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
