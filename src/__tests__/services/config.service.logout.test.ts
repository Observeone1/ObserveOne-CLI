import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fs from 'node:fs';
import { ConfigService } from '../../services/config.service.js';
import Conf from 'conf';
import { ObserveOneConfig } from '../../types/index.js';

// Mock only the fs functions ConfigService uses so these tests never touch the
// real .obs.config.json in cwd, while leaving the rest of fs intact for conf's
// own import chain.
vi.mock('node:fs', async (importActual) => {
  const actual = await importActual<typeof import('node:fs')>();
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  };
});

const mockedFs = vi.mocked(fs);

interface MockConf {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
  path: string;
}

describe('ConfigService logout / credential clearing', () => {
  let mockConf: MockConf;

  beforeEach(() => {
    delete process.env.OBS_API_KEY;
    delete process.env.OBS_API_URL;
    mockConf = {
      get: vi.fn().mockReturnValue(undefined),
      set: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      path: '/mock/path/config.json',
    };
    mockedFs.existsSync.mockReset();
    mockedFs.readFileSync.mockReset();
    mockedFs.writeFileSync.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.OBS_API_KEY;
  });

  const newService = () => new ConfigService(mockConf as unknown as Conf<ObserveOneConfig>);

  it('clearApiKey removes the global key AND strips apiKey from the local .obs.config.json', () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(
      JSON.stringify({ apiKey: 'local-secret', apiUrl: 'https://local/api' })
    );

    const service = newService();
    service.clearApiKey();

    // Global store cleared.
    expect(mockConf.delete).toHaveBeenCalledWith('apiKey');

    // Local file rewritten without the apiKey, preserving other fields.
    expect(mockedFs.writeFileSync).toHaveBeenCalledTimes(1);
    const writtenArgs = mockedFs.writeFileSync.mock.calls[0];
    const writtenJson = JSON.parse(writtenArgs[1] as string);
    expect(writtenJson).not.toHaveProperty('apiKey');
    expect(writtenJson.apiUrl).toBe('https://local/api');

    // And in-process getApiKey no longer returns the stale local key.
    expect(service.getApiKey()).toBeUndefined();
  });

  it('clearLocalApiKey is a no-op when the local file has no apiKey', () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(JSON.stringify({ apiUrl: 'https://local/api' }));

    const service = newService();
    service.clearLocalApiKey();

    expect(mockedFs.writeFileSync).not.toHaveBeenCalled();
  });

  it('clearLocalApiKey is a no-op when no local file exists', () => {
    mockedFs.existsSync.mockReturnValue(false);

    const service = newService();
    service.clearLocalApiKey();

    expect(mockedFs.writeFileSync).not.toHaveBeenCalled();
  });

  it('hasEnvApiKey reflects the OBS_API_KEY environment variable', () => {
    mockedFs.existsSync.mockReturnValue(false);
    const service = newService();

    expect(service.hasEnvApiKey()).toBe(false);

    process.env.OBS_API_KEY = 'env-secret';
    expect(service.hasEnvApiKey()).toBe(true);
  });

  it('warns to stderr when rewriting the local config during clearLocalApiKey fails, under OBS_VERBOSE', () => {
    process.env.OBS_VERBOSE = 'true';
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(JSON.stringify({ apiKey: 'local-secret' }));
    mockedFs.writeFileSync.mockImplementation(() => {
      throw new Error('disk full');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const service = newService();
    expect(() => service.clearLocalApiKey()).not.toThrow();

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('disk full'));
    errorSpy.mockRestore();
    delete process.env.OBS_VERBOSE;
  });

  it('env key still authenticates even after clearApiKey (logout must warn, not silently fail)', () => {
    mockedFs.existsSync.mockReturnValue(false);
    process.env.OBS_API_KEY = 'env-secret';

    const service = newService();
    service.clearApiKey();

    // The env var cannot be unset by a child process, so it keeps working.
    expect(service.getApiKey()).toBe('env-secret');
    expect(service.hasEnvApiKey()).toBe(true);
  });
});
