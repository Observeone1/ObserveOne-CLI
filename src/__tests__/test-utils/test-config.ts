// Test configuration utilities
import fs from "fs";
import path from "path";
import os from "os";

export class TestConfig {
  private static testDir: string | null = null;

  static createTempConfigDir(): string {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "obs1-test-"));
    this.testDir = tempDir;
    return tempDir;
  }

  static createMockConfig(configDir: string, config: any): string {
    const configPath = path.join(configDir, ".obs1.config.json");
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return configPath;
  }

  static cleanupTempDir(): void {
    if (this.testDir && fs.existsSync(this.testDir)) {
      fs.rmSync(this.testDir, { recursive: true, force: true });
      this.testDir = null;
    }
  }

  static setTestEnv(vars: Record<string, string>): void {
    Object.entries(vars).forEach(([key, value]) => {
      process.env[key] = value;
    });
  }

  static clearTestEnv(vars: string[]): void {
    vars.forEach((key) => {
      delete process.env[key];
    });
  }

  static getMockProjectConfig() {
    return {
      project: {
        name: "Test Project",
        description: "Test project description",
      },
      defaultOptions: {
        timeout: 60000,
        retries: 3,
        verbose: false,
        pollIntervalMs: 2000,
        maxAttempts: 30,
      },
    };
  }
}
