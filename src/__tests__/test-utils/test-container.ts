import { Container } from "../../di/container.js";
import {
  CONFIG_SERVICE,
  OUTPUT_SERVICE,
  API_CLIENT,
  SSE_CLIENT,
  FILE_SYSTEM,
  PROCESS,
} from "../../di/service-tokens.js";

import { createConfigStub } from "../stubs/config.stub.js";
import { createOutputStub } from "../stubs/output.stub.js";
import { createApiClientStub } from "../stubs/api-client.stub.js";
import { createSSEClientStub } from "../stubs/sse-client.stub.js";
import { createFileSystemStub } from "../stubs/file-system.stub.js";
import { createProcessStub } from "../stubs/process.stub.js";

/**
 * Create a test container with all stubs registered
 */
export function createTestContainer(overrides?: Map<symbol, any>): Container {
  const container = new Container();

  // Register stub services with proper factory functions
  container.register(CONFIG_SERVICE, () => createConfigStub(), "singleton");
  container.register(OUTPUT_SERVICE, () => createOutputStub(), "singleton");
  container.register(API_CLIENT, () => createApiClientStub(), "singleton");
  container.register(SSE_CLIENT, () => createSSEClientStub(), "transient");
  container.register(FILE_SYSTEM, () => createFileSystemStub(), "singleton");
  container.register(PROCESS, () => createProcessStub(), "singleton");

  // Apply overrides
  if (overrides) {
    overrides.forEach((factory, token) => {
      container.register(token, factory, "singleton");
    });
  }

  return container;
}
