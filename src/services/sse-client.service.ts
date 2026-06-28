import { IConfigService } from '../interfaces/config.interface.js';
import { ISSEClient, SSEMessage } from '../interfaces/sse-client.interface.js';
import { isAllowedHost } from '../utils/host-allowlist.js';

/**
 * SSE Client implementation
 * Handles Server-Sent Events streaming
 */
export class SSEClient implements ISSEClient {
  private abortController: AbortController | null = null;
  private isConnected = false;
  private configService: IConfigService;

  constructor(configService: IConfigService) {
    this.configService = configService;
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
        const { done, value } = await reader.read();

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
              try {
                const parsed = JSON.parse(data) as SSEMessage;
                onMessage(parsed);
              } catch (error) {
                console.error('Failed to parse SSE message:', error);
              }
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

  close(): void {
    this.isConnected = false;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}
