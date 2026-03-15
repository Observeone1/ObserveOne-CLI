import Conf from 'conf';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { IConfigService } from '../interfaces/config.interface.js';
import { ObserveOneConfig, ProjectConfig, DefaultOptions } from '../types/index.js';

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
 * Manages CLI configuration using Conf library and local .obs.config.json
 */
export class ConfigService implements IConfigService {
  private config: Conf<ObserveOneConfig>;
  private commandLineApiUrl?: string;
  private localConfig: Partial<ObserveOneConfig> = {};

  constructor(config?: Conf<ObserveOneConfig>) {
    // 1. Load Global Config (Lowest priority before Defaults)
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

    // 2. Load Local Config (.obs.config.json in process.cwd())
    // This takes precedence over global config
    const localConfigPath = join(process.cwd(), '.obs.config.json');
    if (existsSync(localConfigPath)) {
      try {
        const rawData = readFileSync(localConfigPath, 'utf8');
        this.localConfig = JSON.parse(rawData);
      } catch (_error) {
        // Silently fail or log if invalid JSON
      }
    }
  }

  getApiUrl(): string {
    // Priority order: 
    // 1) command line option
    // 2) environment variable
    // 3) local config file (.obs.config.json)
    // 4) saved global config (conf)
    // 5) default

    if (this.commandLineApiUrl) return this.commandLineApiUrl;
    if (process.env.OBS_API_URL) return process.env.OBS_API_URL;
    if (this.localConfig.apiUrl) return this.localConfig.apiUrl;
    
    // If explicitly running in dev mode, force the dev URL unless overridden by 1-3
    if (this.isDevelopment() && !process.env.OBS_API_URL && !this.localConfig.apiUrl) {
      return 'http://localhost:8080/api';
    }

    return this.config.get('apiUrl') || getDefaultApiUrl();
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
    // Priority: 1) Env Var, 2) Local Config, 3) Global Config
    return (
      process.env.OBS_API_KEY || 
      this.localConfig.apiKey || 
      this.config.get('apiKey')
    );
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

  getProjectConfig(): ProjectConfig {
    // Merge local project config with global
    return {
      ...(this.config.get('project') || {}),
      ...(this.localConfig.project || {}),
    };
  }

  setProjectConfig(projectConfig: ProjectConfig): void {
    this.config.set('project', projectConfig);
  }

  getDefaultOptions(): Required<DefaultOptions> {
    const globalOptions = this.config.get('defaultOptions') || {};
    const localOptions = this.localConfig.defaultOptions || {};

    // Priority: Local > Global > Hardcoded Defaults
    return {
      timeout: localOptions.timeout ?? globalOptions.timeout ?? 600000,
      retries: localOptions.retries ?? globalOptions.retries ?? 3,
      verbose: localOptions.verbose ?? globalOptions.verbose ?? false,
      pollIntervalMs: localOptions.pollIntervalMs ?? globalOptions.pollIntervalMs ?? 2000,
      maxAttempts: localOptions.maxAttempts ?? globalOptions.maxAttempts ?? 300,
    };
  }

  setDefaultOptions(options: DefaultOptions): void {
    this.config.set('defaultOptions', options);
  }

  reset(): void {
    this.config.clear();
  }

  getConfigPath(): string {
    return this.config.path;
  }
}
