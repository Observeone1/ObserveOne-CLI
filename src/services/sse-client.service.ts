import { IConfigService } from '../interfaces/config.interface.js';
import { ISSEClient, SSEMessage } from '../interfaces/sse-client.interface.js';
import { isAllowedHost } from '../utils/host-allowlist.js';

/**
 * SSE Client implementation
 * Handles Server-Sent Events streaming
 */
/** Default idle timeout: abort a stream that sends no data for 2 minutes. */
const DEFAULT_IDLE_TIMEOUT_MS = 120_000;

export class SSEClient implements ISSEClient {
  private abortController: AbortController | null = null;
  private isConnected = false;
  private configService: IConfigService;
  private idleTimeoutMs: number;

  /**
   * @param idleTimeoutMs Max time to wait on a single `reader.read()` with no
   *   server data before failing via `onError`. Pass `0` to disable.
   */
  constructor(configService: IConfigService, idleTimeoutMs: number = DEFAULT_IDLE_TIMEOUT_MS) {
    this.configService = configService;
    this.idleTimeoutMs = idleTimeoutMs;
  }

  connect(
    taskId: string,
    onMessage: (message: SSEMessage) => void,
    onError: (error: unknown) => void
  ): void {
    const apiUrl = this.configService.getApiUrl();
    const apiKey = this.configService.getApiKey();

    if (!apiKey) {
      throw new Error(
        "Cannot connect to SSE stream: No API key found. Please run 'obs login' first."
      );
    }

    const url = `${apiUrl}/browser-checks/events/${taskId}`;

    this.abortController = new AbortController();
    this.isConnected = true;

    // Start the stream processing in the background (don't await)
    this.processStream(url, apiKey as string, onMessage, onError);
  }

  private async processStream(
    url: string,
    apiKey: string,
    onMessage: (message: SSEMessage) => void,
    onError: (error: unknown) => void
  ): Promise<void> {
    try {
      const headers: Record<string, string> = { Accept: 'text/event-stream' };
      // Never leak the token to a non-ObserveOne host (base URL is overridable).
      if (isAllowedHost(url)) {
        headers['x-obs1-cli'] = apiKey;
      } else {
        let host = url;
        try {
          host = new URL(url).host;
        } catch {
          // keep raw value
        }
        console.error(
          `warn: destination host "${host}" is not allowlisted — sending without credentials`
        );
      }

      const response = await fetch(url, {
        headers,
        signal: this.abortController!.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (this.isConnected) {
        const { done, value } = await this.readWithIdleTimeout(reader);

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data:')) {
            const data = line.slice(5).trim();
            if (data) {
              // Parse and consume separately: a JSON failure is a parse error,
              // but a throw from the consumer (onMessage) must surface via
              // onError, not be mislabeled "Failed to parse SSE message".
              let parsed: SSEMessage;
              try {
                parsed = JSON.parse(data) as SSEMessage;
              } catch (error) {
                console.error('Failed to parse SSE message:', error);
                continue;
              }
              onMessage(parsed);
            }
          }
        }
      }
    } catch (error: unknown) {
      const err = error as { name?: string };
      if (err.name !== 'AbortError') {
        onError(error);
      }
    }
  }

  /**
   * Reads the next chunk, racing it against an optional idle timeout so a
   * silent server can't block the stream forever. The timer is cleared after
   * every read, so a normally-flowing stream is unaffected. Disabled when
   * `idleTimeoutMs` is 0.
   */
  private async readWithIdleTimeout(
    reader: ReadableStreamDefaultReader<Uint8Array>
  ): Promise<Awaited<ReturnType<ReadableStreamDefaultReader<Uint8Array>['read']>>> {
    if (!this.idleTimeoutMs) {
      return reader.read();
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`SSE stream idle timeout after ${this.idleTimeoutMs}ms`)),
        this.idleTimeoutMs
      );
    });

    try {
      return await Promise.race([reader.read(), timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  close(): void {
    this.isConnected = false;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}
