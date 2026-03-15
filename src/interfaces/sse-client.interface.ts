/**
 * SSE Client interface
 * Abstracts Server-Sent Events streaming
 */

export interface SSEMessage {
  type: string;
  data?: unknown;
  step?: unknown;
  status?: string;
  message?: string;
  screenshot?: string;
  timestamp?: string;
}

export interface ISSEClient {
  connect(
    taskId: string,
    onMessage: (message: SSEMessage) => void,
    onError: (error: unknown) => void
  ): void;
  close(): void;
}
