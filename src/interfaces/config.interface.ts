/**
 * Configuration service interface
 * Abstracts config storage and retrieval
 */
export interface IConfigService {
  getApiUrl(): string;
  getApiKey(): string | undefined;
  setApiUrl(url: string): void;
  setApiKey(key: string): void;
  clearApiKey(): void;
  getProjectConfig(): any;
  setProjectConfig(config: any): void;
  getDefaultOptions(): {
    timeout: number;
    retries: number;
    verbose: boolean;
    pollIntervalMs: number;
    maxAttempts: number;
  };
  setDefaultOptions(options: any): void;
  isDevelopment(): boolean;
  reset(): void;
  getConfigPath(): string;
  getSupabaseUrl(): string;
  getSupabaseAnonKey(): string;
  setCommandLineApiUrl(url: string): void;
}
