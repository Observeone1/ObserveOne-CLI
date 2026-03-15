import { ProjectConfig, DefaultOptions } from '../types/index.js';

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
  getProjectConfig(): ProjectConfig;
  setProjectConfig(config: ProjectConfig): void;
  getDefaultOptions(): Required<DefaultOptions>;
  setDefaultOptions(options: DefaultOptions): void;
  isDevelopment(): boolean;
  reset(): void;
  getConfigPath(): string;
  setCommandLineApiUrl(url: string): void;
}
