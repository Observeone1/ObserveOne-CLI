# Dependency Injection Refactor

**Date:** 2025-12-01  
**Author:** ObserveOne Team  
**Status:** In Progress

## Table of Contents

- [Overview](#overview)
- [Motivation](#motivation)
- [Architecture Changes](#architecture-changes)
- [Migration Guide](#migration-guide)
- [Testing Guide](#testing-guide)
- [Examples](#examples)
- [FAQ](#faq)

## Overview

This document describes the architectural refactor that introduced dependency injection (DI) throughout the ObserveOne CLI codebase. The refactor transforms the CLI from a tightly coupled architecture using static classes to a loosely coupled system with constructor-based dependency injection.

**Key Changes:**

- Custom lightweight DI container implementation
- All services converted from static classes to injectable instances
- All commands refactored to use factory functions
- Comprehensive test infrastructure with stubs instead of mocks

## Motivation

### Problems with Previous Architecture

1. **Static Classes Everywhere**

   ```typescript
   // Hard to test - requires heavy mocking
   ConfigManager.getApiKey();
   OutputFormatter.success("Done!");
   ```

2. **Direct Instantiation in Commands**

   ```typescript
   const apiClient = new ApiClient();  // Hardcoded dependency
   ```

3. **Global State**
   - `ConfigManager` used global `Conf` instance
   - Made parallel testing difficult
   - Hard to isolate tests

4. **Heavy Mocking Required**

   ```typescript
   vi.mock('axios', async () => { /* 50 lines of setup */ });
   vi.mock('../utils/config.js', () => { /* more setup */ });
   ```

### Benefits of DI Architecture

1. **Easy Testing**
   - Simple stubs instead of complex mocks
   - No module mocking needed
   - Faster test execution

2. **Loose Coupling**
   - Services depend on interfaces, not concrete implementations
   - Easy to swap implementations

3. **Better Testability**
   - Each component can be tested in isolation
   - Dependencies are explicit and visible

4. **Maintainability**
   - Clear dependency graph
   - Easier to understand component relationships

## Architecture Changes

### DI Container

Location: `src/di/container.ts`

A lightweight container supporting:

- **Singleton** lifetime (one instance per container)
- **Transient** lifetime (new instance per resolution)
- Circular dependency detection
- Type-safe service resolution

```typescript
const container = new Container();
container.register(CONFIG_SERVICE, () => new ConfigService(), 'singleton');
const config = container.resolve<IConfigService>(CONFIG_SERVICE);
```

### Service Tokens

Location: `src/di/service-tokens.ts`

Unique symbols identifying each service:

```typescript
export const CONFIG_SERVICE = Symbol('CONFIG_SERVICE');
export const OUTPUT_SERVICE = Symbol('OUTPUT_SERVICE');
export const API_CLIENT = Symbol('API_CLIENT');
export const SSE_CLIENT = Symbol('SSE_CLIENT');
export const FILE_SYSTEM = Symbol('FILE_SYSTEM');
export const PROCESS = Symbol('PROCESS');
```

### Service Interfaces

All services now have corresponding interfaces in `src/interfaces/`:

| Service | Interface | Purpose |
|---------|-----------|---------|
| ConfigService | IConfigService | Configuration management |
| OutputService | IOutputService | Console output formatting |
| ApiClient | IApiClient | HTTP API communication |
| SSEClient | ISSEClient | Server-sent events |
| FileSystemService | IFileSystem | File operations |
| ProcessService | IProcessService | Process operations |

### Service Implementations

#### ConfigService (`src/services/config.service.ts`)

**Before:**

```typescript
class ConfigManager {
  static getApiKey() { /* ... */ }
  static setApiKey(key: string) { /* ... */ }
}
```

**After:**

```typescript
class ConfigService implements IConfigService {
  constructor(private config: Conf<ObserveOneConfig>) {}
  
  getApiKey(): string | undefined {
    return this.config.get("apiKey");
  }
  
  setApiKey(key: string): void {
    this.config.set("apiKey", key);
  }
}
```

**Key Change:** `Conf` instance is injected via constructor, enabling easy testing.

#### ApiClient (`src/services/api-client.service.ts`)

**Before:**

```typescript
class ApiClient {
  constructor() {
    this.apiKey = ConfigManager.getApiKey();  // Tight coupling
  }
}
```

**After:**

```typescript
class ApiClient implements IApiClient {
  constructor(private configService: IConfigService) {
    this.apiKey = configService.getApiKey();  // Injected dependency
  }
}
```

### Command Factory Pattern

All commands changed from direct exports to factory functions:

**Before:**

```typescript
export const listCommand = new Command("list")
  .action(async () => {
    const apiClient = new ApiClient();  // Direct instantiation
    // ...
  });
```

**After:**

```typescript
export function createListCommand(container: Container): Command {
  const configService = container.resolve<IConfigService>(CONFIG_SERVICE);
  const apiClient = container.resolve<IApiClient>(API_CLIENT);
  
  return new Command("list")
    .action(async () => {
      // Use injected dependencies
    });
}
```

### Application Bootstrap

`src/index.ts` now bootstraps the DI container:

```typescript
import { createContainer } from './di/services.js';

const container = createContainer();

program.addCommand(createLoginCommand(container));
program.addCommand(createListCommand(container));
program.addCommand(createAiCheckCommand(container));
```

## Migration Guide

### For Adding New Services

1. **Create Interface**

   ```typescript
   // src/interfaces/my-service.interface.ts
   export interface IMyService {
     doSomething(): void;
   }
   ```

2. **Create Implementation**

   ```typescript
   // src/services/my-service.service.ts
   export class MyService implements IMyService {
     constructor(private dependency: ISomeDependency) {}
     
     doSomething(): void {
       this.dependency.doWork();
     }
   }
   ```

3. **Create Service Token**

   ```typescript
   // src/di/service-tokens.ts
   export const MY_SERVICE = Symbol('MY_SERVICE');
   ```

4. **Register in Container**

   ```typescript
   // src/di/services.ts
   container.register<IMyService>(
     MY_SERVICE,
     (c) => new MyService(c.resolve<ISomeDependency>(DEPENDENCY)),
     'singleton'
   );
   ```

### For Creating New Commands

1. **Use Factory Function**

   ```typescript
   export function createMyCommand(container: Container): Command {
     const service = container.resolve<IMyService>(MY_SERVICE);
     
     return new Command("my-command")
       .action(async () => {
         await service.doSomething();
       });
   }
   ```

2. **Add to index.ts**

   ```typescript
   program.addCommand(createMyCommand(container));
   ```

### For Modifying Existing Services

1. **Update Interface** if adding new methods
2. **Update Implementation** with new logic
3. **Update Stubs** for testing (if interface changed)

## Testing Guide

### Creating Test Stubs

Create simple stub implementations in `src/__tests__/stubs/`:

```typescript
// my-service.stub.ts
export function createMyServiceStub(
  overrides?: Partial<IMyService>
): IMyService {
  return {
    doSomething: () => {},
    ...overrides,
  };
}
```

### Using Test Container

```typescript
import { createTestContainer } from '../test-utils/test-container.js';

describe('MyCommand', () => {
  it('should work', () => {
    // Create container with all stubs
    const container = createTestContainer();
    
    // Create command
    const command = createMyCommand(container);
    
    // Test command logic
  });
});
```

### Customizing Stubs

```typescript
const container = createTestContainer(
  new Map([
    [API_CLIENT, () => createApiClientStub({
      getTests: async () => [mockTest1, mockTest2]
    })]
  ])
);
```

### Testing Services Directly

```typescript
import { ConfigService } from '../services/config.service.js';

it('should set API key', () => {
  const mockConf = new Conf({ /* test config */ });
  const configService = new ConfigService(mockConf);
  
  configService.setApiKey('test-key');
  expect(configService.getApiKey()).toBe('test-key');
});
```

## Examples

### Example 1: Adding a New Service

Let's add a `LogService` for structured logging:

```typescript
// 1. Interface
export interface ILogService {
  debug(message: string): void;
  info(message: string): void;
  error(message: string, error?: Error): void;
}

// 2. Implementation
export class LogService implements ILogService {
  constructor(private outputService: IOutputService) {}
  
  debug(message: string): void {
    if (process.env.DEBUG) {
      console.debug(`[DEBUG] ${message}`);
    }
  }
  
  info(message: string): void {
    this.outputService.info(message);
  }
  
  error(message: string, error?: Error): void {
    this.outputService.error(message);
    if (error && process.env.VERBOSE) {
      console.error(error.stack);
    }
  }
}

// 3. Token
export const LOG_SERVICE = Symbol('LOG_SERVICE');

// 4. Registration
container.register<ILogService>(
  LOG_SERVICE,
  (c) => new LogService(c.resolve<IOutputService>(OUTPUT_SERVICE)),
  'singleton'
);

// 5. Stub
export function createLogServiceStub(): ILogService {
  return {
    debug: () => {},
    info: () => {},
    error: () => {},
  };
}
```

### Example 2: Command with Multiple Dependencies

```typescript
export function createDeployCommand(container: Container): Command {
  const configService = container.resolve<IConfigService>(CONFIG_SERVICE);
  const apiClient = container.resolve<IApiClient>(API_CLIENT);
  const outputService = container.resolve<IOutputService>(OUTPUT_SERVICE);
  const fileSystem = container.resolve<IFileSystem>(FILE_SYSTEM);
  
  return new Command("deploy")
    .option('-e, --env <environment>', 'Environment to deploy to')
    .action(async (options) => {
      // Validate config
      const apiKey = configService.getApiKey();
      if (!apiKey) {
        outputService.error('Not authenticated');
        return;
      }
      
      // Read deployment config
      const config = fileSystem.readFileSync('.deploy.json', 'utf8');
      
      // Deploy via API
      const result = await apiClient.deploy(options.env, config);
      
      outputService.success(`Deployed to ${options.env}`);
    });
}
```

## FAQ

### Why not use InversifyJS or TSyringe?

We wanted to keep dependencies minimal for a CLI tool. Our custom container is ~100 lines and provides exactly what we need without external dependencies.

### Can I still use static methods?

Avoid static methods for services that need testing. Static utility functions (pure functions) are fine.

### How do I handle circular dependencies?

The container detects circular dependencies and throws an error. Refactor to break the cycle, usually by introducing an interface or event system.

### What about backward compatibility?

The public CLI API (commands and options) is unchanged. This is purely an internal refactor.

### Do I need to update all tests immediately?

No. We're keeping old test patterns working during migration. Update tests incrementally as you touch them.

### How do I debug DI issues?

1. Check service registration in `src/di/services.ts`
2. Verify token exports in `src/di/service-tokens.ts`
3. Ensure dependencies are registered before dependent services
4. Use `container.has(TOKEN)` to check if a service is registered

### Can I have multiple containers?

Yes! Use `container.createScope()` to create child containers for testing or isolation.

## Future Improvements

1. **Add container.test.ts** - Test the DI container itself
2. **Update remaining tests** - Convert all tests to use stubs instead of mocks
3. **Add lifecycle hooks** - `onInit`, `onDestroy` for services
4. **Add async initialization** - Support services that need async setup
5. **Add scoped lifetimes** - Per-request scopes if we add a server mode

## References

- [Dependency Injection Pattern](https://en.wikipedia.org/wiki/Dependency_injection)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
- [Test Doubles (Stubs vs Mocks)](https://martinfowler.com/articles/mocksArentStubs.html)

---

For questions or issues with this refactor, please refer to the implementation plan or create an issue in the repository.
