import { describe, it, expect, beforeEach } from "vitest";
import { ConfigService } from "../services/config.service.js";
import Conf from "conf";
import { ObserveOneConfig } from "../types/index.js";

describe("ConfigService", () => {
  let configService: ConfigService;
  let mockConf: Conf<ObserveOneConfig>;

  beforeEach(() => {
    // Create a test instance with in-memory config
    mockConf = new Conf<ObserveOneConfig>({
      projectName: "observeone-test",
      cwd: "./test-config",
      defaults: {
        apiUrl: "http://localhost:8080/api",
        defaultOptions: {
          timeout: 30000,
          retries: 3,
          verbose: false,
          pollIntervalMs: 1000,
          maxAttempts: 10,
        },
      },
    });

    configService = new ConfigService(mockConf);
  });

  describe("getApiUrl", () => {
    it("should return API URL from config", () => {
      const url = configService.getApiUrl();
      expect(url).toBeDefined();
      expect(url).toContain("/api");
    });
  });

  describe("setApiKey and getApiKey", () => {
    it("should set and get API key", () => {
      const apiKey = "test-api-key-123";
      configService.setApiKey(apiKey);
      expect(configService.getApiKey()).toBe(apiKey);
    });

    it("should clear API key", () => {
      configService.setApiKey("test-key");
      configService.clearApiKey();
      expect(configService.getApiKey()).toBeUndefined();
    });
  });

  describe("getDefaultOptions", () => {
    it("should return default options", () => {
      const options = configService.getDefaultOptions();
      expect(options).toHaveProperty("timeout");
      expect(options).toHaveProperty("retries");
      expect(options).toHaveProperty("verbose");
      expect(options).toHaveProperty("pollIntervalMs");
      expect(options).toHaveProperty("maxAttempts");
    });
  });

  describe("isDevelopment", () => {
    it("should detect development environment", () => {
      const isDev = configService.isDevelopment();
      expect(typeof isDev).toBe("boolean");
    });
  });

  describe("project config", () => {
    it("should set and get project config", () => {
      const projectConfig = {
        name: "Test Project",
        description: "Test Description",
      };

      configService.setProjectConfig(projectConfig);
      const retrieved = configService.getProjectConfig();

      expect(retrieved).toEqual(projectConfig);
    });
  });
});
