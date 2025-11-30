import axios, { AxiosInstance, AxiosResponse } from "axios";
import { ConfigManager } from "./config.js";
import {
  Test,
  TestExecution,
  TestResult,
  ApiResponse,
  LoginResponse,
} from "../types/index.js";
import chalk from "chalk";

export class ApiClient {
  private client: AxiosInstance;
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = ConfigManager.getApiKey();

    const apiUrl = ConfigManager.getApiUrl();
    const isDev = ConfigManager.isDevelopment();
    const timeout = ConfigManager.getDefaultOptions().timeout || 30000;

    this.client = axios.create({
      baseURL: apiUrl,
      timeout: timeout,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": `obs1-cli/1.0.1 (${isDev ? "dev" : "prod"})`,
      },
    });

    // Add auth interceptor
    this.client.interceptors.request.use((config) => {
      if (this.apiKey) {
        config.headers.Authorization = `Bearer ${this.apiKey}`;
      }
      return config;
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          throw new Error(
            'Authentication failed. Please run "obs1 login" to authenticate.'
          );
        }
        if (error.response?.status === 403) {
          throw new Error(
            "Access denied. You do not have permission to perform this action."
          );
        }
        if (error.response?.status === 404) {
          throw new Error("Resource not found.");
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
    this.client.defaults.headers.Authorization = `Bearer ${apiKey}`;
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await this.client.post("/api-keys/validate", {
        key: apiKey,
      });
      return response.data.valid === true;
    } catch (error: any) {
      return false;
    }
  }

  async validateToken(): Promise<boolean> {
    try {
      // Try API key validation first
      const response = await this.client.post("/api-keys/validate", {
        key: this.apiKey,
      });

      return response.data.valid === true;
    } catch (error: any) {
      // Fallback to JWT validation for backward compatibility
      try {
        const response = await this.client.get("/auth/check");
        return response.data.authenticated === true;
      } catch (jwtError: any) {
        return false;
      }
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
    const response = await this.client.get<Test[]>("/browser-checks");
    return response.data;
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
      testData
    );
    return response.data;
  }

  async executeTest(testId: number): Promise<TestResult> {
    const response = await this.client.post<TestResult>(
      `/browser-checks/${testId}/execute`
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
      testData
    );
    return response.data;
  }

  async getExecutionStatus(executionId: number): Promise<TestExecution> {
    const response = await this.client.get<TestExecution>(
      `/browser-checks/execution/${executionId}`
    );
    return response.data;
  }

  async getExecutionResults(executionId: number): Promise<any[]> {
    const response = await this.client.get<any[]>(
      `/browser-checks/executions/${executionId}`
    );
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
    const response = await this.client.post("/browser-checks/cancel", {
      taskId,
      executionId,
    });
    return response.data;
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
    intervalMs: number = 5000
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
      `Test execution ${executionId} did not complete within the timeout period`
    );
  }
}
