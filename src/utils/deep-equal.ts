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
    return arraysEqual(a, b);
  }

  // Handle objects
  if (typeof a === 'object' && typeof b === 'object') {
    return objectsEqual(a as Record<string, unknown>, b as Record<string, unknown>);
  }

  return false;
}

function arraysEqual(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!deepEqual(a[i], b[i])) return false;
  }
  return true;
}

function objectsEqual(objA: Record<string, unknown>, objB: Record<string, unknown>): boolean {
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.hasOwn(objB, key)) return false;
    if (!deepEqual(objA[key], objB[key])) return false;
  }

  return true;
}

/**
 * Decide whether a desired (apply-config) field should generate an update
 * against the remote value.
 *
 * An omitted/undefined desired value means "don't care": the apply config did
 * not specify this field, so it must never count as a change (otherwise we emit
 * a spurious UPDATE that can overwrite the remote value with a default).
 * A present desired value counts as a change only when it actually differs.
 */
export function fieldChanged(desired: unknown, remote: unknown): boolean {
  if (desired === undefined) return false;
  return !deepEqual(desired, remote);
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
    .sort((left, right) => left.localeCompare(right))
    .forEach((key) => {
      sorted[key] = normalized[key as keyof T];
    });

  return sorted as T;
}
