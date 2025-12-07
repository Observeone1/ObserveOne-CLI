import Conf from "conf";
import { IConfigService } from "../interfaces/config.interface.js";
import { ObserveOneConfig } from "../types/index.js";

// Detect environment dynamically
const isDevelopment = () => {
  const isDev =
    process.env.NODE_ENV === "development" ||
    process.env.OBS_ENV === "development" ||
    process.env.OBS_DEV === "true" ||
    process.env.OBS_DEV === "1" ||
    process.env.NODE_ENV === "dev";
  return isDev;
};

const getDefaultApiUrl = () => {
  if (isDevelopment()) {
    return "http://localhost:8080/api";
  }
  return "https://api.observeone.com/api";
};

/**
 * Configuration service implementation
 * Manages CLI configuration using Conf library
 */
export class ConfigService implements IConfigService {
  private config: Conf<ObserveOneConfig>;

  constructor(config?: Conf<ObserveOneConfig>) {
    // Allow injecting config for testing
    this.config =
      config ||
      new Conf<ObserveOneConfig>({
        projectName: "obs",
        defaults: {
          apiUrl: process.env.OBS_API_URL || getDefaultApiUrl(),
          defaultOptions: {
            timeout: 600000, // 10 minutes
            retries: 3,
            verbose: false,
            pollIntervalMs: 2000,
            maxAttempts: 300,
          },
        },
      });
  }

  getApiUrl(): string {
    // Always check environment first, then fall back to config
    return process.env.OBS_API_URL || getDefaultApiUrl();
  }

  isDevelopment(): boolean {
    return isDevelopment();
  }

  getApiKey(): string | undefined {
    return this.config.get("apiKey") || process.env.OBS_API_KEY;
  }

  setApiUrl(url: string): void {
    // Ensure URL ends with /api
    const cleanUrl = url.endsWith("/") ? url.slice(0, -1) : url;
    const finalUrl = cleanUrl.endsWith("/api") ? cleanUrl : `${cleanUrl}/api`;
    this.config.set("apiUrl", finalUrl);
  }

  setApiKey(key: string): void {
    this.config.set("apiKey", key);
  }

  clearApiKey(): void {
    this.config.delete("apiKey");
  }

  getProjectConfig(): any {
    return this.config.get("project", {});
  }

  setProjectConfig(projectConfig: any): void {
    this.config.set("project", projectConfig);
  }

  getDefaultOptions(): {
    timeout: number;
    retries: number;
    verbose: boolean;
    pollIntervalMs: number;
    maxAttempts: number;
  } {
    const options = this.config.get("defaultOptions");
    // Ensure all properties have values
    return {
      timeout: options?.timeout ?? 600000,
      retries: options?.retries ?? 3,
      verbose: options?.verbose ?? false,
      pollIntervalMs: options?.pollIntervalMs ?? 2000,
      maxAttempts: options?.maxAttempts ?? 300,
    };
  }

  setDefaultOptions(options: any): void {
    this.config.set("defaultOptions", options);
  }

  reset(): void {
    this.config.clear();
  }

  getConfigPath(): string {
    return this.config.path;
  }

  getSupabaseUrl(): string {
    return (
      process.env.VITE_SUPABASE_URL || "https://your-supabase-url.supabase.co"
    );
  }

  getSupabaseAnonKey(): string {
    return process.env.VITE_SUPABASE_ANON_KEY || "your-anon-key";
  }
}
