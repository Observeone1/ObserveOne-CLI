import { describe, it, expect, vi, afterEach } from 'vitest';
import { requireConfirmation, requireTTY } from '../../utils/confirm.js';

vi.mock('inquirer', () => ({ default: { prompt: vi.fn() } }));
import inquirer from 'inquirer';
const promptMock = inquirer.prompt as unknown as ReturnType<typeof vi.fn>;

// Guard helpers must never block on an interactive prompt in a non-TTY/CI
// pipe — they must fail fast (exit non-zero) with a clear message instead.

describe('requireTTY', () => {
  const originalIsTTY = process.stdin.isTTY;

  afterEach(() => {
    Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, configurable: true });
    vi.restoreAllMocks();
  });

  it('reports the error and exits non-zero when not a TTY', () => {
    Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
    const outputError = vi.fn();
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);

    expect(() => requireTTY(outputError)).toThrow('exit:1');
    expect(outputError).toHaveBeenCalledOnce();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('does nothing when a TTY is attached', () => {
    Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
    const outputError = vi.fn();
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    requireTTY(outputError);
    expect(outputError).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });
});

describe('requireConfirmation', () => {
  const originalIsTTY = process.stdin.isTTY;

  afterEach(() => {
    Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, configurable: true });
    vi.restoreAllMocks();
  });

  it('returns true immediately when --yes is passed (no prompt, no exit)', async () => {
    const outputError = vi.fn();
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    const result = await requireConfirmation('proceed?', { yes: true, outputError });

    expect(result).toBe(true);
    expect(outputError).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('errors and exits in non-TTY mode without --yes (does not hang)', async () => {
    Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
    const outputError = vi.fn();
    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);

    // The thrown (mocked) exit halts execution before reaching the interactive
    // prompt — proving the non-TTY path never blocks.
    await expect(requireConfirmation('proceed?', { outputError })).rejects.toThrow('exit:1');
    expect(outputError).toHaveBeenCalledOnce();
  });

  it('errors and exits in JSON mode without --yes', async () => {
    Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
    const outputError = vi.fn();
    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);

    await expect(requireConfirmation('proceed?', { isJson: true, outputError })).rejects.toThrow(
      'exit:1'
    );
    expect(outputError).toHaveBeenCalledOnce();
  });

  it('prompts interactively in TTY mode and returns the answer', async () => {
    Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
    promptMock.mockReset();
    promptMock.mockResolvedValue({ confirm: true });
    const outputError = vi.fn();

    const result = await requireConfirmation('proceed?', { outputError });

    expect(result).toBe(true);
    expect(promptMock).toHaveBeenCalledWith([
      expect.objectContaining({ type: 'confirm', name: 'confirm', message: 'proceed?' }),
    ]);
    expect(outputError).not.toHaveBeenCalled();
  });

  it('returns false when the user declines the interactive prompt', async () => {
    Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
    promptMock.mockReset();
    promptMock.mockResolvedValue({ confirm: false });

    const result = await requireConfirmation('proceed?', { outputError: vi.fn() });

    expect(result).toBe(false);
  });
});
