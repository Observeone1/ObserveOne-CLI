/**
 * SSE Client interface
 * Abstracts Server-Sent Events streaming
 */

export interface SSEMessage {
  type: string;
  data?: any;
  step?: any;
  status?: string;
  message?: string;
  screenshot?: string;
  timestamp?: string;
}

export interface ISSEClient {
  connect(
    taskId: string,
    onMessage: (message: SSEMessage) => void,
    onError: (error: any) => void
  ): void;
  close(): void;
}
