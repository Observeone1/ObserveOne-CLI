import Conf from "conf";
import { ObserveOneConfig } from "../types/index.js";

// Detect environment dynamically
const isDevelopment = () => {
  const isDev =
    process.env.NODE_ENV === "development" ||
    process.env.OBS1_ENV === "development" ||
    process.env.OBS1_DEV === "true" ||
    process.env.OBS1_DEV === "1" ||
    process.env.NODE_ENV === "dev";
  return isDev;
};

const getDefaultApiUrl = () => {
  if (isDevelopment()) {
    return "http://localhost:8080/api";
  }
  return "https://o1-backend-production.up.railway.app/api";
};

const config = new Conf<ObserveOneConfig>({
  projectName: "observeone",
  defaults: {
    apiUrl: process.env.OBS1_API_URL || getDefaultApiUrl(),
    defaultOptions: {
      timeout: 600000, // 10 minutes
      retries: 3,
      verbose: false,
      pollIntervalMs: 2000,
      maxAttempts: 300,
    },
  },
});

export class ConfigManager {
  static getConfig(): ObserveOneConfig {
    return config.store;
  }

  static getApiUrl(): string {
    // Always check environment first, then fall back to config
    return process.env.OBS1_API_URL || getDefaultApiUrl();
  }

  static isDevelopment(): boolean {
    return isDevelopment();
  }

  static getApiKey(): string | undefined {
    return config.get("apiKey") || process.env.OBS1_API_KEY;
  }

  static setApiUrl(url: string): void {
    // Ensure URL ends with /api
    const cleanUrl = url.endsWith("/") ? url.slice(0, -1) : url;
    const finalUrl = cleanUrl.endsWith("/api") ? cleanUrl : `${cleanUrl}/api`;
    config.set("apiUrl", finalUrl);
  }

  static setApiKey(key: string): void {
    config.set("apiKey", key);
  }

  static clearApiKey(): void {
    config.delete("apiKey");
  }

  static getProjectConfig() {
    return config.get("project", {});
  }

  static setProjectConfig(projectConfig: any): void {
    config.set("project", projectConfig);
  }

  static getDefaultOptions() {
    return config.get("defaultOptions", {
      timeout: 600000,
      retries: 3,
      verbose: false,
      pollIntervalMs: 2000,
      maxAttempts: 300,
    });
  }

  static setDefaultOptions(options: any): void {
    config.set("defaultOptions", options);
  }

  static reset(): void {
    config.clear();
  }

  static getConfigPath(): string {
    return config.path;
  }

  static getSupabaseUrl(): string {
    return (
      process.env.VITE_SUPABASE_URL || "https://your-supabase-url.supabase.co"
    );
  }

  static getSupabaseAnonKey(): string {
    return process.env.VITE_SUPABASE_ANON_KEY || "your-anon-key";
  }
}
