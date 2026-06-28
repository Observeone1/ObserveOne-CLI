import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SSEClient } from '../../services/sse-client.service.js';
import { IConfigService } from '../../interfaces/config.interface.js';
import { SSEMessage } from '../../interfaces/sse-client.interface.js';

/**
 * Builds a mock ReadableStream reader that yields the given string chunks (one
 * per `read()`), then reports `done`.
 */
function makeReader(chunks: string[]) {
  const encoder = new TextEncoder();
  let i = 0;
  return {
    read: vi.fn().mockImplementation(async () => {
      if (i < chunks.length) {
        return { done: false, value: encoder.encode(chunks[i++]) };
      }
      return { done: true, value: undefined };
    }),
  };
}

/**
 * Drives the (private) processStream directly. `connect()` normally sets
 * `isConnected` and `abortController`; we set them by hand so the read loop
 * actually runs and `fetch` is reached.
 */
async function runStream(
  client: SSEClient,
  reader: { read: ReturnType<typeof vi.fn> },
  onMessage: (m: SSEMessage) => void,
  onError: (e: unknown) => void
): Promise<void> {
  const internals = client as unknown as {
    isConnected: boolean;
    abortController: AbortController;
    processStream: (
      url: string,
      apiKey: string,
      onMessage: (m: SSEMessage) => void,
      onError: (e: unknown) => void
    ) => Promise<void>;
  };
  internals.isConnected = true;
  internals.abortController = new AbortController();

  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      body: { getReader: () => reader },
    })
  );

  // Loopback host is allowlisted, so no "not allowlisted" warning pollutes
  // console.error during the test.
  await internals.processStream('http://localhost/stream', 'test-key', onMessage, onError);
}

describe('SSEClient.processStream', () => {
  let configService: IConfigService;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    configService = {
      getApiUrl: vi.fn().mockReturnValue('http://localhost/api'),
      getApiKey: vi.fn().mockReturnValue('test-key'),
    } as unknown as IConfigService;
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('logs a parse error for malformed data but does NOT call onError', async () => {
    // idle timeout disabled (0) so it cannot fire during the test.
    const client = new SSEClient(configService, 0);
    const reader = makeReader(['data: not-json\n']);
    const onMessage = vi.fn();
    const onError = vi.fn();

    await runStream(client, reader, onMessage, onError);

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to parse SSE message:', expect.anything());
    expect(onMessage).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('surfaces a consumer (onMessage) throw via onError, not as a parse error', async () => {
    const client = new SSEClient(configService, 0);
    const reader = makeReader(['data: {"type":"step"}\n']);
    const consumerError = new Error('consumer blew up');
    const onMessage = vi.fn().mockImplementation(() => {
      throw consumerError;
    });
    const onError = vi.fn();

    await runStream(client, reader, onMessage, onError);

    expect(onMessage).toHaveBeenCalledWith({ type: 'step' });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(consumerError);
    // The consumer error must NOT be mislabeled as a parse failure.
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      'Failed to parse SSE message:',
      expect.anything()
    );
  });
});
