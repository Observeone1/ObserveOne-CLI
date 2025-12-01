/**
 * Lightweight Dependency Injection Container
 * Supports singleton and transient service lifetimes
 * Type-safe service registration and resolution
 */

export type ServiceLifetime = "singleton" | "transient";

export interface ServiceDescriptor<T = any> {
  factory: (container: Container) => T;
  lifetime: ServiceLifetime;
  instance?: T;
}

export class Container {
  private services = new Map<symbol, ServiceDescriptor>();
  private resolving = new Set<symbol>(); // Track circular dependencies

  /**
   * Register a service with the container
   */
  register<T>(
    token: symbol,
    factory: (container: Container) => T,
    lifetime: ServiceLifetime = "singleton"
  ): void {
    this.services.set(token, {
      factory,
      lifetime,
    });
  }

  /**
   * Resolve a service from the container
   */
  resolve<T>(token: symbol): T {
    const descriptor = this.services.get(token);

    if (!descriptor) {
      throw new Error(`Service not registered: ${token.toString()}`);
    }

    // Detect circular dependencies
    if (this.resolving.has(token)) {
      throw new Error(`Circular dependency detected: ${token.toString()}`);
    }

    // Return singleton instance if already created
    if (descriptor.lifetime === "singleton" && descriptor.instance) {
      return descriptor.instance as T;
    }

    // Create new instance
    this.resolving.add(token);
    try {
      const instance = descriptor.factory(this);

      // Store singleton instance
      if (descriptor.lifetime === "singleton") {
        descriptor.instance = instance;
      }

      return instance as T;
    } finally {
      this.resolving.delete(token);
    }
  }

  /**
   * Create a child scope for testing
   * Child scope can override parent services
   */
  createScope(): Container {
    const scope = new Container();

    // Copy parent services
    this.services.forEach((descriptor, token) => {
      scope.services.set(token, { ...descriptor });
    });

    return scope;
  }

  /**
   * Check if a service is registered
   */
  has(token: symbol): boolean {
    return this.services.has(token);
  }

  /**
   * Clear all services (useful for testing)
   */
  clear(): void {
    this.services.clear();
    this.resolving.clear();
  }
}
