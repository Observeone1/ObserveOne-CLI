/**
 * Deep equality comparison for two objects.
 * Handles primitives, arrays, and plain objects.
 */
export function deepEqual(a: any, b: any): boolean {
  // Same reference or value
  if (a === b) return true;

  // Null/undefined checks
  if (a == null || b == null) return a === b;

  // Type check
  if (typeof a !== typeof b) return false;

  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  // Handle objects
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
      if (!deepEqual((a as any)[key], (b as any)[key])) return false;
    }

    return true;
  }

  return false;
}

/**
 * Normalize a resource object for comparison.
 * Ensures consistent key ordering and default values.
 */
export function normalizeResource<T extends Record<string, any>>(
  resource: T,
  defaults: Partial<T> = {}
): T {
  const normalized = { ...defaults, ...resource };

  // Sort keys for consistent comparison
  const sorted: any = {};
  Object.keys(normalized)
    .sort()
    .forEach((key) => {
      sorted[key] = normalized[key as keyof T];
    });

  return sorted as T;
}
