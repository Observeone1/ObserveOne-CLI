import {
  ISSEClient,
  SSEMessage,
} from "../../interfaces/sse-client.interface.js";

/**
 * Create a stub implementation of ISSEClient for testing
 */
export function createSSEClientStub(
  overrides?: Partial<ISSEClient>
): ISSEClient {
  return {
    connect: () => {},
    close: () => {},
    ...overrides,
  };
}
