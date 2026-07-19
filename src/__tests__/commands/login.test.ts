import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { openAuthUrlBestEffort, pollForAuth } from '../../commands/login.js';
import { IConfigService } from '../../interfaces/config.interface.js';
import { IApiClient } from '../../interfaces/api-client.interface.js';
import { IOutputService } from '../../interfaces/output.interface.js';

const openMock = vi.hoisted(() => vi.fn());
vi.mock('open', () => ({ default: openMock }));

function stubOutputService(): IOutputService {
  return {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    progress: vi.fn(),
    enableJsonMode: vi.fn(),
    formatJsonOutput: vi.fn(),
    formatError: vi.fn((e: unknown) => (e instanceof Error ? e.message : String(e))),
  } as unknown as IOutputService;
}

function stubConfigService(): IConfigService {
  return {
    getApiKey: vi.fn().mockReturnValue(undefined),
    setApiKey: vi.fn(),
    getApiUrl: vi.fn().mockReturnValue('https://api.observeone.com/api'),
    setApiUrl: vi.fn(),
    setCommandLineApiKey: vi.fn(),
    setCommandLineApiUrl: vi.fn(),
    clearApiKey: vi.fn(),
  } as unknown as IConfigService;
}

/** process.exit throws instead of killing the test process; tests assert on the thrown marker. */
function mockProcessExit() {
  return vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw new Error(`process.exit(${code ?? 0})`);
  }) as never);
}

describe('openAuthUrlBestEffort (S2486: browser-open failure handling)', () => {
  beforeEach(() => {
    openMock.mockReset();
  });

  afterEach(() => {
    delete process.env.OBS_VERBOSE;
  });

  it('warns to stderr under OBS_VERBOSE when the browser fails to open', async () => {
    process.env.OBS_VERBOSE = 'true';
    openMock.mockRejectedValue(new Error('no display available'));
    const outputService = stubOutputService();

    await expect(openAuthUrlBestEffort(outputService, 'https://x/auth')).resolves.toBeUndefined();

    expect(openMock).toHaveBeenCalledWith('https://x/auth');
    expect(outputService.warning).toHaveBeenCalledWith(
      expect.stringContaining('no display available')
    );
  });

  it('stays silent when OBS_VERBOSE is unset (does not throw or block the caller)', async () => {
    delete process.env.OBS_VERBOSE;
    openMock.mockRejectedValue(new Error('no display available'));
    const outputService = stubOutputService();

    await expect(openAuthUrlBestEffort(outputService, 'https://x/auth')).resolves.toBeUndefined();

    expect(outputService.warning).not.toHaveBeenCalled();
  });
});

describe('pollForAuth (S2486: auth-status poll failure handling)', () => {
  let exitSpy: ReturnType<typeof mockProcessExit>;

  beforeEach(() => {
    exitSpy = mockProcessExit();
  });

  afterEach(() => {
    exitSpy.mockRestore();
    delete process.env.OBS_VERBOSE;
    vi.useRealTimers();
  });

  it('logs each failed status check under OBS_VERBOSE and keeps retrying until it succeeds', async () => {
    process.env.OBS_VERBOSE = 'true';
    vi.useFakeTimers();

    const outputService = stubOutputService();
    const configService = stubConfigService();
    const checkCliAuthStatus = vi
      .fn()
      .mockRejectedValueOnce(new Error('request not found yet'))
      .mockResolvedValueOnce({ status: 'approved', api_key: 'new-key' });
    const apiClient = { checkCliAuthStatus, setApiKey: vi.fn() } as unknown as IApiClient;

    const runPromise = expect(
      pollForAuth(configService, apiClient, outputService, 'r1')
    ).rejects.toThrow('process.exit(0)');

    // First attempt rejects immediately; advance past its retry delay for the second attempt.
    await vi.advanceTimersByTimeAsync(5000);
    await runPromise;

    expect(outputService.warning).toHaveBeenCalledWith(
      expect.stringContaining('request not found yet')
    );
    expect(checkCliAuthStatus).toHaveBeenCalledTimes(2);
    expect(configService.setApiKey).toHaveBeenCalledWith('new-key');
  });

  it('stays silent about a failed status check when OBS_VERBOSE is unset', async () => {
    delete process.env.OBS_VERBOSE;
    vi.useFakeTimers();

    const outputService = stubOutputService();
    const configService = stubConfigService();
    const checkCliAuthStatus = vi
      .fn()
      .mockRejectedValueOnce(new Error('request not found yet'))
      .mockResolvedValueOnce({ status: 'approved', api_key: 'new-key' });
    const apiClient = { checkCliAuthStatus, setApiKey: vi.fn() } as unknown as IApiClient;

    const runPromise = expect(
      pollForAuth(configService, apiClient, outputService, 'r1')
    ).rejects.toThrow('process.exit(0)');

    await vi.advanceTimersByTimeAsync(5000);
    await runPromise;

    expect(outputService.warning).not.toHaveBeenCalled();
  });

  it('denies immediately without retrying when the backend reports "denied"', async () => {
    const outputService = stubOutputService();
    const configService = stubConfigService();
    const apiClient = {
      checkCliAuthStatus: vi.fn().mockResolvedValue({ status: 'denied' }),
      setApiKey: vi.fn(),
    } as unknown as IApiClient;

    await expect(pollForAuth(configService, apiClient, outputService, 'r1')).rejects.toThrow(
      'process.exit(1)'
    );

    expect(outputService.error).toHaveBeenCalledWith('Authentication denied by user.');
  });
});
