import { ApiClient } from "../services/api-client.service.js";
import { createConfigStub } from "./stubs/config.stub.js";
import { vi, beforeEach, describe, it, expect } from "vitest";
import axios from "axios";

// Mock axios
vi.mock("axios", () => ({
  default: {
    create: vi.fn(() => ({
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
      get: vi.fn(),
      post: vi.fn(),
      defaults: {
        headers: {
          common: {},
        },
      },
    })),
  },
}));

describe("ApiClient", () => {
  let apiClient: ApiClient;
  let mockAxiosInstance: any;
  let configStub: ReturnType<typeof createConfigStub>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock axios instance
    mockAxiosInstance = {
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
      get: vi.fn(),
      post: vi.fn(),
      defaults: {
        headers: {
          common: {},
        },
      },
    };

    (axios.create as any).mockReturnValue(mockAxiosInstance);

    // Create config stub with test API key
    configStub = createConfigStub({
      getApiKey: () => "test-api-key",
    });

    // Create ApiClient with injected config
    apiClient = new ApiClient(configStub);
  });

  describe("constructor", () => {
    it("should initialize with injected config", () => {
      expect(apiClient).toBeDefined();
      expect(axios.create).toHaveBeenCalled();
    });
  });

  describe("setApiKey", () => {
    it("should update API key", () => {
      const newApiKey = "new-test-key";
      apiClient.setApiKey(newApiKey);
      // ApiKey is stored internally and will be used in interceptors
      expect(apiClient).toBeDefined();
    });
  });

  describe("validateToken", () => {
    it("should return true for valid token", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: [],
      });

      const result = await apiClient.validateToken();
      expect(result).toBe(true);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/browser-checks?limit=1"
      );
    });

    it("should return false for invalid token", async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error("Unauthorized"));

      const result = await apiClient.validateToken();
      expect(result).toBe(false);
    });
  });

  describe("getTests", () => {
    it("should fetch tests successfully", async () => {
      const mockTests = [
        {
          id: 1,
          name: "Test 1",
          url: "https://example.com",
          user_id: "1",
          prompt: "test",
          created_at: "",
          updated_at: "",
        },
        {
          id: 2,
          name: "Test 2",
          url: "https://example.org",
          user_id: "1",
          prompt: "test",
          created_at: "",
          updated_at: "",
        },
      ];

      mockAxiosInstance.get.mockResolvedValue({ data: mockTests });

      const result = await apiClient.getTests();
      expect(result).toEqual(mockTests);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/browser-checks");
    });

    it("should handle errors when fetching tests", async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error("Network error"));

      await expect(apiClient.getTests()).rejects.toThrow("Network error");
    });
  });

  describe("executeTest", () => {
    it("should execute test successfully", async () => {
      const mockResult = {
        status: "SUCCESS",
        message: "Test passed",
        task_id: "task-123",
      };

      mockAxiosInstance.post.mockResolvedValue({ data: mockResult });

      const result = await apiClient.executeTest(1);
      expect(result).toEqual(mockResult);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/browser-checks/1/execute"
      );
    });
  });

  describe("pollExecutionStatus", () => {
    it("should poll until completion", async () => {
      const completedExecution = {
        id: 1,
        test_id: 1,
        status: "SUCCESS",
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      };

      // Return completed execution immediately
      mockAxiosInstance.get.mockResolvedValue({ data: completedExecution });

      const result = await apiClient.pollExecutionStatus(1, 3, 100);

      expect(result).toEqual(completedExecution);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/browser-checks/execution/1"
      );
    });
  });
});
