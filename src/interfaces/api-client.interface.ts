import { Test, TestExecution, TestResult } from "../types/index.js";

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
  getTests(): Promise<Test[]>;
  getTest(testId: number): Promise<Test>;
  createTest(testData: {
    name: string;
    url: string;
    prompt: string;
    description?: string;
  }): Promise<{ id: number; message: string }>;
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
