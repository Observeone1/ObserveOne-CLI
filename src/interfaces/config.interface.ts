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
  getProjectConfig(): { name?: string; description?: string } | undefined;
  setProjectConfig(config: { name?: string; description?: string }): void;
  getDefaultOptions(): {
    timeout: number;
    retries: number;
    verbose: boolean;
    pollIntervalMs: number;
    maxAttempts: number;
  };
  setDefaultOptions(
    options: Partial<{
      timeout: number;
      retries: number;
      verbose: boolean;
      pollIntervalMs: number;
      maxAttempts: number;
    }>
  ): void;
  isDevelopment(): boolean;
  reset(): void;
  getConfigPath(): string;
  setCommandLineApiUrl(url: string): void;
}
