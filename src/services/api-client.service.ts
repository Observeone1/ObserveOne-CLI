import axios, { AxiosInstance } from "axios";
import { IConfigService } from "../interfaces/config.interface.js";
import { IApiClient } from "../interfaces/api-client.interface.js";
import {
  Test,
  TestExecution,
  TestResult,
  UrlMonitor,
  ApiCheck,
  Heartbeat,
} from "../types/index.js";

/**
 * API Client implementation
 * Handles HTTP communication with ObserveOne backend
 */
export class ApiClient implements IApiClient {
  private client: AxiosInstance;
  private apiKey: string | undefined;
  private configService: IConfigService;

  constructor(configService: IConfigService, version: string = "1.0.1") {
    this.configService = configService;
    this.apiKey = configService.getApiKey();

    const isDev = configService.isDevelopment();
    const timeout = configService.getDefaultOptions().timeout || 30000;

    this.client = axios.create({
      timeout: timeout,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": `obs-cli/${version} (${isDev ? "dev" : "prod"})`,
      },
    });

    // Add interceptor to set baseURL dynamically (allows --api-url to work)
    this.client.interceptors.request.use((config) => {
      config.baseURL = this.configService.getApiUrl();
      if (this.apiKey) {
        // Backend expects CLI API keys in x-obs1-cli header, not Authorization
        // Note: keeping x-obs1-cli header name for backward compatibility
        config.headers["x-obs1-cli"] = this.apiKey;
      }
      return config;
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          throw new Error(
            'Authentication failed. Please run "obs login" to authenticate.',
          );
        }
        if (error.response?.status === 403) {
          throw new Error(
            "Access denied. You do not have permission to perform this action.",
          );
        }
        if (error.response?.status === 404) {
          const attemptedUrl = error.config?.baseURL
            ? `${error.config.baseURL}${error.config.url}`
            : error.config?.url;
          throw new Error(
            `Resource not found. (Attempted API URL: ${attemptedUrl || "unknown"})`,
          );
        }
        if (error.response?.status >= 500) {
          throw new Error(`Server error: ${error.response.status}`);
        }
        throw error;
      },
    );
  }

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    this.client.defaults.headers["x-obs1-cli"] = apiKey;
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      // Temporarily set the key to test it
      const currentKey = this.apiKey;
      this.client.defaults.headers["x-obs1-cli"] = apiKey;

      const response = await this.client.get("/cli/auth/verify");

      // Restore previous key if validation was just a check
      if (currentKey) {
        this.client.defaults.headers["x-obs1-cli"] = currentKey;
      }

      return response.data.valid === true;
    } catch (error: any) {
      return false;
    }
  }

  async validateToken(): Promise<boolean> {
    try {
      if (!this.apiKey) return false;
      const response = await this.client.get("/cli/auth/verify");
      return response.data.valid === true;
    } catch (error: any) {
      return false;
    }
  }

  async provisionHeadlessAuth(
    email?: string,
    password?: string,
  ): Promise<{ api_key: string }> {
    try {
      const response = await this.client.post("/cli/auth/provision", {
        email,
        password,
      });
      return response.data;
    } catch (error: any) {
      if (
        error.code === "ECONNREFUSED" ||
        error.message?.includes("Network Error")
      ) {
        const url =
          this.configService.getApiUrl() || this.client.defaults.baseURL;
        throw new Error(
          `Failed to connect to ObserveOne API. Ensure the server is running or the API URL is correct. (Attempted: ${url})`,
        );
      }
      throw error;
    }
  }

  async post(url: string, data?: any): Promise<any> {
    const response = await this.client.post(url, data);
    return response;
  }

  async get(url: string): Promise<any> {
    const response = await this.client.get(url);
    return response;
  }

  async getTests(): Promise<Test[]> {
    const response = await this.client.get<{ tests: Test[] }>(
      "/browser-checks",
    );
    // Supporting both {tests: []} and [] formats if backend varies
    return Array.isArray(response.data)
      ? response.data
      : response.data.tests || [];
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
      "/browser-checks",
      testData,
    );
    return response.data;
  }

  async updateTest(testId: number, testData: any): Promise<Test> {
    const response = await this.client.put<Test>(
      `/browser-checks/${testId}`,
      testData,
    );
    return response.data;
  }

  async deleteTest(testId: number): Promise<void> {
    await this.client.delete(`/browser-checks/${testId}`);
  }

  async executeTest(testId: number): Promise<TestResult> {
    const response = await this.client.post<TestResult>(
      `/browser-checks/${testId}/execute`,
    );
    return response.data;
  }

  async executeAdhocTest(testData: {
    name: string;
    url: string;
    prompt: string;
    description?: string;
  }): Promise<TestResult> {
    const response = await this.client.post<TestResult>(
      "/browser-checks/execute-adhoc",
      testData,
    );
    return response.data;
  }

  async getExecutionStatus(executionId: number): Promise<TestExecution> {
    const response = await this.client.get<TestExecution>(
      `/browser-checks/execution/${executionId}`,
    );
    return response.data;
  }

  async getExecutionResults(executionId: number): Promise<any[]> {
    const response = await this.client.get<any[]>(
      `/browser-checks/executions/${executionId}`,
    );
    return response.data;
  }

  async cancelTask(
    taskId: string,
    executionId?: number,
  ): Promise<{
    success: boolean;
    taskId: string;
    status?: string;
    message?: string;
  }> {
    const response = await this.client.post("/browser-checks/cancel", {
      taskId,
      executionId,
    });
    return response.data;
  }

  // URL Monitors
  async getUrlMonitors(): Promise<UrlMonitor[]> {
    const response = await this.client.get<any>("/url-monitors");
    return response.data.monitors || response.data.data || [];
  }

  async getUrlMonitor(id: number): Promise<UrlMonitor> {
    const response = await this.client.get<any>(`/url-monitors/${id}`);
    return response.data.monitor || response.data.data || response.data;
  }

  async createUrlMonitor(data: Partial<UrlMonitor>): Promise<UrlMonitor> {
    const response = await this.client.post<any>("/url-monitors", data);
    return response.data.monitor || response.data.data || response.data;
  }

  async updateUrlMonitor(
    id: number,
    data: Partial<UrlMonitor>,
  ): Promise<UrlMonitor> {
    const response = await this.client.put<any>(`/url-monitors/${id}`, data);
    return response.data.monitor || response.data.data || response.data;
  }

  async deleteUrlMonitor(id: number): Promise<void> {
    await this.client.delete(`/url-monitors/${id}`);
  }

  async toggleUrlMonitor(id: number): Promise<boolean> {
    const response = await this.client.patch<any>(`/url-monitors/${id}/toggle`);
    return response.data.is_active ?? response.data.data?.is_active ?? false;
  }

  // API Checks
  async getApiChecks(): Promise<ApiCheck[]> {
    const response = await this.client.get<any>("/api-checks");
    return response.data.apiChecks || response.data.data || [];
  }

  async getApiCheck(id: number): Promise<ApiCheck> {
    const response = await this.client.get<any>(`/api-checks/${id}`);
    return response.data.apiCheck || response.data.data || response.data;
  }

  async createApiCheck(data: Partial<ApiCheck>): Promise<ApiCheck> {
    const response = await this.client.post<any>("/api-checks", data);
    return response.data.apiCheck || response.data.data || response.data;
  }

  async updateApiCheck(id: number, data: Partial<ApiCheck>): Promise<ApiCheck> {
    const response = await this.client.put<any>(`/api-checks/${id}`, data);
    return response.data.apiCheck || response.data.data || response.data;
  }

  async deleteApiCheck(id: number): Promise<void> {
    await this.client.delete(`/api-checks/${id}`);
  }

  async toggleApiCheck(id: number): Promise<boolean> {
    const response = await this.client.patch<any>(`/api-checks/${id}/toggle`);
    return response.data.is_active ?? response.data.data?.is_active ?? false;
  }

  // Heartbeats
  async getHeartbeats(): Promise<Heartbeat[]> {
    const response = await this.client.get<any>("/heartbeats");
    return response.data.heartbeats || response.data.data || [];
  }

  async getHeartbeat(id: number): Promise<Heartbeat> {
    const response = await this.client.get<any>(`/heartbeats/${id}`);
    return response.data.heartbeat || response.data.data || response.data;
  }

  async createHeartbeat(data: Partial<Heartbeat>): Promise<Heartbeat> {
    const response = await this.client.post<any>("/heartbeats", data);
    return response.data.heartbeat || response.data.data || response.data;
  }

  async updateHeartbeat(
    id: number,
    data: Partial<Heartbeat>,
  ): Promise<Heartbeat> {
    const response = await this.client.put<any>(`/heartbeats/${id}`, data);
    return response.data.heartbeat || response.data.data || response.data;
  }

  async deleteHeartbeat(id: number): Promise<void> {
    await this.client.delete(`/heartbeats/${id}`);
  }

  async toggleHeartbeat(id: number): Promise<boolean> {
    const response = await this.client.patch<any>(`/heartbeats/${id}/toggle`);
    return response.data.is_active ?? response.data.data?.is_active ?? false;
  }

  async healthCheck(): Promise<{
    status: string;
    timestamp: string;
    environment: string;
  }> {
    const response = await this.client.get("/health");
    return response.data;
  }

  // Polling method for test execution status
  async pollExecutionStatus(
    executionId: number,
    maxAttempts: number = 60,
    intervalMs: number = 5000,
  ): Promise<TestExecution> {
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const execution = await this.getExecutionStatus(executionId);

        if (
          execution.status === "SUCCESS" ||
          execution.status === "FAILED" ||
          execution.status === "CANCELLED"
        ) {
          return execution;
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        attempts++;
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }

    throw new Error(
      `Test execution ${executionId} did not complete within the timeout period`,
    );
  }

  async requestCliAuth(): Promise<{ request_id: string; auth_url: string }> {
    const response = await this.client.post<{
      request_id: string;
      auth_url: string;
    }>("/cli/auth/request");
    return response.data;
  }

  async checkCliAuthStatus(requestId: string): Promise<{
    status: "pending" | "approved" | "denied";
    api_key?: string;
  }> {
    const response = await this.client.get<{
      status: "pending" | "approved" | "denied";
      api_key?: string;
    }>(`/cli/auth/check/${requestId}`);
    return response.data;
  }
}
