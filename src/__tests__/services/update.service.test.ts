import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { UpdateService } from '../../services/update.service.js';
import { IOutputService } from '../../interfaces/output.interface.js';

vi.mock('axios', () => ({
  default: { get: vi.fn() },
}));
import axios from 'axios';
const axiosGetMock = axios.get as unknown as ReturnType<typeof vi.fn>;

const stubOutput = () => ({}) as unknown as IOutputService;

function loggedLines(): string {
  return (console.log as Mock).mock.calls.map((call) => String(call[0])).join('\n');
}

describe('UpdateService.checkForUpdates', () => {
  const originalEnv = { ...process.env };
  const originalArgv = process.argv;

  beforeEach(() => {
    axiosGetMock.mockReset();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    process.env = { ...originalEnv };
    delete process.env.OBS_JSON_OUTPUT;
    delete process.env.OBS_SKIP_UPDATE_CHECK;
    delete process.env.npm_config_user_agent;
    delete process.env.npm_execpath;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = originalEnv;
    process.argv = originalArgv;
  });

  it('skips the network check entirely when OBS_JSON_OUTPUT=true', async () => {
    process.env.OBS_JSON_OUTPUT = 'true';
    const service = new UpdateService('1.0.0');
    await service.checkForUpdates(stubOutput());
    expect(axiosGetMock).not.toHaveBeenCalled();
  });

  it('skips the network check entirely when OBS_SKIP_UPDATE_CHECK=true', async () => {
    process.env.OBS_SKIP_UPDATE_CHECK = 'true';
    const service = new UpdateService('1.0.0');
    await service.checkForUpdates(stubOutput());
    expect(axiosGetMock).not.toHaveBeenCalled();
  });

  it('prints an update banner with the update command when a newer version exists', async () => {
    process.env.npm_config_user_agent = 'pnpm/8.0.0 node/v20';
    axiosGetMock.mockResolvedValue({ data: { version: '2.0.0' } });

    const service = new UpdateService('1.0.0');
    await service.checkForUpdates(stubOutput());

    expect(axiosGetMock).toHaveBeenCalledWith(
      'https://registry.npmjs.org/@observeone/cli/latest',
      expect.objectContaining({ timeout: 2000 })
    );
    const out = loggedLines();
    expect(out).toContain('Update available');
    expect(out).toContain('1.0.0');
    expect(out).toContain('2.0.0');
    expect(out).toContain('pnpm add -g @observeone/cli');
  });

  it('uses the npm update command when npm_config_user_agent identifies npm', async () => {
    process.env.npm_config_user_agent = 'npm/10.0.0 node/v20';
    axiosGetMock.mockResolvedValue({ data: { version: '2.0.0' } });
    const service = new UpdateService('1.0.0');
    await service.checkForUpdates(stubOutput());
    expect(loggedLines()).toContain('npm install -g @observeone/cli');
  });

  it('uses the yarn update command when npm_config_user_agent identifies yarn', async () => {
    process.env.npm_config_user_agent = 'yarn/1.22.0 node/v20';
    axiosGetMock.mockResolvedValue({ data: { version: '2.0.0' } });
    const service = new UpdateService('1.0.0');
    await service.checkForUpdates(stubOutput());
    expect(loggedLines()).toContain('yarn global add @observeone/cli');
  });

  it('uses the bun update command when npm_config_user_agent identifies bun', async () => {
    process.env.npm_config_user_agent = 'bun/1.0.0';
    axiosGetMock.mockResolvedValue({ data: { version: '2.0.0' } });
    const service = new UpdateService('1.0.0');
    await service.checkForUpdates(stubOutput());
    expect(loggedLines()).toContain('bun add -g @observeone/cli');
  });

  it('does not print a banner when already on the latest version', async () => {
    axiosGetMock.mockResolvedValue({ data: { version: '1.0.0' } });
    const service = new UpdateService('1.0.0');
    await service.checkForUpdates(stubOutput());
    expect(console.log).not.toHaveBeenCalled();
  });

  it('does not print a banner when running a newer version than the registry', async () => {
    axiosGetMock.mockResolvedValue({ data: { version: '1.0.0' } });
    const service = new UpdateService('1.5.0');
    await service.checkForUpdates(stubOutput());
    expect(console.log).not.toHaveBeenCalled();
  });

  it('silently swallows a failed registry request', async () => {
    axiosGetMock.mockRejectedValue(new Error('network down'));
    const service = new UpdateService('1.0.0');
    await expect(service.checkForUpdates(stubOutput())).resolves.toBeUndefined();
    expect(console.log).not.toHaveBeenCalled();
  });

  // Package-manager detection fallbacks: when npm_config_user_agent is absent,
  // detectPackageManager falls back to npm_execpath, then to argv inspection,
  // then defaults to npm.
  it('falls back to npm_execpath (pnpm) when the user agent is unset', async () => {
    process.env.npm_execpath = '/home/u/Library/pnpm/store/pnpm.cjs';
    axiosGetMock.mockResolvedValue({ data: { version: '2.0.0' } });
    const service = new UpdateService('1.0.0');
    await service.checkForUpdates(stubOutput());
    expect(loggedLines()).toContain('pnpm add -g @observeone/cli');
  });

  it('falls back to npm_execpath (yarn) when the user agent is unset', async () => {
    process.env.npm_execpath = '/usr/local/bin/yarn.js';
    axiosGetMock.mockResolvedValue({ data: { version: '2.0.0' } });
    const service = new UpdateService('1.0.0');
    await service.checkForUpdates(stubOutput());
    expect(loggedLines()).toContain('yarn global add @observeone/cli');
  });

  it('falls back to npm_execpath (bun) when the user agent is unset', async () => {
    process.env.npm_execpath = '/usr/local/bin/bun';
    axiosGetMock.mockResolvedValue({ data: { version: '2.0.0' } });
    const service = new UpdateService('1.0.0');
    await service.checkForUpdates(stubOutput());
    expect(loggedLines()).toContain('bun add -g @observeone/cli');
  });

  it('falls back to argv inspection when neither user agent nor execpath match', async () => {
    process.argv = ['/usr/bin/node', '/home/u/.pnpm/@observeone/cli/bin/obs.js'];
    axiosGetMock.mockResolvedValue({ data: { version: '2.0.0' } });
    const service = new UpdateService('1.0.0');
    await service.checkForUpdates(stubOutput());
    expect(loggedLines()).toContain('pnpm add -g @observeone/cli');
  });

  it('defaults to npm when no package manager can be detected', async () => {
    process.argv = ['/usr/bin/node', '/tmp/standalone-script.js'];
    axiosGetMock.mockResolvedValue({ data: { version: '2.0.0' } });
    const service = new UpdateService('1.0.0');
    await service.checkForUpdates(stubOutput());
    expect(loggedLines()).toContain('npm install -g @observeone/cli');
  });
});
