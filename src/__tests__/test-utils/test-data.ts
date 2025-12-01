// Test data generators for CLI testing
import { Test, TestExecution, TestResult } from "../../types/index.js";

export class TestDataGenerator {
  static createMockTest(overrides: Partial<Test> = {}): Test {
    return {
      id: 1,
      name: "Test Website",
      description: "Test the homepage",
      url: "https://example.com",
      prompt: "Check if the homepage loads correctly",
      user_id: "user-123",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      ...overrides,
    };
  }

  static createMockTests(count: number): Test[] {
    return Array.from({ length: count }, (_, i) =>
      this.createMockTest({
        id: i + 1,
        name: `Test ${i + 1}`,
        url: `https://example${i + 1}.com`,
      })
    );
  }

  static createMockExecution(
    overrides: Partial<TestExecution> = {}
  ): TestExecution {
    return {
      id: 123,
      test_id: 1,
      status: "SUCCESS",
      started_at: "2024-01-01T00:00:00Z",
      completed_at: "2024-01-01T00:01:00Z",
      ...overrides,
    };
  }

  static createMockTestResult(overrides: Partial<TestResult> = {}): TestResult {
    return {
      status: "SUCCESS",
      message: "Test completed successfully",
      task_id: "task-abc123",
      ...overrides,
    };
  }

  static createMockSSEMessage(type: string, data: any = {}) {
    return {
      type,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  static createMockSSEStepUpdate(stepNumber: number) {
    return this.createMockSSEMessage("step_update", {
      step: {
        step_number: stepNumber,
        next_goal: `Step ${stepNumber} goal`,
        evaluation: `Evaluating step ${stepNumber}`,
        actions: [
          {
            go_to_url: {
              url: "https://example.com",
            },
          },
        ],
        result: [{ success: true }],
      },
    });
  }

  static createMockJUnitTestSuite() {
    return {
      name: "ObserveOne Tests",
      tests: 2,
      failures: 1,
      errors: 0,
      time: 1.5,
      testCases: [
        {
          name: "Homepage Test",
          classname: "WebsiteTests",
          time: 1.0,
          status: "passed" as const,
        },
        {
          name: "Login Test",
          classname: "WebsiteTests",
          time: 0.5,
          status: "failed" as const,
          failure: {
            message: "Login button not found",
            type: "AssertionError",
            stackTrace: "at test.js:10",
          },
        },
      ],
    };
  }

  static createMockAuthResponse(approved: boolean, apiKey?: string) {
    return {
      status: (approved ? "approved" : "pending") as
        | "approved"
        | "pending"
        | "denied",
      api_key: approved ? apiKey || "test-api-key-123" : undefined,
    };
  }

  static createMockCliAuthRequest() {
    return {
      request_id: "req-123",
      auth_url: "https://app.obs1.com/cli-auth/req-123",
    };
  }
}
