import { IApiClient } from "../../interfaces/api-client.interface.js";
import { Test, TestExecution, TestResult } from "../../types/index.js";

/**
 * Create a stub implementation of IApiClient for testing
 */
export function createApiClientStub(
  overrides?: Partial<IApiClient>
): IApiClient {
  const mockTest: Test = {
    id: 1,
    name: "Test 1",
    url: "https://example.com",
    prompt: "Test prompt",
    user_id: "1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockTestResult: TestResult = {
    status: "SUCCESS",
    message: "Test completed successfully",
    task_id: "test-task-123",
  };

  const mockExecution: TestExecution = {
    id: 1,
    test_id: 1,
    status: "SUCCESS",
    started_at: new Date().toISOString(),
  };

  return {
    setApiKey: () => {},
    validateApiKey: async () => true,
    validateToken: async () => true,
    post: async () => ({}),
    get: async () => ({}),
    getTests: async () => [mockTest],
    getTest: async () => mockTest,
    createTest: async () => ({ id: 1, message: "Test created" }),
    executeTest: async () => mockTestResult,
    executeAdhocTest: async () => mockTestResult,
    getExecutionStatus: async () => mockExecution,
    getExecutionResults: async () => [],
    cancelTask: async () => ({
      success: true,
      taskId: "test-task-123",
    }),
    healthCheck: async () => ({
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: "test",
    }),
    pollExecutionStatus: async () => mockExecution,
    requestCliAuth: async () => ({
      request_id: "test-request-123",
      auth_url: "https://test.observeone.com/auth",
    }),
    checkCliAuthStatus: async () => ({
      status: "approved",
      api_key: "test-api-key-123",
    }),
    ...overrides,
  };
}
