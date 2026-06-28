import Conf from 'conf';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { IConfigService } from '../interfaces/config.interface.js';
import {
  ObserveOneConfig,
  LocalProjectConfig,
  ProjectConfig,
  DefaultOptions,
} from '../types/index.js';

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
  private commandLineApiKey?: string;
  private localConfig: LocalProjectConfig = {};
  private localConfigPath: string;

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
    this.localConfigPath = join(process.cwd(), '.obs.config.json');
    if (existsSync(this.localConfigPath)) {
      try {
        const rawData = readFileSync(this.localConfigPath, 'utf8');
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
    // Priority:
    // 1) --api-key flag (session-only runtime override, never persisted)
    // 2) Env Var (OBS_API_KEY)
    // 3) Local Config file (back-compat read only)
    // 4) Global Config (OS store)
    const runtimeKey = this.commandLineApiKey;
    const envKey = process.env.OBS_API_KEY;
    // Back-compat: a key already present in an existing .obs.config.json is still
    // honored, even though LocalProjectConfig no longer advertises the field (the
    // CLI never writes it there). Cast to reach the legacy field without widening
    // the committed-file type to invite a secret.
    const localKey = (this.localConfig as { apiKey?: string }).apiKey;
    const globalKey = this.config.get('apiKey');

    if (process.env.OBS_VERBOSE === 'true') {
      if (runtimeKey) console.error('  [Config] Using API key from --api-key flag (session only)');
      else if (envKey)
        console.error('  [Config] Using API key from Environment Variable (OBS_API_KEY)');
      else if (localKey)
        console.error('  [Config] Using API key from Local Config (.obs.config.json)');
      else if (globalKey) console.error('  [Config] Using API key from Global OS Store');
    }

    return runtimeKey || envKey || localKey || globalKey;
  }

  setCommandLineApiKey(key: string): void {
    // Keep the provided key in-memory for this process/session only. It is NOT
    // written to the global Conf store here — persisting an unvalidated key would
    // leave an invalid credential on disk. Validated persistence happens in the
    // `login` flow.
    this.commandLineApiKey = key;
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
    // Clear from BOTH the global OS store and the local .obs.config.json so a
    // stale local-file token cannot keep authenticating after `obs logout`.
    this.config.delete('apiKey');
    this.clearLocalApiKey();
  }

  clearLocalApiKey(): void {
    // Drop the in-memory copy first so a subsequent getApiKey() in this process
    // does not return the stale local value.
    const localInMemory = this.localConfig as { apiKey?: string };
    if (localInMemory.apiKey !== undefined) {
      delete localInMemory.apiKey;
    }

    try {
      if (!existsSync(this.localConfigPath)) return;
      const rawData = readFileSync(this.localConfigPath, 'utf8');
      const parsed = JSON.parse(rawData) as Partial<ObserveOneConfig>;
      if (parsed.apiKey === undefined) return;
      delete parsed.apiKey;
      writeFileSync(this.localConfigPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
    } catch (_error) {
      // Best effort — never throw out of logout because of a local-file issue.
    }
  }

  hasEnvApiKey(): boolean {
    return Boolean(process.env.OBS_API_KEY);
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
