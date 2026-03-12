import Conf from 'conf';
import { IConfigService } from '../interfaces/config.interface.js';
import { ObserveOneConfig } from '../types/index.js';

// Detect environment dynamically
const isDevelopment = () => {
  const isDev =
    process.env.NODE_ENV === 'development' ||
    process.env.OBS_ENV === 'development' ||
    process.env.OBS_DEV === 'true' ||
    process.env.OBS_DEV === '1' ||
    process.env.NODE_ENV === 'dev';
  return isDev;
};

const getDefaultApiUrl = () => {
  if (isDevelopment()) {
    return 'http://localhost:8080/api';
  }
  return 'https://api.observeone.com/api';
};

/**
 * Configuration service implementation
 * Manages CLI configuration using Conf library
 */
export class ConfigService implements IConfigService {
  private config: Conf<ObserveOneConfig>;
  private commandLineApiUrl?: string;

  constructor(config?: Conf<ObserveOneConfig>) {
    // Allow injecting config for testing
    this.config =
      config ||
      new Conf<ObserveOneConfig>({
        projectName: 'obs',
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
    // Priority order: 1) command line option, 2) environment variable, 3) saved config, 4) default

    // If explicitly running in dev mode, force the dev URL unless explicitly locally overridden
    if (this.isDevelopment() && !this.commandLineApiUrl && !process.env.OBS_API_URL) {
      return 'http://localhost:8080/api';
    }

    return (
      this.commandLineApiUrl ||
      process.env.OBS_API_URL ||
      this.config.get('apiUrl') ||
      getDefaultApiUrl()
    );
  }

  setCommandLineApiUrl(url: string): void {
    // Ensure URL ends with /api
    const cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    const finalUrl = cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
    this.commandLineApiUrl = finalUrl;
  }

  isDevelopment(): boolean {
    return isDevelopment();
  }

  getApiKey(): string | undefined {
    return process.env.OBS_API_KEY || this.config.get('apiKey');
  }

  setApiUrl(url: string): void {
    // Ensure URL ends with /api
    const cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    const finalUrl = cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
    this.config.set('apiUrl', finalUrl);
  }

  setApiKey(key: string): void {
    this.config.set('apiKey', key);
  }

  clearApiKey(): void {
    this.config.delete('apiKey');
  }

  getProjectConfig(): { name?: string; description?: string } | undefined {
    return this.config.get('project') as { name?: string; description?: string } | undefined;
  }

  setProjectConfig(projectConfig: { name?: string; description?: string }): void {
    this.config.set('project', projectConfig);
  }

  getDefaultOptions(): {
    timeout: number;
    retries: number;
    verbose: boolean;
    pollIntervalMs: number;
    maxAttempts: number;
  } {
    const options = this.config.get('defaultOptions');
    // Ensure all properties have values
    return {
      timeout: options?.timeout ?? 600000,
      retries: options?.retries ?? 3,
      verbose: options?.verbose ?? false,
      pollIntervalMs: options?.pollIntervalMs ?? 2000,
      maxAttempts: options?.maxAttempts ?? 300,
    };
  }

  setDefaultOptions(options: {
    timeout?: number;
    retries?: number;
    verbose?: boolean;
    pollIntervalMs?: number;
    maxAttempts?: number;
  }): void {
    this.config.set('defaultOptions', options);
  }

  reset(): void {
    this.config.clear();
  }

  getConfigPath(): string {
    return this.config.path;
  }
}
