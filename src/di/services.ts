import { Container } from "./container.js";
import {
  CONFIG_SERVICE,
  OUTPUT_SERVICE,
  API_CLIENT,
  SSE_CLIENT,
  FILE_SYSTEM,
  PROCESS,
} from "./service-tokens.js";

// Services
import { ConfigService } from "../services/config.service.js";
import { OutputService } from "../services/output.service.js";
import { ApiClient } from "../services/api-client.service.js";
import { SSEClient } from "../services/sse-client.service.js";
import { FileSystemService } from "../services/file-system.service.js";
import { ProcessService } from "../services/process.service.js";

// Interfaces
import { IConfigService } from "../interfaces/config.interface.js";
import { IOutputService } from "../interfaces/output.interface.js";
import { IApiClient } from "../interfaces/api-client.interface.js";
import { ISSEClient } from "../interfaces/sse-client.interface.js";
import { IFileSystem } from "../interfaces/file-system.interface.js";
import { IProcessService } from "../interfaces/process.interface.js";

/**
 * Register all services with the DI container
 * Sets up the dependency graph
 */
export function registerServices(container: Container): void {
  // Register infrastructure services (no dependencies)
  container.register<IFileSystem>(
    FILE_SYSTEM,
    () => new FileSystemService(),
    "singleton"
  );

  container.register<IProcessService>(
    PROCESS,
    () => new ProcessService(),
    "singleton"
  );

  // Register config service (no dependencies)
  container.register<IConfigService>(
    CONFIG_SERVICE,
    () => new ConfigService(),
    "singleton"
  );

  // Register output service (no dependencies)
  container.register<IOutputService>(
    OUTPUT_SERVICE,
    () => new OutputService(),
    "singleton"
  );

  // Register API client (depends on config service)
  container.register<IApiClient>(
    API_CLIENT,
    (c) => new ApiClient(c.resolve<IConfigService>(CONFIG_SERVICE)),
    "singleton"
  );

  // Register SSE client (depends on config service)
  // Note: SSE client is transient because each connection is unique
  container.register<ISSEClient>(
    SSE_CLIENT,
    (c) => new SSEClient(c.resolve<IConfigService>(CONFIG_SERVICE)),
    "transient"
  );
}

/**
 * Create and configure a production container
 */
export function createContainer(): Container {
  const container = new Container();
  registerServices(container);
  return container;
}
