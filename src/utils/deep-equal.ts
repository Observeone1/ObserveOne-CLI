/**
 * Deep equality comparison for two objects.
 * Handles primitives, arrays, and plain objects.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
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
    const objA = a as Record<string, unknown>;
    const objB = b as Record<string, unknown>;
    const keysA = Object.keys(objA);
    const keysB = Object.keys(objB);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!Object.prototype.hasOwnProperty.call(objB, key)) return false;
      if (!deepEqual(objA[key], objB[key])) return false;
    }

    return true;
  }

  return false;
}

export interface FieldDiff {
  from: unknown;
  to: unknown;
}

/** Returns field-level diff between two normalized objects. Only includes changed keys. */
export function diffObjects(
  remote: Record<string, unknown>,
  local: Record<string, unknown>
): Record<string, FieldDiff> {
  const diff: Record<string, FieldDiff> = {};
  const keys = new Set([...Object.keys(remote), ...Object.keys(local)]);
  for (const key of keys) {
    if (!deepEqual(remote[key], local[key])) {
      diff[key] = { from: remote[key], to: local[key] };
    }
  }
  return diff;
}

/**
 * Normalize a resource object for comparison.
 * Ensures consistent key ordering and default values.
 */
export function normalizeResource<T extends Record<string, unknown>>(
  resource: T,
  defaults: Partial<T> = {}
): T {
  const normalized = { ...defaults, ...resource };

  // Sort keys for consistent comparison
  const sorted: Record<string, unknown> = {};
  Object.keys(normalized)
    .sort()
    .forEach((key) => {
      sorted[key] = normalized[key as keyof T];
    });

  return sorted as T;
}
