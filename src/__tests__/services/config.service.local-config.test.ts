import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fs from 'node:fs';
import { ConfigService } from '../../services/config.service.js';
import Conf from 'conf';
import { ObserveOneConfig } from '../../types/index.js';
import { createMockConf, MockConf } from './config-service-test-support.js';

// Mock only the fs functions ConfigService uses so these tests never touch the
// real .obs.config.json in cwd, mirroring the pattern in
// config.service.logout.test.ts.
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

describe('ConfigService local .obs.config.json handling', () => {
  let mockConf: MockConf;

  beforeEach(() => {
    delete process.env.OBS_API_KEY;
    delete process.env.OBS_API_URL;
    delete process.env.NODE_ENV;
    mockConf = createMockConf();
    mockedFs.existsSync.mockReset();
    mockedFs.readFileSync.mockReset();
    mockedFs.writeFileSync.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const newService = () => new ConfigService(mockConf as unknown as Conf<ObserveOneConfig>);

  it('a local apiUrl takes priority over the saved global config', () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(JSON.stringify({ apiUrl: 'https://local.example/api' }));
    mockConf.get.mockImplementation((key: string) =>
      key === 'apiUrl' ? 'https://global.example/api' : undefined
    );

    const service = newService();
    expect(service.getApiUrl()).toBe('https://local.example/api');
  });

  it('a local defaultOptions field overrides the global value, field by field', () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(
      JSON.stringify({ defaultOptions: { timeout: 111, verbose: true } })
    );
    mockConf.get.mockImplementation((key: string) =>
      key === 'defaultOptions'
        ? { timeout: 999, retries: 9, verbose: false, pollIntervalMs: 999, maxAttempts: 999 }
        : undefined
    );

    const service = newService();
    expect(service.getDefaultOptions()).toEqual({
      timeout: 111, // local wins
      retries: 9, // falls back to global
      verbose: true, // local wins
      pollIntervalMs: 999, // falls back to global
      maxAttempts: 999, // falls back to global
    });
  });

  it('a local project config is merged over (and can extend) the global project config', () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(
      JSON.stringify({ project: { description: 'local description' } })
    );
    mockConf.get.mockImplementation((key: string) =>
      key === 'project' ? { name: 'global-name', description: 'global description' } : undefined
    );

    const service = newService();
    expect(service.getProjectConfig()).toEqual({
      name: 'global-name',
      description: 'local description',
    });
  });

  it('silently ignores a corrupt (non-JSON) local config file instead of throwing', () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue('{ this is not valid JSON');

    expect(() => newService()).not.toThrow();

    const service = newService();
    mockConf.get.mockReturnValue(undefined);
    // Falls back to global/default resolution since the local file failed to parse.
    expect(service.getApiUrl()).toBe('https://api.observeone.com/api');
  });

  it('treats a missing local config file the same as an empty one', () => {
    mockedFs.existsSync.mockReturnValue(false);

    const service = newService();
    expect(service.getProjectConfig()).toEqual({});
    expect(mockedFs.readFileSync).not.toHaveBeenCalled();
  });
});
