import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import { ConfigService } from '../../services/config.service.js';
import Conf from 'conf';
import { ObserveOneConfig } from '../../types/index.js';
import { createMockConf, MockConf } from './config-service-test-support.js';

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

/**
 * OBS_VERBOSE=true makes ConfigService announce which credential source won.
 * The source line is a support-diagnostic contract, so each precedence level
 * is asserted on the exact message the user sees.
 */
describe('ConfigService verbose credential-source reporting', () => {
  let mockConf: MockConf;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  const newService = () => new ConfigService(mockConf as unknown as Conf<ObserveOneConfig>);

  beforeEach(() => {
    delete process.env.OBS_API_KEY;
    delete process.env.OBS_API_URL;
    process.env.OBS_VERBOSE = 'true';
    mockConf = createMockConf();
    mockedFs.existsSync.mockReturnValue(false);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    delete process.env.OBS_VERBOSE;
    delete process.env.OBS_API_KEY;
    vi.restoreAllMocks();
  });

  it('reports the environment variable when no --api-key flag was given', () => {
    process.env.OBS_API_KEY = 'env-key';
    const service = newService();

    expect(service.getApiKey()).toBe('env-key');
    expect(errorSpy).toHaveBeenCalledWith(
      '  [Config] Using API key from Environment Variable (OBS_API_KEY)'
    );
  });

  it('reports the local config file when only a legacy local key exists', () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(JSON.stringify({ apiKey: 'local-key' }));
    const service = newService();

    expect(service.getApiKey()).toBe('local-key');
    expect(errorSpy).toHaveBeenCalledWith(
      '  [Config] Using API key from Local Config (.obs.config.json)'
    );
  });

  it('reports the global OS store when it is the only source', () => {
    mockConf.get.mockReturnValue('global-key');
    const service = newService();

    expect(service.getApiKey()).toBe('global-key');
    expect(errorSpy).toHaveBeenCalledWith('  [Config] Using API key from Global OS Store');
  });

  it('reports the runtime flag ahead of every persisted source', () => {
    process.env.OBS_API_KEY = 'env-key';
    mockConf.get.mockReturnValue('global-key');
    const service = newService();
    service.setCommandLineApiKey('flag-key');

    expect(service.getApiKey()).toBe('flag-key');
    expect(errorSpy).toHaveBeenCalledWith(
      '  [Config] Using API key from --api-key flag (session only)'
    );
  });

  it('logs, but does not throw, when clearing the local key hits a file error', () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(JSON.stringify({ apiKey: 'local-key' }));
    const service = newService();
    mockedFs.writeFileSync.mockImplementation(() => {
      throw new Error('EACCES: permission denied');
    });

    expect(() => service.clearLocalApiKey()).not.toThrow();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to clear API key from local config: EACCES')
    );
  });
});
